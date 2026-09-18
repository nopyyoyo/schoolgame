window.BATTLE_CONFIG = {
  cooldownThreshold: 1000,
  calculationIntervalMs: 70,
  minimumDamage: 1,
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
  selectedBackground: 1,
  backgrounds: Array.from({ length: 10 }, (_, index) =>
    `../Character/Cut/Background/background_${String(index + 1).padStart(2, "0")}.png`
  )
};
