-- Register the three-position word game as a small-game level.

insert into public.small_game_levels
  (game_id, level_number, level_name, map_file, reward_type, reward_amount)
values
  ('three-position-word', 1, 'เกมเลือกคำศัพท์ 3 ช่องทาง', 'layered_map_15x40.txt', 'money', 150)
on conflict (game_id, level_number) do update set
  level_name = excluded.level_name,
  map_file = excluded.map_file,
  reward_type = excluded.reward_type,
  reward_amount = excluded.reward_amount,
  active = true;
