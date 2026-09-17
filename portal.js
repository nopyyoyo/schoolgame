(function () {
  "use strict";

  const players = window.PORTAL_PLAYERS || [];
  const supabaseConfig = window.SUPABASE_CONFIG;
  const supabase = window.supabase && supabaseConfig
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
    : null;
  const root = document.querySelector("#player-view");
  const shopRoot = document.querySelector("#shop-view");
  const siteRoot = new URL("./", document.baseURI).href;
  const image = (player) => `${siteRoot}Character/Cut/Player/${player.face}/face.png`;
  const params = new URLSearchParams(window.location.search);
  const selected = players.find((player) => player.id === params.get("player"));
  const categoryNames = { weapon: "อาวุธ", armor: "เกราะ", shield: "โล่", accessory: "เครื่องประดับ", item: "ไอเทม" };
  const catalogFiles = {
    weapon: "config/catalog-weapon.csv",
    armor: "config/catalog-armor.csv",
    shield: "config/catalog-shield.csv",
    accessory: "config/catalog-accessory.csv",
    item: "config/catalog-item.csv"
  };
  const demoCatalog = {
    weapon: [
      ["weapon_01", "weapon_01.png", "กระบองทองแดง", "กระบองเรียบง่ายสำหรับผู้เริ่มต้น", 10],
      ["weapon_02", "weapon_02.png", "คทาเหล็ก", "คทาแข็งแรงที่จับถนัดมือ", 15],
      ["weapon_03", "weapon_03.png", "มีดฝึกหัด", "มีดน้ำหนักเบาที่ใช้งานได้ง่าย", 12],
      ["weapon_04", "weapon_04.png", "ดาบสั้น", "ดาบสั้นที่ไว้ใจได้ในการต่อสู้", 20],
      ["weapon_05", "weapon_05.png", "ดาบสายลม", "ดาบที่ช่วยให้ผู้ถือเคลื่อนไหวได้รวดเร็ว", 28]
    ],
    armor: [
      ["armor_01", "armor_01.png", "เสื้อคลุมผ้าฝ้าย", "เสื้อคลุมน้ำหนักเบาสำหรับการเดินทางทั่วไป", 10],
      ["armor_02", "armor_02.png", "เสื้อเกราะหนัง", "เสื้อเกราะหนังที่ยืดหยุ่น", 18]
    ],
    shield: [["shield_01", "shield_01.png", "โล่ไม้กลม", "โล่ไม้ขนาดเล็กสำหรับนักผจญภัยมือใหม่", 8]],
    accessory: [],
    item: [
      ["item_01", "item_01.png", "สมุนไพรรักษา", "ฟื้นฟูพลังชีวิตจำนวนเล็กน้อย", 5],
      ["item_04", "item_04.png", "ใบไม้คืนชีพ", "ชุบชีวิตผู้เล่นที่ล้มลงหนึ่งคน", 20]
    ]
  };
  const categoryFolder = { weapon: "Weapon", armor: "Armor", shield: "Shield", accessory: "Accessory", item: "Item" };
  const categoryPrefix = { weapon: "weapon", armor: "armor", shield: "shield", accessory: "accessory", item: "item" };
  const catalogCache = { weapon: [], armor: [], shield: [], accessory: [], item: [] };
  let skillCache = [];
  players.forEach((player) => {
    player.equipped = player.equipped || { weapon: null, armor: null, shield: null, accessory: null };
    player.ownedEquipment = player.ownedEquipment || [];
    player.ownedItems = player.ownedItems || [];
  });
  function assetPath(category, fileName) {
    return `${categoryFolder[category]}/Cut/${fileName}`;
  }

  function statMarkup(player) {
    return `<div class="stat-line"><span>พลังชีวิต</span><strong>${player.hpMax}</strong></div>
      <div class="stat-line"><span>พลังเวท</span><strong>${player.mpMax}</strong></div>
      <div class="stat-line"><span>โจมตี</span><strong>${player.attack}</strong></div>
      <div class="stat-line"><span>ป้องกัน</span><strong>${player.defense}</strong></div>
      <div class="stat-line"><span>ความเร็ว</span><strong>${player.speed}</strong></div>
      <div class="stat-line"><span>ปัญญา</span><strong>${player.wisdom}</strong></div>`;
  }

  function applyEquipmentStats(player) {
    const base = player.baseStats || player;
    const equipment = Object.values(player.equippedItems || {}).filter(Boolean);
    const totals = equipment.reduce((sum, item) => ({
      hp_stat: sum.hp_stat + Number(item.hp_stat || 0),
      mp_stat: sum.mp_stat + Number(item.mp_stat || 0),
      attack_stat: sum.attack_stat + Number(item.attack_stat || 0),
      defend_stat: sum.defend_stat + Number(item.defend_stat || 0),
      speed_stat: sum.speed_stat + Number(item.speed_stat || 0)
    }), { hp_stat: 0, mp_stat: 0, attack_stat: 0, defend_stat: 0, speed_stat: 0 });
    Object.assign(player, {
      hpMax: Number(base.hpMax) + totals.hp_stat,
      mpMax: Number(base.mpMax) + totals.mp_stat,
      attack: Number(base.attack) + totals.attack_stat,
      defense: Number(base.defense) + totals.defend_stat,
      speed: Number(base.speed) + totals.speed_stat
    });
  }

  function skillMarkup(player) {
    const skills = Object.values(player.equippedItems || {}).flatMap((item) =>
      ["skill_id1", "skill_id2", "skill_id3", "skill_id4"]
        .map((key) => skillCache.find((skill) => skill.id === item[key]))
        .filter(Boolean)
    );
    const unique = [...new Map(skills.map((skill) => [skill.id, skill])).values()];
    return `<p class="player-skills"><strong>ทักษะ:</strong> ${unique.length
      ? unique.map((skill) => `<span>${skill.skill_name}</span>`).join(" ")
      : "ไม่มี"}</p>`;
  }

  function playerCard(player) {
    return `<a class="player-card" href="?player=${player.id}">
      <div class="face"><img src="${image(player)}" alt="${player.name}"></div>
      <div><h3>${player.name}</h3><p class="money">เงิน: ${player.money} เหรียญ</p>${statMarkup(player)}${skillMarkup(player)}<p class="equipped-summary">${equippedSummary(player)}</p></div>
    </a>`;
  }

  function playerTeam(player) {
    const team = typeof player.team === "string" ? player.team.toLowerCase() : "";
    if (["red", "blue", "green"].includes(team)) return team;
    return Number(player.id.slice(1)) <= 3 ? "red" : Number(player.id.slice(1)) <= 6 ? "blue" : "green";
  }

  function equippedSummary(player) {
    const names = ["weapon", "armor", "shield", "accessory"].map((category) => {
      const item = findDemoItem(category, player.equipped?.[category]);
      return `${categoryNames[category]}: ${item ? item.item_name : "ไม่มี"}`;
    });
    return `<span>${names.join("<br>")}</span>`;
  }

  function shopLinks() {
    const suffix = selected ? `&player=${selected.id}` : "";
    return `<nav class="shop-links" aria-label="ร้านค้า">
      ${Object.entries(categoryNames).map(([key, name]) => `<a class="button" href="?shop=${key}${suffix}">${name}</a>`).join("")}
    </nav>`;
  }

  function renderLanding() {
    root.innerHTML = `<section class="team team-red"><h2>ทีมสีแดง</h2><div class="player-grid">${players.filter((p) => playerTeam(p) === "red").map(playerCard).join("")}</div></section>
      <section class="team team-blue"><h2>ทีมสีน้ำเงิน</h2><div class="player-grid">${players.filter((p) => playerTeam(p) === "blue").map(playerCard).join("")}</div></section>
      <section class="team team-green"><h2>ทีมสีเขียว</h2><div class="player-grid">${players.filter((p) => playerTeam(p) === "green").map(playerCard).join("")}</div></section>${shopLinks()}`;
  }

  async function loadPublicPlayerSummary() {
    if (!supabase) throw new Error("Supabase is not configured");
    try {
      const { data, error } = await supabase.functions.invoke("get-public-player-summary", { body: {} });
      if (error || !data?.players) throw new Error(data?.error || error?.message || "Could not load players");
      data.players.forEach((summary) => {
        const player = players.find((entry) => entry.id === summary.id);
        if (!player) return;
        const equipped = summary.equipped || {};
        Object.assign(player, {
          team: ["red", "blue", "green"].includes(String(summary.team).toLowerCase())
            ? String(summary.team).toLowerCase()
            : player.team,
          name: summary.name || player.name,
          face: summary.face || player.face,
          hpMax: summary.hp_max ?? player.hpMax,
          mpMax: summary.mp_max ?? player.mpMax,
          attack: summary.attack ?? player.attack,
          defense: summary.defense ?? player.defense,
          speed: summary.speed ?? player.speed,
          wisdom: summary.wisdom ?? player.wisdom,
          money: summary.money ?? player.money,
          equipped: Object.fromEntries(Object.entries(equipped).map(([category, item]) => [category, item?.id || null])),
          baseStats: { hpMax: summary.hp_max, mpMax: summary.mp_max, attack: summary.attack, defense: summary.defense, speed: summary.speed, wisdom: summary.wisdom },
          equippedItems: equipped
        });
        Object.entries(equipped).forEach(([category, item]) => {
          if (item && catalogCache[category] && !catalogCache[category].some((entry) => entry.id === item.id)) {
            catalogCache[category].push(item);
          }
        });
        applyEquipmentStats(player);
      });
    } catch (error) {
      console.error("Could not load public player summary", error);
      throw error;
    }
  }

  function renderProfile(player) {
    root.innerHTML = `<section class="profile">
      <div class="profile-face"><img src="${image(player)}" alt="${player.name}"></div>
      <div><p class="eyebrow">${player.team === "red" ? "ทีมสีแดง" : player.team === "green" ? "ทีมสีเขียว" : "ทีมสีน้ำเงิน"}</p><h2>${player.name}</h2><div>${statMarkup(player)}</div><p class="money">เงิน: ${player.money}</p>${skillMarkup(player)}</div>
    </section>
    <section class="team"><h2>อุปกรณ์ที่สวมใส่</h2><div class="slots">
      ${["weapon","armor","shield","accessory"].map((category) => {
        const id = player.equipped?.[category];
        const item = findDemoItem(category, id);
        return `<article class="slot"><h3>${categoryNames[category]}</h3>${item ? catalogMarkup(category, item, "สวมใส่อยู่", "equipped") : "<p>ยังไม่มีอุปกรณ์</p>"}</article>`;
      }).join("")}
    </div></section>
    <section class="team"><h2>อุปกรณ์ในคลัง</h2><div class="owned-grid">${(player.ownedEquipment || []).map((owned) => {
      const item = findDemoItem(owned.category, owned.id);
      return item ? `<article class="catalog-card">${catalogMarkup(owned.category, item, "คลิกเพื่อดูรายละเอียด", "owned")}</article>` : "";
    }).join("") || "<p>ยังไม่มีอุปกรณ์ในคลัง</p>"}</div>
    <h2 class="subheading">ไอเทมในคลัง</h2><div class="owned-grid">${(player.ownedItems || []).map((id) => {
      const item = findDemoItem("item", id);
      return item ? `<article class="catalog-card">${catalogMarkup("item", item, "จำนวน 1", "owned-item")}</article>` : "";
    }).join("") || "<p>ยังไม่มีไอเทมในคลัง</p>"}</div></section>${shopLinks()}`;
  }

  function findDemoItem(category, id) {
    if (!id) return null;
    const cached = (catalogCache[category] || []).find((item) => item.id === id);
    if (cached) return cached;
    const row = (demoCatalog[category] || []).find((item) => item[0] === id);
    return row ? { id: row[0], photo_file_name: row[1], item_name: row[2], item_description: row[3], item_price: row[4] } : null;
  }

  function catalogMarkup(category, item, note, context) {
    return `<img class="catalog-image" src="${assetPath(category, item.photo_file_name)}" alt="${item.item_name}">
      <h3>${item.item_name}</h3><p>${item.item_description}</p>${category === "item" ? "" : equipmentDetails(item)}<p>ราคา: ${item.item_price} เหรียญ</p>${note ? `<p class="catalog-note">${note}</p>` : ""}
      ${context === "owned" ? `<button data-action="equip" data-category="${category}" data-id="${item.id}">สวมใส่</button><button data-action="sell" data-category="${category}" data-id="${item.id}">ขาย</button>` : ""}
      ${context === "owned-item" ? `<button data-action="sell" data-category="item" data-id="${item.id}">ขาย</button>` : ""}
      ${context === "equipped" ? `<button data-action="unequip" data-category="${category}" data-id="${item.id}">ถอดอุปกรณ์</button>` : ""}`;
  }

  function equipmentDetails(item) {
    const stats = [
      ["โจมตี", item.attack_stat], ["ป้องกัน", item.defend_stat], ["ความเร็ว", item.speed_stat],
      ["พลังชีวิต", item.hp_stat], ["พลังเวท", item.mp_stat]
    ].filter(([, value]) => Number(value) !== 0)
      .map(([label, value]) => `<span>${label} ${Number(value) > 0 ? "+" : ""}${value}</span>`);
    const skills = ["skill_id1", "skill_id2", "skill_id3", "skill_id4"]
      .map((key) => skillCache.find((skill) => skill.id === item[key]))
      .filter(Boolean)
      .map((skill) => `<span class="equipment-skill">${skill.skill_name}</span>`);
    return `<div class="equipment-details">${stats.concat(skills).join(" ") || "<span>ไม่มีโบนัส</span>"}</div>`;
  }

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines.shift().split(",");
    return lines.map((line) => {
      const values = line.match(/("[^"]*"|[^,]*)/g).filter((value, index, all) => index < headers.length).map((value) => value.replace(/^"|"$/g, ""));
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    });
  }

  async function loadSupabaseCatalog(category) {
    if (!supabase) return null;
    const table = category === "item" ? "item_catalog" : "equipment_catalog";
    const query = supabase.from(table).select("*").eq("active", true);
    if (category !== "item") query.eq("category", category);
    const { data, error } = await query.order("id");
    if (error || !data?.length) return null;
    return data.map((item) => ({
      ...item,
      item_price: item.item_price,
      photo_file_name: item.photo_file_name
    }));
  }

  async function loadSkills() {
    if (skillCache.length) return;
    if (supabase) {
      const { data } = await supabase.from("skill_catalog").select("*").eq("active", true).order("id");
      if (data?.length) {
        skillCache = data;
        return;
      }
    }
    const response = await fetch("config/catalog-skill.csv");
    if (response.ok) skillCache = parseCsv(await response.text());
  }

  async function renderShop(category) {
    root.innerHTML = `<section class="team"><h2>ร้าน${categoryNames[category]}</h2><p>กำลังโหลดรายการ...</p>${shopLinks()}</section>`;
    try {
      if (category !== "item") await loadSkills();
      const remoteRows = await loadSupabaseCatalog(category);
      if (remoteRows) {
        catalogCache[category] = remoteRows;
        root.querySelector(".team").innerHTML = shopMarkup(category, remoteRows);
        return;
      }

      const response = await fetch(catalogFiles[category]);
      if (!response.ok) throw new Error(`โหลด ${catalogFiles[category]} ไม่สำเร็จ`);
      const rows = parseCsv(await response.text());
      catalogCache[category] = rows;
      root.querySelector(".team").innerHTML = shopMarkup(category, rows);
    } catch (error) {
      root.querySelector(".team").innerHTML = shopMarkup(category, (demoCatalog[category] || []).map((row) => ({
        id: row[0], photo_file_name: row[1], item_name: row[2], item_description: row[3], item_price: row[4]
      })));
    }
  }

  async function loadAllCatalogs() {
    await Promise.all([loadSkills(), ...Object.keys(categoryNames).map(async (category) => {
      if (catalogCache[category].length) return;
      const rows = await loadSupabaseCatalog(category);
      if (rows) catalogCache[category] = rows;
    })]);
  }

  function shopMarkup(category, rows) {
    const canBuy = Boolean(selected);
    return `<h2>ร้าน${categoryNames[category]}</h2><p class="demo-note">${canBuy ? "ร้านค้าของผู้เล่น: สามารถซื้อสินค้าได้" : "หน้าสำหรับเลือกดูสินค้าเท่านั้น"}</p><div class="catalog-grid">${rows.map((item) => `<article class="catalog-card">${catalogMarkup(category, item, canBuy ? "ซื้อสินค้า" : "", "shop")}${canBuy ? `<button data-action="buy" data-category="${category}" data-id="${item.id}">ซื้อสินค้า</button>` : ""}</article>`).join("") || "<p>ยังไม่มีรายการ</p>"}</div>${shopLinks()}`;
  }

  async function authenticateOnlinePlayer(player, passcode) {
    if (!supabase) return null;
    const { data: authData, error: authError } = await supabase.functions.invoke("authenticate-player", {
      body: { player_id: player.id, passcode }
    });
    if (authError || !authData?.token) {
      throw new Error(authData?.error || "เข้าสู่ระบบไม่สำเร็จ");
    }
    const { data: portalData, error: portalError } = await supabase.functions.invoke("get-player-portal", {
      body: { token: authData.token }
    });
    if (portalError || !portalData?.player) {
      throw new Error(portalData?.error || "โหลดข้อมูลผู้เล่นไม่สำเร็จ");
    }
    sessionStorage.setItem(`school-game-player-session-${player.id}`, JSON.stringify({
      token: authData.token,
      expires_at: authData.expires_at
    }));
    return portalData;
  }

  function applyOnlinePlayerData(player, portalData) {
    const remote = portalData.player;
    const equipmentEntries = (portalData.equipment || []).map((entry) => ({
      ...entry,
      equipment_catalog: Array.isArray(entry.equipment_catalog)
        ? entry.equipment_catalog[0]
        : entry.equipment_catalog
    }));
    const equippedItems = Object.fromEntries((portalData.equipped_equipment || []).map((item) => [item.category, item]));
    Object.assign(player, {
      team: remote.team,
      name: remote.name,
      face: remote.face,
      baseStats: { hpMax: remote.hp_max, mpMax: remote.mp_max, attack: remote.attack, defense: remote.defense, speed: remote.speed, wisdom: remote.wisdom },
      hpMax: remote.hp_max,
      mpMax: remote.mp_max,
      attack: remote.attack,
      defense: remote.defense,
      speed: remote.speed,
      wisdom: remote.wisdom,
      money: remote.money,
      equipped: {
        weapon: remote.equipped_weapon_id,
        armor: remote.equipped_armor_id,
        shield: remote.equipped_shield_id,
        accessory: remote.equipped_accessory_id
      },
      ownedEquipment: equipmentEntries.map((entry) => ({
        category: entry.equipment_catalog?.category || entry.equipment_id.split("_")[0],
        id: entry.equipment_id,
        quantity: entry.quantity
      })),
      ownedItems: (portalData.items || []).flatMap((entry) => Array(entry.quantity).fill(entry.item_id)),
      equippedItems
    });
    equipmentEntries.forEach((entry) => {
      if (entry.equipment_catalog) {
        catalogCache[entry.equipment_catalog.category].push(entry.equipment_catalog);
      }
    });
    (portalData.items || []).forEach((entry) => {
      if (entry.item_catalog) catalogCache.item.push(entry.item_catalog);
    });
  }

  async function handleTransaction(button) {
    const player = selected;
    const category = button.dataset.category;
    const id = button.dataset.id;
    const action = button.dataset.action;
    if (!player || !id || !["buy", "sell", "equip", "unequip"].includes(action)) return;
    const session = JSON.parse(sessionStorage.getItem(`school-game-player-session-${player.id}`) || "null");
    if (!supabase || !session?.token || session.token === "local-demo") {
      return window.alert("ต้องเชื่อมต่อ Supabase เพื่อทำรายการ");
    }
    button.disabled = true;
    try {
      const { data, error } = await supabase.functions.invoke("process-portal-transaction", {
        body: { token: session.token, action, category, catalog_id: id, request_id: crypto.randomUUID() }
      });
      if (error || !data?.success) {
        let serverMessage = data?.error || error?.message;
        if (!serverMessage && error?.context && typeof error.context.json === "function") {
          try {
            const responseBody = await error.context.json();
            serverMessage = responseBody?.error;
          } catch {
            // The response body may already have been consumed by the client.
          }
        }
        throw new Error(serverMessage || "ทำรายการไม่สำเร็จ กรุณาตรวจสอบการติดตั้งฟังก์ชัน Supabase");
      }
      const refreshed = await supabase.functions.invoke("get-player-portal", { body: { token: session.token } });
      if (refreshed.error || !refreshed.data?.player) throw new Error("โหลดข้อมูลหลังทำรายการไม่สำเร็จ");
      applyOnlinePlayerData(player, refreshed.data);
      if (action === "buy") {
        window.location.href = `?player=${player.id}`;
      } else if (params.get("shop") && categoryNames[params.get("shop")]) {
        renderShop(params.get("shop"));
      } else {
        renderProfile(player);
      }
    } catch (error) {
      window.alert(error.message || "ทำรายการไม่สำเร็จ");
      button.disabled = false;
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button) {
      event.preventDefault();
      void handleTransaction(button);
    }
  });

  async function authenticatePlayer(player) {
    const sessionKey = `school-game-player-session-${player.id}`;
    const savedSession = JSON.parse(sessionStorage.getItem(sessionKey) || "null");
    if (savedSession?.token && (!savedSession.expires_at || new Date(savedSession.expires_at).getTime() > Date.now())) {
      try {
        const { data, error } = await supabase.functions.invoke("get-player-portal", {
          body: { token: savedSession.token }
        });
        if (!error && data?.player) {
          applyOnlinePlayerData(player, data);
          return true;
        }
      } catch (error) {
        sessionStorage.removeItem(sessionKey);
      }
    }
    const passcode = window.prompt(`กรอกรหัสผ่านของ ${player.name}`);
    if (!passcode) return false;
    try {
      if (supabase) {
        const data = await authenticateOnlinePlayer(player, passcode);
        applyOnlinePlayerData(player, data);
        return true;
      }
      if (passcode !== "6767") throw new Error("รหัสผ่านไม่ถูกต้อง");
      sessionStorage.setItem(sessionKey, JSON.stringify({ token: "local-demo", expires_at: null }));
      return true;
    } catch (error) {
      window.alert(error.message || "เข้าสู่ระบบไม่สำเร็จ");
      window.location.href = "index.html";
      return false;
    }
  }

  async function startPage() {
    if (selected && await authenticatePlayer(selected)) {
      if (params.get("shop") && categoryNames[params.get("shop")]) renderShop(params.get("shop"));
      else {
        await loadAllCatalogs();
        renderProfile(selected);
      }
    } else if (!selected && params.get("shop") && categoryNames[params.get("shop")]) {
      renderShop(params.get("shop"));
    } else if (!selected) {
      try {
        await loadSkills();
        await loadPublicPlayerSummary();
      } catch (error) {
        root.innerHTML = `<section class="team"><h2>ไม่สามารถโหลดข้อมูลผู้เล่นได้</h2><p>กรุณาลองใหม่อีกครั้ง</p></section>`;
        return;
      }
      renderLanding();
    }
  }

  startPage();
}());
