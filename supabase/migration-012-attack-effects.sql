-- Add attack effect (animation) and sound columns to skills and weapons,
-- and randomly assign defaults for review/adjustment in Supabase.
--
-- Priority when an attack resolves in the battle app:
--   1. skill_catalog.attack_effect / attack_sound (when a skill is used)
--   2. equipment_catalog.attack_effect / attack_sound of the attacker's
--      equipped weapon (normal attack only; only weapons carry these columns)
--   3. fallback to the existing generic hit/miss sound with no visual effect
--
-- attack_effect stores a folder name under app/Attack Effect/ (e.g. "01_ThunderBlade").
-- attack_sound stores a file name under app/Sounds/ (e.g. "A8SwordSlash.wav").

alter table public.skill_catalog
  add column if not exists attack_effect text,
  add column if not exists attack_sound text;

alter table public.equipment_catalog
  add column if not exists attack_effect text,
  add column if not exists attack_sound text;

do $$
declare
  effects text[] := array[
    '01_ThunderBlade','02_Drainer_MagicBrush','03_ChocoboBrush','04_FlameSabre','05_SkyRender',
    '06_Blizzard','07_Strato','08_Excalibur','09_DaVinciBrush','10_ValiantKnife',
    '11_Scimitar','12_Crystal','13_GoldLance','14_Tempest','15_SoulSabreV',
    '16_AtmaWeapon','17_AuraV_Blue','18_AuraV_DarkBlue','19_AuraV_Fire','20_Ragnarok',
    '21_Ashura_Kotetsu','22_Hawkeye','23_Sniper','24_DeathEffect','25_Spark_Row_1',
    '26_Spark_Row_2','27_Spark_Row_3','28_Spark_Row_4','29_Spark_Row_5','30_Spark_Row_6',
    '31_Spark_Row_7','32_ExpandingStar_White_1','33_ExpandingStar_White_2','34_ExpandingStar_White_3','35_ExpandingStar_Purple_1',
    '36_ExpandingStar_Purple_2','37_ExpandingStar_Purple_3','38_ExpandingStar_Blue_1','39_ExpandingStar_Blue_2','40_ExpandingStar_Blue_3',
    '41_ExpandingStar_Green_1','42_ExpandingStar_Green_2','43_HorizontalSlash_Row_1','44_HorizontalSlash_Row_2','45_HorizontalSlash_Row_3',
    '46_HorizontalSlash_Row_4','47_HorizontalSlash_Row_5','48_HorizontalSlash_Row_6','49_HorizontalSlash_Row_7','50_HorizontalSlash_Row_8',
    '51_DiagonalSlash_White_1','52_DiagonalSlash_White_2','53_DiagonalSlash_White_3','54_DiagonalSlash_Yellow_1','55_DiagonalSlash_Yellow_2',
    '56_DiagonalSlash_Yellow_3','57_DiagonalSlash_Green_1','58_DiagonalSlash_Green_2','59_DiagonalSlash_Green_3','60_DiagonalSlash_Red_1',
    '61_DiagonalSlash_Red_2','62_ArcBoomerang_Row_1','63_ArcBoomerang_Row_2','64_ArcBoomerang_Row_3'
  ];
  -- Sounds reserved for existing UI/system events (miss, enemy death, player turn ting)
  -- are excluded from the random impact-sound pool.
  sounds text[] := array[
    '2ESwordSlashLong.wav','33HitFist.wav','8BClawSlash.wav','A8SwordSlash.wav','F5FightTing.wav',
    'fp_fang_fa_fp1.win32 [1].wav','fp_fang_fa_fp2.win32 [1].wav','fp_fang_fa_fp3.win32 [1].wav',
    'magic_arbt_hit.win32 [1].wav','magic_babr_hit.win32 [1].wav','magic_blast.win32 [1].wav',
    'magic_brav_hit.win32 [1].wav','magic_brzd_hatu.win32 [1].wav','magic_brzd_hit.win32 [1].wav',
    'magic_brzg_air.win32 [1].wav','magic_cega_hatu.win32 [1].wav','magic_cela_hit.win32 [1].wav',
    'magic_eara_hit.win32 [1].wav','magic_enwt_hit.win32 [1].wav','magic_figa_hatu.win32 [1].wav',
    'magic_fira_hit.win32 [1].wav','magic_fire_hit.win32 [1].wav','magic_raizg.win32 [1].wav',
    'magic_seis_hatu.win32 [1].wav','magic_tnda_hatu.win32 [1].wav','magic_tnda_hit.win32 [1].wav',
    'magic_tndg_hit.win32 [1].wav','wp_fang_hit4.win32 [1].wav','wp_fang_hit5.win32 [1].wav',
    'wp_light_s_hit1.win32 [1].wav'
  ];
begin
  update public.skill_catalog
  set attack_effect = coalesce(attack_effect, effects[1 + floor(random() * array_length(effects, 1))::int]),
      attack_sound = coalesce(attack_sound, sounds[1 + floor(random() * array_length(sounds, 1))::int])
  where attack_effect is null or attack_sound is null;

  update public.equipment_catalog
  set attack_effect = coalesce(attack_effect, effects[1 + floor(random() * array_length(effects, 1))::int]),
      attack_sound = coalesce(attack_sound, sounds[1 + floor(random() * array_length(sounds, 1))::int])
  where category = 'weapon' and (attack_effect is null or attack_sound is null);
end
$$;
