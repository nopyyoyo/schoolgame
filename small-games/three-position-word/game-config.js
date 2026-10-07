window.THREE_POSITION_GAME_CONFIG = {
  gameId: "three-position-word",
  levelNumber: 1,
  characterFolder: "P10S_Cut",
  columns: 15,
  visibleRows: 24,
  checkpointCount: 10,
  // Lane centers in map columns (0-based, cell-left units).
  lanes: [3.0, 7.5, 12.0],
  speedTilesPerSec: 3.2,
  collisionLookahead: 0.4,
  collisionRear: 0.3,
  playerHalfWidth: 0.3,
  promptAtY: 38.6,
  finish: { targetX: 6.5, stopY: -11.5 },
  // Enemies appear above the screen once the player enters the blocked corridors, then dash down.
  enemy: {
    characterFolder: "P15S_Cut",
    triggerY: 14.4,
    spawnAbove: 26,
    speedTilesPerSec: 14
  },
  maps: {
    main: "../../Small games/layered_map_15x40.txt",
    finish: "../../Small games/layered_map_15x20.txt"
  },
  assets: {
    tiles: "../../Small games/Tiles/PNG/",
    sounds: "../../Small games/object sound/",
    photos: "../../Small games/object photo/",
    translation: "../../Small games/Thai translation.txt",
    characters: "../../Character/Cut/Player/"
  },
  audio: {
    victory: "../../app/Music/106 Fanfare.mp3",
    defeat: "../../app/Sounds/Mario Death.mp3"
  }
};
