-- Separate single-player arena ladder. Existing team battles do not use these
-- tables or functions.

create table if not exists player_arena_levels (
  level_number integer primary key check (level_number > 0),
  level_name text not null,
  enemy_ids text[] not null check (cardinality(enemy_ids) between 1 and 4),
  reward_type text not null check (reward_type in ('money', 'equipment', 'item')),
  reward_amount integer not null default 1 check (reward_amount > 0),
  reward_catalog_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (reward_type = 'money' and reward_catalog_id is null)
    or (reward_type in ('equipment', 'item') and reward_catalog_id is not null)
  )
);

create table if not exists player_arena_progress (
  player_id text not null references portal_players(id) on delete cascade,
  level_number integer not null references player_arena_levels(level_number) on delete cascade,
  completed_at timestamptz not null default now(),
  reward_type text not null,
  reward_amount integer not null,
  reward_catalog_id text,
  request_id uuid not null,
  primary key (player_id, level_number),
  unique (request_id)
);

alter table player_arena_levels enable row level security;
alter table player_arena_progress enable row level security;

insert into player_arena_levels
  (level_number, level_name, enemy_ids, reward_type, reward_amount, reward_catalog_id)
values
  (1,  'ลานประลองขั้นที่ 1',  array['e1'],             'money',     10, null),
  (2,  'ลานประลองขั้นที่ 2',  array['e1','e2'],        'item',       1, 'item_01'),
  (3,  'ลานประลองขั้นที่ 3',  array['e2','e3'],        'money',     20, null),
  (4,  'ลานประลองขั้นที่ 4',  array['e3','e4'],        'equipment',  1, 'weapon_03'),
  (5,  'ลานประลองขั้นที่ 5',  array['e4','e5'],        'item',       2, 'item_02'),
  (6,  'ลานประลองขั้นที่ 6',  array['e5','e6','e1'],   'money',     35, null),
  (7,  'ลานประลองขั้นที่ 7',  array['e6','e7','e2'],   'equipment',  1, 'armor_02'),
  (8,  'ลานประลองขั้นที่ 8',  array['e7','e8','e3'],   'item',       1, 'item_04'),
  (9,  'ลานประลองขั้นที่ 9',  array['e8','e4','e5'],   'money',     60, null),
  (10, 'ลานประลองขั้นที่ 10', array['e4','e6','e7','e8'], 'equipment', 1, 'weapon_04')
on conflict (level_number) do update set
  level_name = excluded.level_name,
  enemy_ids = excluded.enemy_ids,
  reward_type = excluded.reward_type,
  reward_amount = excluded.reward_amount,
  reward_catalog_id = excluded.reward_catalog_id,
  updated_at = now();

create or replace function public.get_player_arena_state(p_token text)
returns table (
  level_number integer,
  level_name text,
  enemy_ids text[],
  reward_type text,
  reward_amount integer,
  reward_catalog_id text,
  active boolean,
  completed boolean,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  session_player_id text;
begin
  select player_id into session_player_id
  from portal_sessions
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and expires_at > now();
  if session_player_id is null then
    raise exception 'Invalid or expired player session';
  end if;

  return query
  select l.level_number, l.level_name, l.enemy_ids, l.reward_type,
    l.reward_amount, l.reward_catalog_id, l.active,
    (p.player_id is not null), p.completed_at
  from player_arena_levels l
  left join player_arena_progress p
    on p.player_id = session_player_id
    and p.level_number = l.level_number
  order by l.level_number;
end;
$$;

create or replace function public.claim_player_arena_reward(
  p_token text,
  p_level_number integer,
  p_request_id uuid
)
returns table (
  level_number integer,
  reward_type text,
  reward_amount integer,
  reward_catalog_id text,
  already_claimed boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  session_player_id text;
  level_row player_arena_levels%rowtype;
  previous_level integer;
  progress_row player_arena_progress%rowtype;
begin
  select player_id into session_player_id
  from portal_sessions
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and expires_at > now();
  if session_player_id is null then
    raise exception 'Invalid or expired player session';
  end if;

  select * into level_row
  from player_arena_levels
  where level_number = p_level_number and active
  for update;
  if not found then raise exception 'Arena level is not active'; end if;

  select * into progress_row
  from player_arena_progress
  where player_id = session_player_id and level_number = p_level_number;
  if found then
    return query select progress_row.level_number, progress_row.reward_type,
      progress_row.reward_amount, progress_row.reward_catalog_id, true;
    return;
  end if;

  if p_level_number > 1 then
    select max(level_number) into previous_level
    from player_arena_progress
    where player_id = session_player_id;
    if coalesce(previous_level, 0) < p_level_number - 1 then
      raise exception 'Previous arena level has not been completed';
    end if;
  end if;

  if level_row.reward_type = 'money' then
    update portal_players
    set money = money + level_row.reward_amount, updated_at = now()
    where id = session_player_id;
  elsif level_row.reward_type = 'equipment' then
    insert into player_equipment (player_id, equipment_id, quantity)
    values (session_player_id, level_row.reward_catalog_id, level_row.reward_amount)
    on conflict (player_id, equipment_id)
    do update set quantity = player_equipment.quantity + excluded.quantity;
  elsif level_row.reward_type = 'item' then
    insert into player_items (player_id, item_id, quantity)
    values (session_player_id, level_row.reward_catalog_id, level_row.reward_amount)
    on conflict (player_id, item_id)
    do update set quantity = player_items.quantity + excluded.quantity;
  end if;

  insert into player_arena_progress
    (player_id, level_number, reward_type, reward_amount, reward_catalog_id, request_id)
  values
    (session_player_id, p_level_number, level_row.reward_type,
     level_row.reward_amount, level_row.reward_catalog_id, p_request_id);

  return query select level_row.level_number, level_row.reward_type,
    level_row.reward_amount, level_row.reward_catalog_id, false;
end;
$$;

revoke all on function public.get_player_arena_state(text) from public;
grant execute on function public.get_player_arena_state(text) to anon, authenticated;
revoke all on function public.claim_player_arena_reward(text, integer, uuid) from public;
grant execute on function public.claim_player_arena_reward(text, integer, uuid) to anon, authenticated;
