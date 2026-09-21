const ASSET_ROOT = "../../";
const LETTER_ROOT = `${ASSET_ROOT}Small games/Thai_44_Rectangle_Crops/`;
const CHARACTER_ROOT = `${ASSET_ROOT}Character/Cut/Player/`;
const TILE_ROOT = `${ASSET_ROOT}Small games/Tiles/PNG/`;
const stage = document.querySelector("#map-stage");
const details = document.querySelector("#map-details");
const status = document.querySelector("#preview-status");

const assetUrl = (root, file) => `${root}${encodeURIComponent(file).replaceAll("%2F", "/")}`;

function createImage(className, source, alt) {
  const image = document.createElement("img");
  image.className = className;
  image.src = source;
  image.alt = alt;
  return image;
}

function renderMap(map) {
  const cellSize = map.tileSize;
  stage.style.width = `${map.width * cellSize}px`;
  stage.style.height = `${map.height * cellSize}px`;

  map.grid.forEach((row, y) => {
    [...row].forEach((symbol, x) => {
      const tile = map.tiles[symbol];
      const cell = document.createElement("div");
      cell.className = "map-cell";
      cell.style.left = `${x * cellSize}px`;
      cell.style.top = `${y * cellSize}px`;
      cell.style.backgroundImage = `url("${assetUrl(TILE_ROOT, tile.image)}")`;
      if (tile.prop) {
        cell.append(createImage("prop", assetUrl(TILE_ROOT, tile.prop), "สิ่งกีดขวาง"));
      }
      stage.append(cell);
    });
  });

  const player = map.playerStart;
  stage.append(createImage(
    "map-object character player",
    `${CHARACTER_ROOT}${player.characterFolder}/action_15.png`,
    "ผู้เล่น"
  ));
  stage.lastChild.style.left = `${player.x * cellSize}px`;
  stage.lastChild.style.top = `${player.y * cellSize}px`;

  map.enemyStarts.forEach((enemy) => {
    const image = createImage(
      "map-object character enemy",
      `${CHARACTER_ROOT}${enemy.characterFolder}/action_15.png`,
      "ศัตรู"
    );
    image.style.left = `${enemy.x * cellSize}px`;
    image.style.top = `${enemy.y * cellSize}px`;
    stage.append(image);
  });

  map.letters.forEach((letter) => {
    const image = createImage(
      "map-object letter",
      assetUrl(LETTER_ROOT, `${letter.id}.png`),
      `ตัวอักษร ${letter.id}`
    );
    image.style.left = `${letter.x * cellSize}px`;
    image.style.top = `${letter.y * cellSize}px`;
    stage.append(image);
  });

  const viewport = document.querySelector("#map-viewport");
  viewport.classList.add("full-map");
  viewport.style.setProperty("--map-width", `${map.width * cellSize}px`);
  viewport.style.setProperty("--map-height", `${map.height * cellSize}px`);
}

function renderDetails(map) {
  const walkable = map.grid.join("").split("").filter((symbol) => map.tiles[symbol].walkable).length;
  details.innerHTML = [
    ["ขนาดแผนที่", `${map.width} × ${map.height} ช่อง`],
    ["ช่องเดินได้", `${walkable} ช่อง`],
    ["ผู้เล่นเริ่มต้น", `(${map.playerStart.x}, ${map.playerStart.y})`],
    ["ศัตรูเริ่มต้น", `${map.enemyStarts.length} ตัว`],
    ["ตัวอักษรที่แสดง", `${map.letters.length} ตัว`]
  ].map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
}

const loadMap = window.location.protocol === "file:"
  ? Promise.resolve(window.LETTER_MAZE_PREVIEW_MAP)
  : fetch("./map.json").then((response) => {
    if (!response.ok) throw new Error(`โหลด map.json ไม่สำเร็จ (${response.status})`);
    return response.json();
  });

loadMap
  .then((map) => {
    if (!map) throw new Error("ไม่พบข้อมูลแผนที่สำหรับโหมดเปิดไฟล์โดยตรง");
    if (map.grid.length !== map.height || map.grid.some((row) => [...row].length !== map.width)) {
      throw new Error("จำนวนแถวหรือความกว้างของ grid ไม่ตรงกับ metadata");
    }
    renderMap(map);
    renderDetails(map);
    status.textContent = "โหลดสำเร็จ — ลำดับตัวอักษรใน preview ถูกกำหนดตายตัว";
  })
  .catch((error) => {
    status.textContent = `โหลดแผนที่ไม่สำเร็จ: ${error.message}`;
    status.style.color = "#ff8d8d";
  });
