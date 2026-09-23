window.LETTER_MAZE_GAME_CONFIG = {
  playerStart: { x: 20, y: 20, characterFolder: "P10S_Cut" },
  movement: {
    moveDurationMs: 230
  },
  enemies: [
    {
      id: "enemy-1",
      x: 13,
      y: 9,
      characterFolder: "P15S_Cut",
      profile: {
        hostile: 0.5,
        random: 0.3,
        moveforward: 0.2,
        speedMultiplier: 1,
        decisionIntervalMs: 900,
        pauseChance: 0.12,
        pauseDurationMs: 420
      }
    },
    {
      id: "enemy-2",
      x: 30,
      y: 10,
      characterFolder: "P15S_Cut",
      profile: {
        hostile: 0.4,
        random: 0.4,
        moveforward: 0.2,
        speedMultiplier: 1.15,
        decisionIntervalMs: 1100,
        pauseChance: 0.1,
        pauseDurationMs: 360
      }
    },
    {
      id: "enemy-3",
      x: 8,
      y: 25,
      characterFolder: "P15S_Cut",
      profile: {
        hostile: 0.2,
        random: 0.3,
        moveforward: 0.5,
        speedMultiplier: 0.85,
        decisionIntervalMs: 800,
        pauseChance: 0.16,
        pauseDurationMs: 520
      }
    },
    {
      id: "enemy-4",
      x: 24,
      y: 1,
      characterFolder: "P15S_Cut",
      profile: {
        hostile: 0.35,
        random: 0.4,
        moveforward: 0.25,
        speedMultiplier: 1,
        decisionIntervalMs: 950,
        pauseChance: 0.12,
        pauseDurationMs: 420
      }
    }
  ],
  initialLetters: [
    { id: "01_ก", x: 8, y: 1 },
    { id: "02_ข", x: 20, y: 20 },
    { id: "03_ฃ", x: 30, y: 1 }
  ],
  letterCount: 44,
  audio: {
    music: "../../app/Music/Lava Chicken.mp3",
    victory: "../../app/Sounds/piglevelwin2.mp3",
    defeat: "../../app/Sounds/Mario Death.mp3"
  },
  sequence: [
    "01_ก", "02_ข", "03_ฃ", "04_ค", "05_ฅ", "06_ฆ", "07_ง", "08_จ",
    "09_ฉ", "10_ช", "11_ซ", "12_ฌ", "13_ญ", "14_ฎ", "15_ฏ", "16_ฐ",
    "17_ฑ", "18_ฒ", "19_ณ", "20_ด", "21_ต", "22_ถ", "23_ท", "24_ธ",
    "25_น", "26_บ", "27_ป", "28_ผ", "29_ฝ", "30_พ", "31_ฟ", "32_ภ",
    "33_ม", "34_ย", "35_ร", "36_ล", "37_ว", "38_ศ", "39_ษ", "40_ส",
    "41_ห", "42_ฬ", "43_อ", "44_ฮ"
  ],
  assets: {
    letters: "../../Small games/Thai_44_Rectangle_Crops/",
    sounds: "../../Small games/Thai letter sound/"
  }
};
