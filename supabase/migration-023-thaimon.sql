-- ThaiMon monster collection game — dedicated tables (does not touch portal tables)
-- Migration 023

-- ============ players ============
create table if not exists thaimon_players (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  password_salt text not null,
  display_name text not null,
  avatar_monster_id text,
  pokeballs integer not null default 0 check (pokeballs >= 0),
  gachapons integer not null default 0 check (gachapons >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ monsters ============
create table if not exists thaimon_monsters (
  id text primary key,
  name_th text not null,
  rank text not null check (rank in ('S','A','B','C','D','E','F','G','H')),
  sprite_url text not null,
  collectable boolean not null default true,
  gacha_weight integer not null default 0 check (gacha_weight >= 0),
  created_at timestamptz not null default now()
);

-- ============ inventory ============
create table if not exists thaimon_inventory (
  player_id uuid not null references thaimon_players(id) on delete cascade,
  monster_id text not null references thaimon_monsters(id) on delete restrict,
  quantity integer not null default 1 check (quantity >= 0),
  primary key (player_id, monster_id)
);

-- ============ evolution recipes ============
create table if not exists thaimon_recipes (
  id uuid primary key default gen_random_uuid(),
  result_monster_id text not null references thaimon_monsters(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists thaimon_recipe_ingredients (
  recipe_id uuid not null references thaimon_recipes(id) on delete cascade,
  monster_id text not null references thaimon_monsters(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  primary key (recipe_id, monster_id)
);

-- ============ invite codes (teacher-generated, single use) ============
create table if not exists thaimon_invite_codes (
  code text primary key,
  used_by uuid references thaimon_players(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

-- ============ config (admin password hash, etc.) ============
create table if not exists thaimon_config (
  key text primary key,
  value text not null
);

-- ============ RLS ============
alter table thaimon_players enable row level security;
alter table thaimon_monsters enable row level security;
alter table thaimon_inventory enable row level security;
alter table thaimon_recipes enable row level security;
alter table thaimon_recipe_ingredients enable row level security;
alter table thaimon_invite_codes enable row level security;
alter table thaimon_config enable row level security;

-- ThaiMon uses custom username/password auth (not Supabase Auth), so the
-- browser app talks to these tables with the publishable key. Policies are
-- permissive; the app enforces game rules. Passwords are salted hashes only.
drop policy if exists thaimon_open on thaimon_players;
create policy thaimon_open on thaimon_players for all using (true) with check (true);

drop policy if exists thaimon_open on thaimon_monsters;
create policy thaimon_open on thaimon_monsters for all using (true) with check (true);

drop policy if exists thaimon_open on thaimon_inventory;
create policy thaimon_open on thaimon_inventory for all using (true) with check (true);

drop policy if exists thaimon_open on thaimon_recipes;
create policy thaimon_open on thaimon_recipes for all using (true) with check (true);

drop policy if exists thaimon_open on thaimon_recipe_ingredients;
create policy thaimon_open on thaimon_recipe_ingredients for all using (true) with check (true);

drop policy if exists thaimon_open on thaimon_invite_codes;
create policy thaimon_open on thaimon_invite_codes for all using (true) with check (true);

drop policy if exists thaimon_open on thaimon_config;
create policy thaimon_open on thaimon_config for all using (true) with check (true);

-- ============ seed monsters (the 15 AnimalCatch animals) ============
insert into thaimon_monsters (id, name_th, rank, sprite_url, collectable, gacha_weight) values
  ('elephant',  'ช้าง',    'A', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/elephant_sprite.png',  true, 2),
  ('tiger',     'เสือ',    'A', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/tiger_sprite.png',     true, 2),
  ('lion',      'สิงโต',   'A', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/lion_sprite.png',      true, 2),
  ('horse',     'ม้า',     'B', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/horse_sprite.png',     true, 6),
  ('monkey',    'ลิง',     'B', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/monkey_sprite.png',    true, 6),
  ('cow',       'วัว',     'B', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/cow_sprite.png',       true, 6),
  ('dog',       'หมา',     'C', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/dog_sprite.png',       true, 12),
  ('cat',       'แมว',     'C', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/cat_sprite.png',       true, 12),
  ('rabbit',    'กระต่าย', 'C', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/rabbit_sprite.png',    true, 12),
  ('duck',      'เป็ด',    'C', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/duck_sprite.png',      true, 12),
  ('chicken',   'ไก่',     'D', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/chicken_sprite.png',   true, 20),
  ('pig',       'หมู',     'D', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/pig_sprite.png',       true, 20),
  ('fish',      'ปลา',     'D', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/fish_sprite.png',      true, 20),
  ('bird',      'นก',      'D', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/bird_sprite.png',      true, 20),
  ('butterfly', 'ผีเสื้อ', 'D', 'https://raw.githubusercontent.com/nopyyoyo/schoolgame/main/Small%20games/animal%20photo/butterfly_sprite.png', true, 20)
on conflict (id) do update set
  name_th = excluded.name_th,
  rank = excluded.rank,
  sprite_url = excluded.sprite_url,
  collectable = excluded.collectable,
  gacha_weight = excluded.gacha_weight;
