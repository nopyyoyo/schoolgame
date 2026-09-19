window.BATTLE_CONFIG = {
  cooldownThreshold: 1000,
  calculationIntervalMs: 70,
  minimumDamage: [1,2,2,3,3,3,3,4,4,4,4,4,5,5],
  equalSpeedMissChance: 0.05,
  hitRules: [
    { min: 1, max: 49, missChance: 0.05 },
    { min: 50, max: 199, missChance: 0.20 },
    { min: 200, max: 499, missChance: 0.50 },
    { min: 500, max: Infinity, missChance: 0.90 }
  ],
  damage: {
    attackMultiplier: 1.5,
    randomFactors: [0.9, 1, 1.1, 1.2]
  },
  defend: {
    defenseMultiplier: 1.8
  },
  skills: {
    elementMultiplier: 2.00,
    healMultiplier: 1.00
  },
  effects: {
    // Per-frame playback speed for Attack Effect animations (ms per frame).
    frameDurationMs: 70,
    // Estimated playback length used to hold the damage/heal number reveal
    // until the impact sound has had time to finish (wav duration isn't probed).
    soundDurationMs: 500,
    soundVolume: 0.85,
    // How far (in %) the effect is offset toward the attacker's side of the target.
    offsetPercent: 14,
    // Default render scale (multiplier on the effect's native pixel size) used
    // whenever a skill/weapon doesn't set its own attack_effect_scale in
    // Supabase (including the bare-hand default effect below).
    defaultScale: 1,
    // Bare-hand fallback when neither a skill nor the equipped weapon defines
    // an attack_effect. Set this to an "Attack Effect" folder name (e.g.
    // "43_HorizontalSlash_Row_1") once you pick a default punch/kick effect.
    defaultEffect: "65_PunchStrike"
  },
  selectedBackground: 1,
  backgrounds: Array.from({ length: 10 }, (_, index) =>
    `../Character/Cut/Background/background_${String(index + 1).padStart(2, "0")}.png`
  )
};
