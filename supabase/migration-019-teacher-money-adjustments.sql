-- Teachers can add or subtract an integer amount from a student's balance.
-- Authorization is enforced from the token on the server, not by the portal UI.

create or replace function public.adjust_player_money(
  p_token text,
  p_player_id text,
  p_amount integer
)
returns table (
  player_id text,
  player_name text,
  money integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  session_player_id text;
  session_is_teacher boolean;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'Adjustment amount must not be zero';
  end if;

  select ps.player_id into session_player_id
  from public.portal_sessions ps
  where ps.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and ps.expires_at > now();
  if session_player_id is null then
    raise exception 'Invalid or expired player session';
  end if;

  select (pp.team = 'teacher' or pp.role = 'teacher') into session_is_teacher
  from public.portal_players pp
  where pp.id = session_player_id;
  if not coalesce(session_is_teacher, false) then
    raise exception 'Only teachers can adjust player money';
  end if;

  update public.portal_players pp
  set money = pp.money + p_amount,
      updated_at = now()
  where pp.id = p_player_id
    and pp.role <> 'enemy'
    and pp.team <> 'teacher'
  returning pp.id, pp.name, pp.money
  into player_id, player_name, money;
  if not found then
    raise exception 'Player not found or cannot receive money adjustments';
  end if;

  return next;
end;
$$;

revoke all on function public.adjust_player_money(text, text, integer) from public;
grant execute on function public.adjust_player_money(text, text, integer) to anon, authenticated;
