-- A battle win records completion first. The player explicitly claims the
-- reward later from the individual player page.

alter table player_arena_progress
  add column if not exists reward_claimed boolean not null default false;

alter table player_arena_progress
  add column if not exists claimed_at timestamptz;

drop function if exists public.claim_player_arena_reward(text, integer, uuid);

drop function if exists public.get_player_arena_state(text);

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
  reward_claimed boolean,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  session_player_id text;
begin
  select ps.player_id into session_player_id
  from public.portal_sessions ps
  where ps.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and ps.expires_at > now();
  if session_player_id is null then
    raise exception 'Invalid or expired player session';
  end if;

  return query
  select pal.level_number, pal.level_name, pal.enemy_ids, pal.reward_type,
    pal.reward_amount, pal.reward_catalog_id, pal.active,
    (pap.player_id is not null), coalesce(pap.reward_claimed, false),
    pap.completed_at
  from public.player_arena_levels pal
  left join public.player_arena_progress pap
    on pap.player_id = session_player_id
    and pap.level_number = pal.level_number
  order by pal.level_number;
end;
$$;

create or replace function public.record_player_arena_win(
  p_token text,
  p_level_number integer,
  p_request_id uuid
)
returns table (
  recorded_level integer,
  was_already_recorded boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  session_player_id text;
  selected_level player_arena_levels%rowtype;
  existing_progress player_arena_progress%rowtype;
begin
  select ps.player_id into session_player_id
  from public.portal_sessions ps
  where ps.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and ps.expires_at > now();
  if session_player_id is null then
    raise exception 'Invalid or expired player session';
  end if;

  select pal.* into selected_level
  from public.player_arena_levels pal
  where pal.level_number = p_level_number
    and pal.active
  for update;
  if not found then raise exception 'Arena level is not active'; end if;

  select pap.* into existing_progress
  from public.player_arena_progress pap
  where pap.player_id = session_player_id
    and pap.level_number = p_level_number;
  if found then
    return query select existing_progress.level_number, true;
    return;
  end if;

  if p_level_number > 1 and not exists (
    select 1
    from public.player_arena_progress previous_progress
    where previous_progress.player_id = session_player_id
      and previous_progress.level_number = p_level_number - 1
  ) then
    raise exception 'Previous arena level has not been completed';
  end if;

  insert into public.player_arena_progress
    (player_id, level_number, reward_type, reward_amount, reward_catalog_id, request_id)
  values
    (session_player_id, selected_level.level_number, selected_level.reward_type,
     selected_level.reward_amount, selected_level.reward_catalog_id, p_request_id);

  return query select selected_level.level_number, false;
end;
$$;

create or replace function public.claim_player_arena_reward(
  p_token text,
  p_level_number integer
)
returns table (
  claimed_level integer,
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
  progress_row player_arena_progress%rowtype;
begin
  select ps.player_id into session_player_id
  from public.portal_sessions ps
  where ps.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and ps.expires_at > now();
  if session_player_id is null then
    raise exception 'Invalid or expired player session';
  end if;

  select pap.* into progress_row
  from public.player_arena_progress pap
  where pap.player_id = session_player_id
    and pap.level_number = p_level_number
  for update;
  if not found then raise exception 'Arena level has not been completed'; end if;

  if progress_row.reward_claimed then
    return query select progress_row.level_number, progress_row.reward_type,
      progress_row.reward_amount, progress_row.reward_catalog_id, true;
    return;
  end if;

  if progress_row.reward_type = 'money' then
    update public.portal_players pp
    set money = pp.money + progress_row.reward_amount, updated_at = now()
    where pp.id = session_player_id;
  elsif progress_row.reward_type = 'equipment' then
    insert into public.player_equipment (player_id, equipment_id, quantity)
    values (session_player_id, progress_row.reward_catalog_id, progress_row.reward_amount)
    on conflict (player_id, equipment_id)
    do update set quantity = player_equipment.quantity + excluded.quantity;
  elsif progress_row.reward_type = 'item' then
    insert into public.player_items (player_id, item_id, quantity)
    values (session_player_id, progress_row.reward_catalog_id, progress_row.reward_amount)
    on conflict (player_id, item_id)
    do update set quantity = player_items.quantity + excluded.quantity;
  end if;

  update public.player_arena_progress pap
  set reward_claimed = true, claimed_at = now()
  where pap.player_id = session_player_id
    and pap.level_number = p_level_number;

  return query select progress_row.level_number, progress_row.reward_type,
    progress_row.reward_amount, progress_row.reward_catalog_id, false;
end;
$$;

revoke all on function public.record_player_arena_win(text, integer, uuid) from public;
grant execute on function public.record_player_arena_win(text, integer, uuid) to anon, authenticated;
revoke all on function public.get_player_arena_state(text) from public;
grant execute on function public.get_player_arena_state(text) to anon, authenticated;
revoke all on function public.claim_player_arena_reward(text, integer) from public;
grant execute on function public.claim_player_arena_reward(text, integer) to anon, authenticated;
