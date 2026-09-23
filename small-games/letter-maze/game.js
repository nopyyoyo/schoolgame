(function () {
  "use strict";

  const ASSET_ROOT = "../../";
  const TILE_ROOT = `${ASSET_ROOT}Small games/Tiles/PNG/`;
  const gameConfig = window.LETTER_MAZE_GAME_CONFIG;
  const CHARACTER_ROOT = `${ASSET_ROOT}Character/Cut/Player/${gameConfig.playerStart.characterFolder}/`;
  const LETTER_ROOT = gameConfig.assets.letters;
  const SOUND_ROOT = gameConfig.assets.sounds;
  const stage = document.querySelector("#map-stage");
  const viewport = document.querySelector("#game-viewport");
  const status = document.querySelector("#game-status");
  const letterQueue = document.querySelector("#letter-queue");
  const countdown = document.querySelector("#countdown");
  const restartButton = document.querySelector("#restart-game");
  const moveDuration = gameConfig.movement?.moveDurationMs || 520;
  const cellDisplaySize = 31;
  const directions = {
    up: { x: 0, y: -1, firstHalf: 14, secondHalf: 15, holdFirst: [16, 14], holdSecond: 15 },
    down: { x: 0, y: 1, firstHalf: 11, secondHalf: 12, holdFirst: [13, 11], holdSecond: 12 },
    left: { x: -1, y: 0, firstHalf: 18, secondHalf: 17, holdFirst: [19, 18], holdSecond: 17 },
    right: { x: 1, y: 0, firstHalf: 18, secondHalf: 17, holdFirst: [19, 18], holdSecond: 17 }
  };
  const keys = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  let map;
  let player;
  let moving = false;
  let heldDirection = null;
  let queuedDirection = null;
  let continuedMove = false;
  let holdSwingIndex = 0;
  let letterIndex = 0;
  let letterObjects = new Map();
  let enemies = [];
  let gameOver = false;
  let gameStarted = false;
  let backgroundMusic;

  const assetUrl = (root, file) => `${root}${encodeURIComponent(file).replaceAll("%2F", "/")}`;
  const cellIndex = (x, y) => y * map.width + x;
  const isWalkable = (x, y) =>
    x >= 0 && y >= 0 && x < map.width && y < map.height &&
    !map.cells[cellIndex(x, y)].collision;

  function addLayerImage(cell, layer, file) {
    if (!file) return;
    const image = document.createElement("img");
    image.className = `layer-image ${layer}`;
    image.src = assetUrl(TILE_ROOT, file);
    image.alt = "";
    if (layer !== "bg1") {
      const scale = (layer === "bg2" ? map.bg2ScalePercent : map.fgScalePercent) / 100;
      const applySize = () => {
        image.style.width = `${(image.naturalWidth / map.tileWidthPx) * 100 * scale}%`;
        image.style.height = `${(image.naturalHeight / map.tileHeightPx) * 100 * scale}%`;
      };
      image.addEventListener("load", applySize, { once: true });
    }

    cell.append(image);
  }

  function startBackgroundMusic() {
    if (gameOver || !gameStarted) return;
    if (!backgroundMusic && gameConfig.audio.music) {
      backgroundMusic = new Audio(gameConfig.audio.music);
      backgroundMusic.loop = true;
      backgroundMusic.volume = 0.35;
    }
    backgroundMusic?.play().catch(() => {});
  }

  function finishGame(message, soundPath) {
    gameOver = true;
    heldDirection = null;
    queuedDirection = null;
    status.textContent = message;
    status.style.color = message.startsWith("ชนะ") ? "#87e0a4" : "#ff8d8d";
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
    if (soundPath) {
      const sound = new Audio(soundPath);
      sound.play().catch(() => {});
    }
  }

  function renderMap() {
    stage.innerHTML = "";
    stage.style.width = `${map.width * cellDisplaySize}px`;
    stage.style.height = `${map.height * cellDisplaySize + 96}px`;
    stage.style.setProperty("--cell-size", `${cellDisplaySize}px`);
    for (let index = 0; index < map.cells.length; index += 1) {
      const x = index % map.width;
      const y = Math.floor(index / map.width);
      const cellData = map.cells[index];
      const cell = document.createElement("div");
      cell.className = `map-cell${cellData.collision ? " blocked" : ""}`;
      cell.style.left = `${x * cellDisplaySize}px`;
      cell.style.top = `${y * cellDisplaySize + 96}px`;
      addLayerImage(cell, "bg1", cellData.bg1);
      addLayerImage(cell, "bg2", cellData.bg2);
      addLayerImage(cell, "fg", cellData.fg);
      cell.dataset.gridY = String(y);
      stage.append(cell);
    }
    player = {
      x: gameConfig.playerStart.x,
      y: gameConfig.playerStart.y,
      phase: 0,
      direction: "down"
    };
    enemies = [];
    gameOver = false;
    gameStarted = false;
    const playerImage = document.createElement("img");
    playerImage.id = "player-sprite";
    playerImage.className = "player";
    playerImage.src = `${CHARACTER_ROOT}action_12.png`;
    playerImage.alt = "ผู้เล่น";
    stage.append(playerImage);
    renderEnemies();
    renderLetters();
    renderLetterQueue();
    updatePlayerSprite(0, player.direction, directions[player.direction].firstHalf);
    updateForegroundDepth();
    updateCamera();
    startCountdown();
  }

  function startCountdown() {
    const steps = ["3", "2", "1", "เริ่มเกม"];
    steps.forEach((step, index) => {
      window.setTimeout(() => {
        countdown.textContent = step;
        countdown.classList.remove("show");
        void countdown.offsetWidth;
        countdown.classList.add("show");
      }, index * 850);
    });
    window.setTimeout(() => {
      countdown.textContent = "";
      countdown.classList.remove("show");
      gameStarted = true;
      status.textContent = "เก็บตัวอักษรเริ่มจาก ก ไก่ ถึง ฮ นกฮูก";
      enemies.forEach((enemy) => scheduleEnemy(enemy, true));
    }, steps.length * 850);
  }

  function renderEnemies() {
    gameConfig.enemies.forEach((enemyConfig) => {
      const enemy = {
        ...enemyConfig,
        x: enemyConfig.x,
        y: enemyConfig.y,
        direction: "down",
        forwardDirection: "down",
        phase: 0,
        continuedMove: false,
        holdSwingIndex: 0,
        moving: false
      };
      if (!isWalkable(enemy.x, enemy.y)) {
        throw new Error(`${enemy.id} must start on a walkable cell.`);
      }
      const image = document.createElement("img");
      image.className = "enemy";
      image.src = `${ASSET_ROOT}Character/Cut/Player/${enemy.characterFolder}/action_12.png`;
      image.alt = "ศัตรู";
      image.dataset.enemyId = enemy.id;
      stage.append(image);
      enemy.image = image;
      enemies.push(enemy);
      updateEnemySprite(enemy);
      updateForegroundDepth();
    });
  }

  function updateEnemySprite(enemy) {
    const enemyDirection = directions[enemy.direction];
    const firstAction = enemy.phase === 1
      ? enemyDirection.holdSecond
      : (enemy.continuedMove
        ? enemyDirection.holdFirst[enemy.holdSwingIndex]
        : enemyDirection.firstHalf);
    enemy.image.src = `${ASSET_ROOT}Character/Cut/Player/${enemy.characterFolder}/action_${String(firstAction).padStart(2, "0")}.png`;
    enemy.image.style.left = `${enemy.x * cellDisplaySize}px`;
    enemy.image.style.top = `${enemy.y * cellDisplaySize + 96}px`;
    enemy.image.classList.toggle("flip", enemy.direction === "right");
  }

  function validDirections(enemy) {
    return Object.keys(directions).filter((name) =>
      isWalkable(enemy.x + directions[name].x, enemy.y + directions[name].y)
    );
  }

  function chooseEnemyBehavior(profile) {
    const roll = Math.random();
    if (roll < profile.hostile) return "hostile";
    if (roll < profile.hostile + profile.random) return "random";
    return "moveforward";
  }

  function chooseEnemyDirection(enemy, behavior) {
    const valid = validDirections(enemy);
    if (!valid.length) return null;
    if (behavior === "moveforward" && valid.includes(enemy.forwardDirection)) {
      return enemy.forwardDirection;
    }
    if (behavior === "hostile") {
      return valid.sort((a, b) => {
        const da = directions[a];
        const db = directions[b];
        const distanceA = Math.abs(player.x - (enemy.x + da.x)) + Math.abs(player.y - (enemy.y + da.y));
        const distanceB = Math.abs(player.x - (enemy.x + db.x)) + Math.abs(player.y - (enemy.y + db.y));
        return distanceA - distanceB;
      })[0];
    }
    return valid[Math.floor(Math.random() * valid.length)];
  }

  function enemyCollision() {
    if (enemies.some((enemy) => enemy.x === player.x && enemy.y === player.y)) {
      finishGame("แพ้ — ศัตรูสัมผัสผู้เล่น", gameConfig.audio.defeat);
      return true;
    }
    return false;
  }

  function moveEnemy(enemy) {
    if (gameOver || enemy.moving) return;
    const profile = enemy.profile;
    const behavior = chooseEnemyBehavior(profile);
    const directionName = chooseEnemyDirection(enemy, behavior);
    if (directionName) {
      const direction = directions[directionName];
      const previousDirection = enemy.direction;
      enemy.direction = directionName;
      enemy.forwardDirection = directionName;
      animateEnemyMove(enemy, directionName, previousDirection);
      return;
    }
    scheduleEnemy(enemy, false);
  }

  function animateEnemyMove(enemy, directionName, previousDirection) {
    const direction = directions[directionName];
    const startX = enemy.x;
    const startY = enemy.y;
    const targetX = startX + direction.x;
    const targetY = startY + direction.y;
    const useContinuation = enemy.continuedMove && previousDirection === directionName;
    enemy.moving = true;
    enemy.phase = 0;
    enemy.continuedMove = useContinuation;
    const duration = moveDuration / Math.max(0.1, Number(enemy.profile.speedMultiplier) || 1);
    const startTime = performance.now();
    const animate = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      enemy.phase = progress < 0.5 ? 0 : 1;
      const visualX = startX + direction.x * progress;
      const visualY = startY + direction.y * progress;
      updateEnemySprite(enemy);
      enemy.image.style.left = `${visualX * cellDisplaySize}px`;
      enemy.image.style.top = `${96 + visualY * cellDisplaySize}px`;
      if (progress < 1) {
        requestAnimationFrame(animate);
        return;
      }
      enemy.x = targetX;
      enemy.y = targetY;
      enemy.phase = 0;
      enemy.moving = false;
      if (enemy.continuedMove) enemy.holdSwingIndex = (enemy.holdSwingIndex + 1) % 2;
      enemy.continuedMove = true;
      updateEnemySprite(enemy);
      updateForegroundDepth();
      if (!enemyCollision()) scheduleEnemy(enemy, false);
    };
    requestAnimationFrame(animate);
  }

  function scheduleEnemy(enemy, initial = false) {
    const speed = Math.max(0.1, Number(enemy.profile.speedMultiplier) || 1);
    const decisionDelay = Math.max(100, Number(enemy.profile.decisionIntervalMs) || 900) / speed;
    const pauseChance = Math.max(0, Math.min(1, Number(enemy.profile.pauseChance) || 0));
    const pauseDuration = Math.max(0, Number(enemy.profile.pauseDurationMs) || 0) / speed;
    const delay = initial
      ? decisionDelay
      : (Math.random() < pauseChance ? pauseDuration : 0);
    window.setTimeout(() => moveEnemy(enemy), delay);
  }

  function letterUrl(id) {
    return `${LETTER_ROOT}${encodeURIComponent(`${id}.png`).replaceAll("%2F", "/")}`;
  }

  function soundUrl(id) {
    return `${SOUND_ROOT}${encodeURIComponent(`${id}.mp3`).replaceAll("%2F", "/")}`;
  }

  function renderLetters() {
    letterObjects.forEach((image) => image.remove());
    letterObjects = new Map();
    const visibleLetters = gameConfig.initialLetters.filter((letter) =>
      gameConfig.sequence.indexOf(letter.id) >= letterIndex
    );
    visibleLetters.forEach((letter) => {
      const image = document.createElement("img");
      image.className = "letter-token";
      image.src = letterUrl(letter.id);
      image.alt = `ตัวอักษร ${letter.id}`;
      image.dataset.letterId = letter.id;
      image.dataset.x = String(letter.x);
      image.dataset.y = String(letter.y);
      image.style.left = `${letter.x * cellDisplaySize}px`;
      image.style.top = `${letter.y * cellDisplaySize + 96}px`;
      stage.append(image);
      letterObjects.set(letter.id, image);
    });
  }

  function renderLetterQueue(animateRemoval = false, animateShift = false) {
    const upcoming = gameConfig.sequence.slice(letterIndex, letterIndex + 7);
    const cards = [...letterQueue.children];
    if (animateRemoval && cards[0]) {
      cards[0].classList.add("removing");
      window.setTimeout(() => renderLetterQueue(false, true), 240);
      return;
    }
    letterQueue.innerHTML = "";
    upcoming.forEach((id, index) => {
      const card = document.createElement("div");
      const entering = index === upcoming.length - 1 && upcoming.length === 7;
      const shifting = animateShift && index < upcoming.length - 1;
      card.className = `letter-card${entering ? " entering" : ""}${shifting ? " shifting" : ""}`;
      const image = document.createElement("img");
      image.src = letterUrl(id);
      image.alt = `ลำดับ ${index + 1}: ${id}`;
      card.append(image);
      letterQueue.append(card);
    });
  }

  function isLetterCellAvailable(x, y) {
    const cell = map.cells[cellIndex(x, y)];
    return isWalkable(x, y) &&
      isWalkable(x, y + 1) &&
      isWalkable(x, y + 2) &&
      !cell.bg2 &&
      !cell.fg &&
      !(x === player.x && y === player.y) &&
      ![...letterObjects.values()].some((image) =>
        Number(image.dataset.x) === x && Number(image.dataset.y) === y
      );
  }

  function findLetterSpawn() {
    const candidates = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (isLetterCellAvailable(x, y)) candidates.push({ x, y });
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function playLetterSound(id) {
    const audio = new Audio(soundUrl(id));
    audio.play().catch(() => {});
  }

  function collectLetterIfReady() {
    const expectedId = gameConfig.sequence[letterIndex];
    const expected = [...letterObjects.entries()].find(([id, image]) =>
      id === expectedId &&
      Number(image.dataset.x) === player.x &&
      Number(image.dataset.y) === player.y
    );
    if (!expected) return;
    playLetterSound(expected[0]);
    expected[1].remove();
    letterObjects.delete(expected[0]);
    letterIndex += 1;
    renderLetterQueue(true);
    if (letterIndex >= gameConfig.letterCount) {
      finishGame("ชนะ — เก็บครบ 44 ตัวอักษรแล้ว", gameConfig.audio.victory);
      return;
    }
    const nextId = gameConfig.sequence[letterIndex + 2];
    if (!nextId) {
      status.textContent = `เก็บแล้ว ${letterIndex}/${gameConfig.letterCount} ตัว`;
      return;
    }
    if (letterObjects.has(nextId)) {
      status.textContent = `เก็บแล้ว ${letterIndex}/${gameConfig.letterCount} ตัว`;
      return;
    }
    const next = findLetterSpawn();
    if (!next) return;
    const image = document.createElement("img");
    image.className = "letter-token";
    image.src = letterUrl(nextId);
    image.alt = `ตัวอักษรลำดับที่ ${letterIndex + 1}`;
    image.dataset.letterId = nextId;
    image.dataset.x = String(next.x);
    image.dataset.y = String(next.y);
    image.style.left = `${next.x * cellDisplaySize}px`;
    image.style.top = `${next.y * cellDisplaySize + 96}px`;
    stage.append(image);
    letterObjects.set(nextId, image);
    status.textContent = `เก็บแล้ว ${letterIndex}/${gameConfig.letterCount} ตัว`;
  }

  function updateForegroundDepth() {
    document.querySelectorAll(".map-cell .fg").forEach((image) => {
      const anchorY = Number(image.parentElement.dataset.gridY);
      image.style.zIndex = String((anchorY + 1) * 100 - 1);
    });
    const playerImage = document.querySelector("#player-sprite");
    if (playerImage) playerImage.style.zIndex = String((player.y + 1) * 100);
    enemies.forEach((enemy) => {
      enemy.image.style.zIndex = String((enemy.y + 1) * 100);
    });
  }

  function updatePlayerSprite(phase, direction, firstAction) {
    player.phase = phase;
    player.direction = direction;
    const image = document.querySelector("#player-sprite");
    const moveDirection = directions[direction];
    const action = phase === 1 ? moveDirection.holdSecond : firstAction;
    image.src = `${CHARACTER_ROOT}action_${String(action).padStart(2, "0")}.png`;
    image.classList.toggle("flip", direction === "right");
    image.style.left = `${player.x * cellDisplaySize}px`;
    image.style.top = `${player.y * cellDisplaySize + 96}px`;
  }

  function updateCameraAt(positionX = player.x, positionY = player.y) {
    const playerCenterX = (positionX + 0.5) * cellDisplaySize;
    const playerCenterY = 96 + (positionY + 0.5) * cellDisplaySize;
    const maxX = Math.max(0, map.width * cellDisplaySize - viewport.clientWidth);
    const maxY = Math.max(0, map.height * cellDisplaySize + 96 - viewport.clientHeight);
    const x = Math.min(maxX, Math.max(0, playerCenterX - viewport.clientWidth / 2));
    const y = Math.min(maxY, Math.max(0, playerCenterY - viewport.clientHeight / 2));
    stage.style.left = `${-x}px`;
    stage.style.top = `${-y}px`;
  }

  function updateCamera() {
    updateCameraAt();
  }

  function tryMove(directionName) {
    if (gameOver || !gameStarted || moving || !map || !directions[directionName]) {
      queuedDirection = directionName;
      return;
    }
    const direction = directions[directionName];
    const targetX = player.x + direction.x;
    const targetY = player.y + direction.y;
    const useContinuation = continuedMove && player.direction === directionName;
    const firstAction = useContinuation
      ? direction.holdFirst[holdSwingIndex]
      : direction.firstHalf;
    updatePlayerSprite(0, directionName, firstAction);
    if (!isWalkable(targetX, targetY)) {
      queuedDirection = null;
      return;
    }
    moving = true;
    const startX = player.x;
    const startY = player.y;
    const startTime = performance.now();
    const animate = (now) => {
      const progress = Math.min(1, (now - startTime) / moveDuration);
      const phase = progress < 0.5 ? 0 : 1;
      const image = document.querySelector("#player-sprite");
      const visualX = startX + direction.x * progress;
      const visualY = startY + direction.y * progress;
      updatePlayerSprite(
        phase,
        directionName,
        phase === 1 ? direction.holdSecond : firstAction
      );
      image.style.left = `${visualX * cellDisplaySize}px`;
      image.style.top = `${96 + visualY * cellDisplaySize}px`;
      updateCameraAt(visualX, visualY);
      if (progress < 1) {
        requestAnimationFrame(animate);
        return;
      }
      player.x = targetX;
      player.y = targetY;
      moving = false;
      updateForegroundDepth();
      enemyCollision();
      if (gameOver) return;
      collectLetterIfReady();
      if (heldDirection) {
        continuedMove = true;
        if (useContinuation) holdSwingIndex = (holdSwingIndex + 1) % 2;
      } else {
        continuedMove = false;
        holdSwingIndex = 0;
      }
      if (heldDirection) tryMove(heldDirection);
      else if (queuedDirection) {
        const next = queuedDirection;
        queuedDirection = null;
        tryMove(next);
      }
    };
    requestAnimationFrame(animate);
  }

  function startDirection(direction) {
    if (!gameStarted || gameOver) return;
    startBackgroundMusic();
    heldDirection = direction;
    queuedDirection = direction;
    if (!moving) {
      const next = queuedDirection;
      queuedDirection = null;
      tryMove(next);
    }
  }

  function stopDirection(direction) {
    if (heldDirection === direction) {
      heldDirection = null;
      if (!moving) continuedMove = false;
    }
  }

  document.addEventListener("keydown", (event) => {
    const direction = keys[event.key];
    if (!direction) return;
    event.preventDefault();
    startDirection(direction);
  });
  document.addEventListener("keyup", (event) => {
    const direction = keys[event.key];
    if (direction) stopDirection(direction);
  });
  document.querySelectorAll("[data-direction]").forEach((button) => {
    const direction = button.dataset.direction;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      startDirection(direction);
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener("pointerup", () => stopDirection(direction));
    button.addEventListener("pointercancel", () => stopDirection(direction));
    button.addEventListener("pointerleave", () => stopDirection(direction));
  });
  window.addEventListener("resize", updateCamera);
  restartButton.addEventListener("click", () => window.location.reload());

  LayeredMapLoader.load("./layered_map_40x30.txt")
    .then((loadedMap) => {
      map = loadedMap;
      if (!isWalkable(gameConfig.playerStart.x, gameConfig.playerStart.y)) {
        throw new Error("Player start must be on a walkable cell.");
      }
      renderMap();
      status.textContent = `แผนที่ ${map.width} × ${map.height} พร้อมใช้งาน`;
    })
    .catch((error) => {
      status.textContent = `โหลดแผนที่ไม่สำเร็จ: ${error.message}`;
      status.style.color = "#ff8d8d";
    });
}());
