create table if not exists small_game_levels (
  game_id text not null,
  level_number integer not null check (level_number > 0),
  level_name text not null,
  map_file text not null,
  reward_type text not null check (reward_type in ('money', 'equipment', 'item')),
  reward_amount integer not null default 1 check (reward_amount > 0),
  reward_catalog_id text,
  active boolean not null default true,
  primary key (game_id, level_number),
  check (
    (reward_type = 'money' and reward_catalog_id is null)
    or (reward_type in ('equipment', 'item') and reward_catalog_id is not null)
  )
);

create table if not exists small_game_player_progress (
  player_id text not null references portal_players(id) on delete cascade,
  game_id text not null,
  level_number integer not null,
  completed_at timestamptz not null default now(),
  reward_type text not null,
  reward_amount integer not null,
  reward_catalog_id text,
  reward_claimed boolean not null default false,
  claimed_at timestamptz,
  request_id uuid not null unique,
  primary key (player_id, game_id, level_number),
  foreign key (game_id, level_number) references small_game_levels(game_id, level_number)
);

alter table small_game_levels enable row level security;
alter table small_game_player_progress enable row level security;

insert into small_game_levels
  (game_id, level_number, level_name, map_file, reward_type, reward_amount)
values
  ('thai-letter-maze', 1, 'เกมเก็บพยัญชนะ', 'layered_map_40x30.txt', 'money', 10)
on conflict (game_id, level_number) do update set
  level_name = excluded.level_name,
  map_file = excluded.map_file,
  reward_type = excluded.reward_type,
  reward_amount = excluded.reward_amount,
  active = true;

create or replace function public.get_small_game_state(p_token text, p_game_id text)
returns table (
  game_id text,
  level_number integer,
  level_name text,
  map_file text,
  reward_type text,
  reward_amount integer,
  reward_catalog_id text,
  active boolean,
  completed boolean,
  reward_claimed boolean,
  completed_at timestamptz
)
language plpgsql security definer set search_path = public, extensions
as $$
declare session_player_id text;
begin
  select ps.player_id into session_player_id from portal_sessions ps
  where ps.token_hash = encode(digest(p_token, 'sha256'), 'hex') and ps.expires_at > now();
  if session_player_id is null then raise exception 'Invalid or expired player session'; end if;
  return query
  select l.game_id, l.level_number, l.level_name, l.map_file, l.reward_type,
    l.reward_amount, l.reward_catalog_id, l.active,
    (p.player_id is not null), coalesce(p.reward_claimed, false), p.completed_at
  from small_game_levels l
  left join small_game_player_progress p
    on p.player_id = session_player_id and p.game_id = l.game_id
    and p.level_number = l.level_number
  where l.game_id = p_game_id
  order by l.level_number;
end;
$$;

create or replace function public.record_small_game_win(
  p_token text, p_game_id text, p_level_number integer, p_request_id uuid
)
returns table (recorded_level integer, was_already_recorded boolean)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  session_player_id text;
  level_row small_game_levels%rowtype;
  existing_progress small_game_player_progress%rowtype;
begin
  select ps.player_id into session_player_id from portal_sessions ps
  where ps.token_hash = encode(digest(p_token, 'sha256'), 'hex') and ps.expires_at > now();
  if session_player_id is null then raise exception 'Invalid or expired player session'; end if;
  select * into level_row from small_game_levels
  where game_id = p_game_id and level_number = p_level_number and active for update;
  if not found then raise exception 'Small game level is not active'; end if;
  select * into existing_progress from small_game_player_progress
  where player_id = session_player_id and game_id = p_game_id and level_number = p_level_number;
  if found then return query select existing_progress.level_number, true; return; end if;
  insert into small_game_player_progress
    (player_id, game_id, level_number, reward_type, reward_amount, reward_catalog_id, request_id)
  values
    (session_player_id, level_row.game_id, level_row.level_number, level_row.reward_type,
     level_row.reward_amount, level_row.reward_catalog_id, p_request_id);
  return query select level_row.level_number, false;
end;
$$;

create or replace function public.claim_small_game_reward(
  p_token text, p_game_id text, p_level_number integer
)
returns table (
  claimed_level integer, reward_type text, reward_amount integer,
  reward_catalog_id text, already_claimed boolean
)
language plpgsql security definer set search_path = public, extensions
as $$
declare session_player_id text; progress_row small_game_player_progress%rowtype;
begin
  select ps.player_id into session_player_id from portal_sessions ps
  where ps.token_hash = encode(digest(p_token, 'sha256'), 'hex') and ps.expires_at > now();
  if session_player_id is null then raise exception 'Invalid or expired player session'; end if;
  select * into progress_row from small_game_player_progress
  where player_id = session_player_id and game_id = p_game_id and level_number = p_level_number
  for update;
  if not found then raise exception 'Small game level has not been completed'; end if;
  if progress_row.reward_claimed then
    return query select progress_row.level_number, progress_row.reward_type,
      progress_row.reward_amount, progress_row.reward_catalog_id, true;
    return;
  end if;
  if progress_row.reward_type = 'money' then
    update portal_players set money = money + progress_row.reward_amount, updated_at = now()
    where id = session_player_id;
  elsif progress_row.reward_type = 'equipment' then
    insert into player_equipment (player_id, equipment_id, quantity)
    values (session_player_id, progress_row.reward_catalog_id, progress_row.reward_amount)
    on conflict (player_id, equipment_id) do update set quantity = player_equipment.quantity + excluded.quantity;
  elsif progress_row.reward_type = 'item' then
    insert into player_items (player_id, item_id, quantity)
    values (session_player_id, progress_row.reward_catalog_id, progress_row.reward_amount)
    on conflict (player_id, item_id) do update set quantity = player_items.quantity + excluded.quantity;
  end if;
  update small_game_player_progress set reward_claimed = true, claimed_at = now()
  where player_id = session_player_id and game_id = p_game_id and level_number = p_level_number;
  return query select progress_row.level_number, progress_row.reward_type,
    progress_row.reward_amount, progress_row.reward_catalog_id, false;
end;
$$;

revoke all on function public.get_small_game_state(text, text) from public;
grant execute on function public.get_small_game_state(text, text) to anon, authenticated;
revoke all on function public.record_small_game_win(text, text, integer, uuid) from public;
grant execute on function public.record_small_game_win(text, text, integer, uuid) to anon, authenticated;
revoke all on function public.claim_small_game_reward(text, text, integer) from public;
grant execute on function public.claim_small_game_reward(text, text, integer) to anon, authenticated;
