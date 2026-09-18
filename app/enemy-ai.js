window.ENEMY_AI_CONFIG = {
  control: "ai",
  strategies: {
    always_attack_random: {
      label: "Always attack random target",
      attackChance: 1,
      skillChance: 0
    },
    attack_skill_70_30: {
      label: "70/30 Attack/Skill ratio",
      attackChance: 0.7,
      skillChance: 0.3,
      status: "future"
    }
  },
  selectedStrategy: "always_attack_random"
};
