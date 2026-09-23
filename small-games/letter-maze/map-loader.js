(function () {
  "use strict";

  function validateLayeredMap(map) {
    if (!map || map.format !== "Layered PNG Map Builder" || map.version < 2) {
      throw new Error("Unsupported layered map format.");
    }
    if (!Number.isInteger(map.width) || !Number.isInteger(map.height) ||
        map.width < 1 || map.height < 1 || map.width > 200 || map.height > 200) {
      throw new Error("Map width and height must be valid integers.");
    }
    if (!Number.isFinite(map.tileWidthPx) || !Number.isFinite(map.tileHeightPx) ||
        map.tileWidthPx < 1 || map.tileHeightPx < 1) {
      throw new Error("Map tile dimensions are invalid.");
    }
    if (!Array.isArray(map.cells) || map.cells.length !== map.width * map.height) {
      throw new Error("Map cell count does not match its dimensions.");
    }
    for (const [index, cell] of map.cells.entries()) {
      if (!cell || typeof cell !== "object") {
        throw new Error(`Map cell ${index} is invalid.`);
      }
      for (const layer of ["bg1", "bg2", "fg"]) {
        if (cell[layer] !== null && typeof cell[layer] !== "string") {
          throw new Error(`Map cell ${index} has an invalid ${layer} filename.`);
        }
      }
      if (typeof cell.collision !== "boolean") {
        throw new Error(`Map cell ${index} has invalid collision data.`);
      }
    }
    for (const field of ["bg2ScalePercent", "fgScalePercent"]) {
      if (!Number.isFinite(map[field]) || map[field] < 1 || map[field] > 200) {
        throw new Error(`${field} must be between 1 and 200.`);
      }
    }
    return map;
  }

  async function loadLayeredMap(url) {
    if (window.location.protocol === "file:" && window.LETTER_MAZE_LAYERED_MAP) {
      return validateLayeredMap(window.LETTER_MAZE_LAYERED_MAP);
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Map request failed (${response.status}).`);
    }
    return validateLayeredMap(await response.json());
  }

  window.LayeredMapLoader = { load: loadLayeredMap, validate: validateLayeredMap };
}());
