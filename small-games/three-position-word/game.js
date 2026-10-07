(function () {
  "use strict";

  const cfg = window.THREE_POSITION_GAME_CONFIG;
  const params = new URLSearchParams(window.location.search);
  const requestedCharacter = params.get("character");
  const characterFolder = /^P\d+S_Cut$/.test(requestedCharacter || "")
    ? requestedCharacter
    : cfg.characterFolder;
  const sessionToken = params.get("token");
  const supabaseClient = window.supabase && window.SUPABASE_CONFIG
    ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.publishableKey)
    : null;

  const COLS = cfg.columns;
  const ROWS = cfg.visibleRows;
  const LANES = cfg.lanes;
  const SPEED = cfg.speedTilesPerSec;
  const DEPTH_BASE = 200;
  const WALK = { up: [16, 15, 14, 15], side: [18, 17, 19, 17], down: [13, 12, 11, 12] };

  const frameBox = document.querySelector("#game-frame");
  const viewport = document.querySelector("#game-viewport");
  const stage = document.querySelector("#map-stage");
  const status = document.querySelector("#game-status");
  const countdown = document.querySelector("#countdown");
  const promptPhoto = document.querySelector("#prompt-photo");
  const overlay = document.querySelector("#overlay");
  const overlayMessage = document.querySelector("#overlay-message");
  const overlayActions = document.querySelector("#overlay-actions");
  const laneSlots = [...document.querySelectorAll(".lane-slot")];
  const laneWords = laneSlots.map((slot) => slot.querySelector(".lane-word"));

  let mainMap;
  let finishMap;
  let catalog = [];
  let upperCopies = [];
  let playerEl;
  let enemies = [];
  let cell = 24;
  let state = "loading";
  let x = LANES[1];
  let py = 0;
  let lat = { lane: 1, target: 1, returning: false };
  let cleared = 0;
  let lastCorrectId = null;
  let promptPending = false;
  let promptQuestion = null;
  let walkClock = 0;
  let lastTime = 0;
  let winRecorded = false;

  const assetUrl = (root, file) => `${root}${encodeURIComponent(file).replaceAll("%2F", "/")}`;
  const setStatus = (text, color) => {
    status.textContent = text;
    status.style.color = color || "";
  };

  function addLayerImage(cellEl, layer, file, mapData, depth) {
    if (!file) return;
    const image = document.createElement("img");
    image.className = `layer-image ${layer}`;
    image.src = assetUrl(cfg.assets.tiles, file);
    image.alt = "";
    if (layer !== "bg1") {
      const scale = (layer === "bg2" ? mapData.bg2ScalePercent : mapData.fgScalePercent) / 100;
      image.addEventListener("load", () => {
        image.style.width = `${(image.naturalWidth / mapData.tileWidthPx) * 100 * scale}%`;
        image.style.height = `${(image.naturalHeight / mapData.tileHeightPx) * 100 * scale}%`;
      }, { once: true });
    }
    if (layer === "fg") image.style.zIndex = String(depth);
    cellEl.append(image);
  }

  function buildCopy(mapData, offsetRows) {
    const copy = document.createElement("div");
    copy.className = "map-copy";
    copy.style.top = `calc(${offsetRows} * var(--cell-size))`;
    const fragment = document.createDocumentFragment();
    mapData.cells.forEach((data, index) => {
      const cx = index % mapData.width;
      const cy = Math.floor(index / mapData.width);
      const cellEl = document.createElement("div");
      cellEl.className = "map-cell";
      cellEl.style.left = `calc(${cx} * var(--cell-size))`;
      cellEl.style.top = `calc(${cy} * var(--cell-size))`;
      const depth = (offsetRows + cy + DEPTH_BASE + 1) * 100 - 1;
      addLayerImage(cellEl, "bg1", data.bg1, mapData, depth);
      addLayerImage(cellEl, "bg2", data.bg2, mapData, depth);
      addLayerImage(cellEl, "fg", data.fg, mapData, depth);
      fragment.append(cellEl);
    });
    copy.append(fragment);
    stage.append(copy);
    return copy;
  }

  function buildStage() {
    stage.innerHTML = "";
    buildCopy(mainMap, mainMap.height);
    buildCopy(mainMap, 0);
    upperCopies = [buildCopy(mainMap, -mainMap.height)];
    playerEl = createSprite(characterFolder, "player");
    stage.append(playerEl);
  }

  // The checkpoint-10 run is followed by the 15x20 finish map instead of another 15x40 loop.
  function swapUpperToFinish() {
    upperCopies.forEach((copy) => copy.remove());
    upperCopies = [];
    for (let offset = -finishMap.height; offset >= -mainMap.height; offset -= finishMap.height) {
      upperCopies.push(buildCopy(finishMap, offset));
    }
  }

  function spriteUrl(folder, action) {
    return `${cfg.assets.characters}${folder}/action_${String(action).padStart(2, "0")}.png`;
  }

  function createSprite(folder, className) {
    const image = document.createElement("img");
    image.className = className;
    image.alt = "";
    image.dataset.folder = folder;
    image.dataset.action = "12";
    image.src = spriteUrl(folder, 12);
    return image;
  }

  function setSprite(image, action, flip) {
    if (image.dataset.action !== String(action)) {
      image.dataset.action = String(action);
      image.src = spriteUrl(image.dataset.folder, action);
    }
    image.classList.toggle("flip", flip);
  }

  function layout() {
    const availW = frameBox.clientWidth - 6;
    const availH = frameBox.clientHeight - 6;
    cell = Math.max(8, Math.floor(Math.min(availW / COLS, availH / ROWS)));
    document.documentElement.style.setProperty("--cell-size", `${cell}px`);
    viewport.style.width = `${cell * COLS}px`;
    viewport.style.height = `${cell * ROWS}px`;
  }

  function parseTranslations(text) {
    return text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const at = line.indexOf("@");
      return { id: line.slice(0, at).trim(), thaiLabel: line.slice(at + 1).trim() };
    }).filter((entry) => entry.id && entry.thaiLabel);
  }

  async function assetExists(url) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async function loadCatalog() {
    const response = await fetch(cfg.assets.translation);
    if (!response.ok) throw new Error(`โหลดไฟล์คำแปลไม่สำเร็จ (${response.status})`);
    const entries = parseTranslations(await response.text()).map((entry) => ({
      ...entry,
      soundUrl: assetUrl(cfg.assets.sounds, `${entry.id}.mp3`),
      photoUrl: assetUrl(cfg.assets.photos, `${entry.id}.png`)
    }));
    const checks = await Promise.all(entries.map(async (entry) => ({
      entry,
      sound: await assetExists(entry.soundUrl),
      photo: await assetExists(entry.photoUrl)
    })));
    const missing = checks.filter((check) => !check.sound || !check.photo)
      .map((check) => `${check.entry.id}${check.sound ? "" : " (เสียง)"}${check.photo ? "" : " (รูป)"}`);
    if (missing.length) throw new Error(`ไฟล์ไม่ครบ: ${missing.join(", ")}`);
    if (entries.length < 3) throw new Error("ต้องมีคำศัพท์อย่างน้อย 3 คำ");
    return entries;
  }

  function shuffle(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function pickQuestion() {
    const pool = catalog.filter((entry) => entry.id !== lastCorrectId);
    const correct = pool[Math.floor(Math.random() * pool.length)];
    const distractors = shuffle(catalog.filter((entry) => entry.id !== correct.id)).slice(0, 2);
    const options = shuffle([correct, ...distractors]);
    return { correct, options, correctLane: options.indexOf(correct) };
  }

  function setActiveLane() {
    laneSlots.forEach((slot, index) => slot.classList.toggle("active", index === lat.target));
  }

  function clearEnemies() {
    enemies.forEach((enemy) => enemy.el.remove());
    enemies = [];
  }

  function spawnEnemies(correctLane) {
    clearEnemies();
    LANES.forEach((laneX, index) => {
      if (index === correctLane) return;
      const el = createSprite(cfg.enemy.characterFolder, "enemy");
      stage.append(el);
      enemies.push({ x: laneX, y: cfg.enemy.spawnY, el });
    });
  }

  function startCheckpoint(number) {
    setStatus(`ด่าน ${number}/${cfg.checkpointCount}`);
    if (number === cfg.checkpointCount) swapUpperToFinish();
    const question = pickQuestion();
    lastCorrectId = question.correct.id;
    promptQuestion = question;
    promptPending = true;
    question.options.forEach((option, index) => {
      laneWords[index].textContent = option.thaiLabel;
    });
    spawnEnemies(question.correctLane);
  }

  function playPrompt() {
    const question = promptQuestion;
    if (!question) return;
    new Audio(question.correct.soundUrl).play().catch(() => {});
    promptPhoto.src = question.correct.photoUrl;
    promptPhoto.classList.remove("show");
    void promptPhoto.offsetWidth;
    promptPhoto.classList.add("show");
  }

  function isBlocked(px, y) {
    const row = Math.floor(y - cfg.collisionLookahead);
    if (row < 0 || row >= mainMap.height) return false;
    for (const edge of [px - cfg.playerHalfWidth, px + cfg.playerHalfWidth]) {
      const col = Math.floor(edge);
      const target = col >= 0 && col < mainMap.width ? mainMap.cells[row * mainMap.width + col] : null;
      if (!target || target.collision) return true;
    }
    return false;
  }

  function requestLane(lane) {
    if (state !== "running" || lat.returning || lane < 0 || lane >= LANES.length) return;
    if (lane === lat.target) return;
    lat.target = lane;
    setActiveLane();
  }

  function moveLateral(dt) {
    const distance = LANES[lat.target] - x;
    let nextX = x;
    if (Math.abs(distance) > 1e-6) {
      nextX = x + Math.sign(distance) * Math.min(SPEED * dt, Math.abs(distance));
    }
    // A blocked lane change is abandoned and the player heads back to the lane it came from.
    if (!lat.returning && isBlocked(nextX, py)) {
      lat.target = lat.lane;
      lat.returning = true;
      setActiveLane();
      return;
    }
    x = nextX;
    if (Math.abs(LANES[lat.target] - x) < 1e-6) {
      x = LANES[lat.target];
      lat.lane = lat.target;
      lat.returning = false;
    }
  }

  function updateEnemies(dt) {
    enemies.forEach((enemy) => {
      enemy.y = Math.min(cfg.enemy.stopY, enemy.y + cfg.enemy.speedTilesPerSec * dt);
    });
    if (enemies.some((enemy) => Math.abs(enemy.x - x) < 0.6 && Math.abs(enemy.y - py) < 0.7)) lose();
  }

  function updateRunning(dt) {
    walkClock += dt;
    py -= SPEED * dt;
    moveLateral(dt);
    updateEnemies(dt);
    if (state !== "running") return;
    if (promptPending && py <= cfg.promptAtY) {
      promptPending = false;
      playPrompt();
    }
    if (py <= 0) completeCheckpoint();
  }

  function completeCheckpoint() {
    cleared += 1;
    if (cleared >= cfg.checkpointCount) {
      beginFinish();
      return;
    }
    py += mainMap.height;
    startCheckpoint(cleared + 1);
  }

  function beginFinish() {
    state = "finishing";
    clearEnemies();
    laneWords.forEach((word) => { word.textContent = ""; });
    laneSlots.forEach((slot) => slot.classList.remove("active"));
    setStatus("ผ่านครบทั้ง 10 ด่านแล้ว!", "#87e0a4");
    new Audio(cfg.audio.victory).play().catch(() => {});
    recordWin();
  }

  function updateFinishing(dt) {
    walkClock += dt;
    const step = SPEED * dt;
    const distance = cfg.finish.targetX - x;
    if (Math.abs(distance) > 1e-6) x += Math.sign(distance) * Math.min(step, Math.abs(distance));
    py -= step;
    if (py <= cfg.finish.stopY) {
      py = cfg.finish.stopY;
      x = cfg.finish.targetX;
      state = "won";
      showWinOverlay();
    }
  }

  async function recordWin() {
    if (winRecorded) return true;
    if (!sessionToken || !supabaseClient) {
      setStatus("ผ่านครบแล้ว แต่ไม่ได้เข้าสู่ระบบ จึงไม่ได้บันทึกผล", "#ffd86b");
      return false;
    }
    const { error } = await supabaseClient.rpc("record_small_game_win", {
      p_token: sessionToken,
      p_game_id: cfg.gameId,
      p_level_number: cfg.levelNumber,
      p_request_id: crypto.randomUUID()
    });
    if (error) {
      console.error("Could not record small game win", error);
      setStatus("บันทึกผลไม่สำเร็จ กรุณาลองบันทึกอีกครั้ง", "#ff8d8d");
      if (state === "won") showWinOverlay();
      return false;
    }
    winRecorded = true;
    setStatus("ชนะ — บันทึกผลแล้ว รับรางวัลได้ที่หน้าผู้เล่น", "#87e0a4");
    if (state === "won") showWinOverlay();
    return true;
  }

  function showOverlay(message, actions) {
    overlayMessage.textContent = message;
    overlayActions.innerHTML = "";
    actions.forEach((action) => overlayActions.append(action));
    overlay.hidden = false;
  }

  function makeButton(label, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function makeLink(label, href) {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = href;
    return link;
  }

  function showWinOverlay() {
    const actions = [];
    const hasSession = Boolean(sessionToken && supabaseClient);
    if (hasSession && !winRecorded) {
      actions.push(makeButton("บันทึกผลอีกครั้ง", () => recordWin()));
    }
    actions.push(makeButton("เล่นอีกครั้ง", () => window.location.reload()));
    actions.push(makeLink("กลับหน้าเวบไซต์ผู้เล่น", "../../index.html"));
    const message = winRecorded
      ? "ชนะ! ผ่านครบ 10 ด่านแล้ว รับรางวัลได้ที่หน้าผู้เล่น"
      : hasSession ? "ผ่านครบ 10 ด่านแล้ว แต่ยังไม่ได้บันทึกผล" : "ผ่านครบ 10 ด่านแล้ว (ไม่ได้เข้าสู่ระบบ)";
    showOverlay(message, actions);
  }

  function lose() {
    if (state !== "running") return;
    state = "lost";
    setStatus("แพ้ — เลือกช่องผิด ศัตรูจับได้", "#ff8d8d");
    new Audio(cfg.audio.defeat).play().catch(() => {});
    showOverlay("แพ้แล้ว — คุณเลือกช่องผิด", [
      makeButton("เล่นใหม่", () => window.location.reload()),
      makeLink("กลับหน้าเวบไซต์ผู้เล่น", "../../index.html")
    ]);
  }

  function render() {
    if (!playerEl) return;
    const frameIndex = Math.floor(walkClock / 0.14) % 4;
    const targetX = state === "finishing" ? cfg.finish.targetX : LANES[lat.target];
    const dir = Math.sign(targetX - x);
    if (state === "won") setSprite(playerEl, 12, false);
    else if (state === "running" || state === "finishing") {
      if (dir !== 0) setSprite(playerEl, WALK.side[frameIndex], dir > 0);
      else setSprite(playerEl, WALK.up[frameIndex], false);
    } else setSprite(playerEl, WALK.up[1], false);

    playerEl.style.left = `${(x - 0.5) * cell}px`;
    playerEl.style.top = `${(py - 0.5) * cell}px`;
    playerEl.style.zIndex = String((Math.floor(py) + DEPTH_BASE + 1) * 100);
    const screenTop = (ROWS - 1.6) * cell;
    stage.style.transform = `translateY(${Math.round(screenTop - (py - 0.5) * cell)}px)`;

    enemies.forEach((enemy) => {
      const moving = enemy.y < cfg.enemy.stopY && state === "running";
      setSprite(enemy.el, moving ? WALK.down[frameIndex] : 12, false);
      enemy.el.style.left = `${(enemy.x - 0.5) * cell}px`;
      enemy.el.style.top = `${(enemy.y - 0.5) * cell}px`;
      enemy.el.style.zIndex = String((Math.floor(enemy.y) + DEPTH_BASE + 1) * 100);
    });
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
    lastTime = now;
    if (state === "running") updateRunning(dt);
    else if (state === "finishing") updateFinishing(dt);
    render();
    window.requestAnimationFrame(frame);
  }

  function startCountdown() {
    state = "countdown";
    overlay.hidden = true;
    const steps = ["3", "2", "1"];
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
      state = "running";
      startCheckpoint(1);
    }, steps.length * 850);
  }

  function resetRun() {
    x = LANES[1];
    py = mainMap.height - 0.5;
    lat = { lane: 1, target: 1, returning: false };
    cleared = 0;
    setActiveLane();
  }

  function laneFromPointer(event) {
    const rect = viewport.getBoundingClientRect();
    const column = Math.floor((event.clientX - rect.left - viewport.clientLeft) / cell);
    if (column < 5) return 0;
    if (column < 10) return 1;
    return 2;
  }

  viewport.addEventListener("pointerdown", (event) => {
    if (state !== "running") return;
    event.preventDefault();
    requestLane(laneFromPointer(event));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    requestLane(lat.target + (event.key === "ArrowLeft" ? -1 : 1));
  });
  window.addEventListener("resize", layout);
  document.querySelector("#restart-game").addEventListener("click", () => window.location.reload());

  async function init() {
    layout();
    try {
      [mainMap, finishMap] = await Promise.all([
        window.LayeredMapLoader.load(cfg.maps.main),
        window.LayeredMapLoader.load(cfg.maps.finish)
      ]);
      if (mainMap.width !== COLS || finishMap.width !== COLS) throw new Error("แผนที่ต้องกว้าง 15 ช่อง");
      catalog = await loadCatalog();
      buildStage();
      resetRun();
      window.requestAnimationFrame(frame);
      state = "ready";
      setStatus("พร้อมเริ่มเกม");
      showOverlay("ฟังเสียงแล้วเลือกคำศัพท์ที่ถูกต้อง ผ่านให้ครบ 10 ด่าน", [
        makeButton("เริ่มเกม", startCountdown)
      ]);
    } catch (error) {
      state = "error";
      setStatus(`โหลดเกมไม่สำเร็จ: ${error.message}`, "#ff8d8d");
    }
  }

  init();
}());
