-- Adds a per-row effect scale override for skills and weapons. When null,
-- the client (app.js) falls back to config.effects.defaultScale.
-- Scale is a multiplier applied to the effect's native pixel size (the
-- existing 64/72 effects were tuned around a default of 3x).

alter table skill_catalog
  add column if not exists attack_effect_scale numeric;

alter table equipment_catalog
  add column if not exists attack_effect_scale numeric;
