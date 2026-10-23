-- ThaiMon avatars: separate from monsters.
-- 2 default avatars (boy/girl) available to everyone; more unlockable later.

create table if not exists thaimon_avatars (
  id text primary key,
  name_th text not null,
  image_url text not null,
  is_default boolean not null default false,
  gacha_weight integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists thaimon_player_avatars (
  player_id uuid not null references thaimon_players(id) on delete cascade,
  avatar_id text not null references thaimon_avatars(id) on delete restrict,
  obtained_at timestamptz not null default now(),
  primary key (player_id, avatar_id)
);

alter table thaimon_players
  add column if not exists avatar_id text references thaimon_avatars(id);

-- RLS (permissive browser policies, matching existing thaimon_* tables)
alter table thaimon_avatars enable row level security;
alter table thaimon_player_avatars enable row level security;

drop policy if exists "thaimon_avatars_all" on thaimon_avatars;
create policy "thaimon_avatars_all" on thaimon_avatars
  for all using (true) with check (true);

drop policy if exists "thaimon_player_avatars_all" on thaimon_player_avatars;
create policy "thaimon_player_avatars_all" on thaimon_player_avatars
  for all using (true) with check (true);

-- Seed the 2 default avatars
insert into thaimon_avatars (id, name_th, image_url, is_default, gacha_weight)
values
  ('boy',  'เด็กชาย', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/ThaiMon/avatars/boy_avatar.png',  true, 0),
  ('girl', 'เด็กหญิง', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/ThaiMon/avatars/girl_avatar.png', true, 0)
on conflict (id) do update set
  name_th = excluded.name_th,
  image_url = excluded.image_url,
  is_default = excluded.is_default;

-- Grant both defaults to any existing players, default their avatar to boy
insert into thaimon_player_avatars (player_id, avatar_id)
select p.id, a.id
from thaimon_players p
cross join thaimon_avatars a
where a.is_default = true
on conflict do nothing;

update thaimon_players
set avatar_id = 'boy'
where avatar_id is null;
