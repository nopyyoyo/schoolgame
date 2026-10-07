-- Add the sound-only second level and prevent it from being completed before level 1.

insert into public.small_game_levels
  (game_id, level_number, level_name, map_file, reward_type, reward_amount)
values
  ('three-position-word', 2, 'เกมเลือกคำศัพท์ 3 ช่องทาง ขั้นที่ 2', 'layered_map_15x40.txt', 'money', 150)
on conflict (game_id, level_number) do update set
  level_name = excluded.level_name,
  map_file = excluded.map_file,
  reward_type = excluded.reward_type,
  reward_amount = excluded.reward_amount,
  active = true;

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

  if p_level_number > 1 and not exists (
    select 1 from small_game_player_progress
    where player_id = session_player_id
      and game_id = p_game_id
      and level_number = p_level_number - 1
  ) then
    raise exception 'Must complete the previous small game level first';
  end if;

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
