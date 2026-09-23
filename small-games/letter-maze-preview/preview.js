const ASSET_ROOT = "../../";
const TILE_ROOT = `${ASSET_ROOT}Small games/Tiles/PNG/`;
const CHARACTER_ROOT = `${ASSET_ROOT}Character/Cut/Player/`;
const LETTER_ROOT = `${ASSET_ROOT}Small games/Thai_44_Rectangle_Crops/`;
const stage = document.querySelector("#map-stage");
const details = document.querySelector("#map-details");
const status = document.querySelector("#preview-status");
const viewport = document.querySelector("#map-viewport");
const DISPLAY_CELL_SIZE = 31;

const assetUrl = (root, file) => `${root}${encodeURIComponent(file).replaceAll("%2F", "/")}`;

function createImage(className, source, alt) {
  const image = document.createElement("img");
  image.className = className;
  image.src = source;
  image.alt = alt;
  return image;
}

function cellData(map, index) {
  return map.cells[index] || {
    bg1: map.layers.bg1?.[index] || null,
    bg2: map.layers.bg2?.[index] || null,
    fg: map.layers.fg?.[index] || null,
    collision: Boolean(map.layers.collision?.[index])
  };
}

function addLayerImage(cell, layer, file, map) {
  if (!file) return;
  const image = createImage(`layer-image ${layer}`, assetUrl(TILE_ROOT, file), file);
  if (layer !== "bg1") {
    const scale = layer === "bg2"
      ? (map.bg2ScalePercent || 100) / 100
      : (map.fgScalePercent || 100) / 100;
    const applyNaturalScale = () => {
      const tileSize = map.tileWidthPx || 20;
      image.style.width = `${(image.naturalWidth / tileSize) * 100 * scale}%`;
      image.style.height = `${(image.naturalHeight / tileSize) * 100 * scale}%`;
    };
    if (image.complete) applyNaturalScale();
    else image.addEventListener("load", applyNaturalScale, { once: true });
  }
  cell.append(image);
}

function renderMap(map) {
  stage.style.width = `${map.width * DISPLAY_CELL_SIZE}px`;
  stage.style.height = `${map.height * DISPLAY_CELL_SIZE}px`;
  stage.style.setProperty("--cell-size", `${DISPLAY_CELL_SIZE}px`);

  for (let index = 0; index < map.width * map.height; index += 1) {
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    const data = cellData(map, index);
    const cell = document.createElement("div");
    cell.className = `map-cell${data.collision ? " blocked" : ""}`;
    cell.style.left = `${x * DISPLAY_CELL_SIZE}px`;
    cell.style.top = `${y * DISPLAY_CELL_SIZE}px`;
    addLayerImage(cell, "bg1", data.bg1, map);
    addLayerImage(cell, "bg2", data.bg2, map);
    addLayerImage(cell, "fg", data.fg, map);
    cell.dataset.gridY = String(y);
    stage.append(cell);
  }

  const player = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
  const playerImage = createImage(
    "map-object character player",
    `${CHARACTER_ROOT}P10S_Cut/action_15.png`,
    "ผู้เล่น"
  );
  playerImage.style.left = `${player.x * DISPLAY_CELL_SIZE}px`;
  playerImage.style.top = `${player.y * DISPLAY_CELL_SIZE}px`;
  stage.append(playerImage);
  playerImage.style.zIndex = String((player.y + 1) * 100);
  document.querySelectorAll(".map-cell .fg").forEach((image) => {
    const anchorY = Number(image.parentElement.dataset.gridY);
    image.style.zIndex = String((anchorY + 1) * 100 - 1);
  });

  const enemy = { x: 5, y: 5 };
  const enemyImage = createImage(
    "map-object character enemy",
    `${CHARACTER_ROOT}P11S_Cut/action_15.png`,
    "ศัตรู"
  );
  enemyImage.style.left = `${enemy.x * DISPLAY_CELL_SIZE}px`;
  enemyImage.style.top = `${enemy.y * DISPLAY_CELL_SIZE}px`;
  stage.append(enemyImage);
  enemyImage.style.zIndex = String((enemy.y + 1) * 100);

  [
    { id: "01_ก", x: 8, y: 8 },
    { id: "02_ข", x: 20, y: 20 },
    { id: "03_ฃ", x: 32, y: 32 }
  ].forEach((letter) => {
    const image = createImage(
      "map-object letter",
      assetUrl(LETTER_ROOT, `${letter.id}.png`),
      `ตัวอักษร ${letter.id}`
    );
    image.style.left = `${letter.x * DISPLAY_CELL_SIZE}px`;
    image.style.top = `${letter.y * DISPLAY_CELL_SIZE}px`;
    stage.append(image);
  });

  viewport.style.setProperty("--map-width", `${map.width * DISPLAY_CELL_SIZE}px`);
  viewport.style.setProperty("--map-height", `${map.height * DISPLAY_CELL_SIZE}px`);
}

function renderDetails(map) {
  const cells = Array.from({ length: map.width * map.height }, (_, index) => cellData(map, index));
  const blocked = cells.filter((cell) => cell.collision).length;
  const layerCount = ["bg1", "bg2", "fg"].reduce(
    (total, layer) => total + new Set(cells.map((cell) => cell[layer]).filter(Boolean)).size,
    0
  );
  details.innerHTML = [
    ["ขนาดแผนที่", `${map.width} × ${map.height} ช่อง`],
    ["ขนาด logical tile", `${map.tileWidthPx} × ${map.tileHeightPx} px`],
    ["ไฟล์กราฟิกที่ใช้", `${layerCount} รายการในทุกเลเยอร์`],
    ["ช่องกั้นการเดิน", `${blocked} ช่อง`],
    ["เลเยอร์", "BG1 → BG2 → ผู้เล่น → FG"]
  ].map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
}

function validateMap(map) {
  if (!map || map.format !== "Layered PNG Map Builder") {
    throw new Error("รูปแบบแผนที่ไม่ใช่ Layered PNG Map Builder");
  }
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) ||
      map.width < 1 || map.height < 1) {
    throw new Error("ขนาดแผนที่ไม่ถูกต้อง");
  }
  if (!Array.isArray(map.cells) || map.cells.length !== map.width * map.height) {
    throw new Error("จำนวนข้อมูล cells ไม่ตรงกับขนาดแผนที่");
  }
}

const loadMap = window.location.protocol === "file:"
  ? Promise.resolve(window.LETTER_MAZE_LAYERED_MAP)
  : fetch("./layered_map_40x40.txt").then((response) => {
    if (!response.ok) throw new Error(`โหลด layered_map_40x40.txt ไม่สำเร็จ (${response.status})`);
    return response.json();
  });

loadMap.then((map) => {
  validateMap(map);
  renderMap(map);
  renderDetails(map);
  status.textContent = "โหลดสำเร็จ — ใช้รูปแบบ BG2 + FG Scale ตาม builder รุ่นล่าสุด";
}).catch((error) => {
  status.textContent = `โหลดแผนที่ไม่สำเร็จ: ${error.message}`;
  status.style.color = "#ff8d8d";
});
