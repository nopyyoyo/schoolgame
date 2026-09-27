-- Increase the reward for the first Thai letter maze level.

update public.small_game_levels
set reward_amount = 150
where game_id = 'thai-letter-maze'
  and level_number = 1
  and reward_type = 'money';
