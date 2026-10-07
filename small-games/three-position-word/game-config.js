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
  playerHalfWidth: 0.3,
  promptAtY: 19.5,
  finish: { targetX: 6.5, stopY: -11.5 },
  enemy: {
    characterFolder: "P15S_Cut",
    spawnY: 3.5,
    stopY: 9.5,
    speedTilesPerSec: 1.2
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
