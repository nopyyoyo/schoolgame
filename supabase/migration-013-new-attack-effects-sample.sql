-- Randomly assigns some of the 8 newly added attack effects (65_PunchStrike,
-- 66_Strike, 67_Uppercut, 68_SlashEffect, 69_PunchBlast, 70_HorizontalSlash,
-- 71_PunchAction, 72_SlashSlam) to a handful of existing skill_catalog and
-- equipment_catalog (weapon) rows, purely so the new effects are visible in
-- battle right away. Sound is left untouched (falls back to existing sound
-- already assigned to that row). Re-run any time to reshuffle the sample.

with new_effects(effect) as (
  values
    ('65_PunchStrike'), ('66_Strike'), ('67_Uppercut'), ('68_SlashEffect'),
    ('69_PunchBlast'), ('70_HorizontalSlash'), ('71_PunchAction'), ('72_SlashSlam')
),
picked_skills as (
  select id, (select effect from new_effects order by random() limit 1) as effect
  from skill_catalog
  order by random()
  limit 3
)
update skill_catalog s
set attack_effect = p.effect
from picked_skills p
where s.id = p.id;

with new_effects(effect) as (
  values
    ('65_PunchStrike'), ('66_Strike'), ('67_Uppercut'), ('68_SlashEffect'),
    ('69_PunchBlast'), ('70_HorizontalSlash'), ('71_PunchAction'), ('72_SlashSlam')
),
picked_weapons as (
  select id, (select effect from new_effects order by random() limit 1) as effect
  from equipment_catalog
  where category = 'weapon'
  order by random()
  limit 2
)
update equipment_catalog e
set attack_effect = p.effect
from picked_weapons p
where e.id = p.id;
