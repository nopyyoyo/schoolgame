(function () {
  "use strict";

  const config = window.BATTLE_CONFIG;
  let characterConfig = { players: [], enemies: [] };
  const rosterConfig = window.BATTLE_ROSTER_CONFIG;
  const supabaseConfig = window.SUPABASE_CONFIG;
  const supabase = window.supabase && supabaseConfig
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey)
    : null;
  const musicConfig = window.MUSIC_CONFIG;
  const soundConfig = window.SOUND_CONFIG;
  const enemyAiConfig = window.ENEMY_AI_CONFIG;
  const $ = (selector) => document.querySelector(selector);
  const asset = (path) => `../Character/Cut/${path}`;
  let state;
  const battleMusic = new Audio(musicConfig.battle);
  const victoryMusic = new Audio(musicConfig.victory);
  battleMusic.loop = true;
  battleMusic.volume = musicConfig.battleVolume;
  victoryMusic.volume = musicConfig.victoryVolume;
  let audioStarted = false;
  const soundVolumes = soundConfig.volumes || {};
  $("#restart-button").disabled = true;

  async function loadCharactersFromSupabase() {
    if (!supabase) throw new Error("Supabase is not configured");
    const battleParams = new URLSearchParams(window.location.search);
    const requestedLevel = Number(battleParams.get("level"));
    const requestedTeam = battleParams.get("team");
    const level = Array.isArray(window.BATTLE_LEVELS)
      ? window.BATTLE_LEVELS.find((entry) => entry.id === requestedLevel && entry.open)
      : null;
    if (battleParams.has("level") && !level) {
      throw new Error("This battle level is not open");
    }
    const playerIds = requestedTeam
      ? null
      : rosterConfig?.playerIds;
    const enemyIds = level ? level.enemyIds : rosterConfig?.enemyIds;
    if ((!requestedTeam && !Array.isArray(playerIds)) || !Array.isArray(enemyIds) ||
        (Array.isArray(playerIds) && (playerIds.length < 1 || playerIds.length > 4)) ||
        enemyIds.length < 1 || enemyIds.length > 4) {
      throw new Error("Battle roster must contain 1 to 4 players and 1 to 4 enemies");
    }
    if (requestedTeam && !["teacher", "red", "green", "blue"].includes(requestedTeam)) {
      throw new Error("Invalid battle team");
    }
    if (!Array.isArray(playerIds) && !requestedTeam) {
      throw new Error("Battle roster has no player IDs");
    }
    if (new Set(enemyIds).size !== enemyIds.length) {
      throw new Error("Battle roster cannot contain duplicate character IDs");
    }
    const { data, error } = await supabase.functions.invoke("get-public-player-summary", { body: {} });
    if (error || !Array.isArray(data?.players)) {
      throw new Error(data?.error || error?.message || "Could not load battle characters");
    }
    const byId = new Map(data.players.map((character) => [character.id, character]));
    const getCharacter = (id, role) => {
      const character = byId.get(id);
      if (!character || (role && character.role !== role)) {
        throw new Error(`Character ${id} is missing or has the wrong role`);
      }
      return character;
    };
    const players = (requestedTeam
      ? data.players.filter((character) => character.team === requestedTeam).map((character) => character.id)
      : playerIds).map((id) => {
      const character = getCharacter(id, requestedTeam ? null : "player");
      return {
        id: character.id,
        name: character.name,
        face: character.face,
        hpMax: Number(character.hp_max),
        mpMax: Number(character.mp_max),
        attack: Number(character.attack),
        defense: Number(character.defense),
        speed: Number(character.speed),
        wisdom: Number(character.wisdom)
      };
    });
    if (players.length < 1 || players.length > 4) {
      throw new Error("Selected team must contain 1 to 4 players");
    }
    const enemies = enemyIds.map((id) => {
      const character = getCharacter(id, "enemy");
      return {
        id: character.id,
        name: character.name,
        image: character.face,
        hpMax: Number(character.hp_max),
        mpMax: Number(character.mp_max),
        attack: Number(character.attack),
        defense: Number(character.defense),
        speed: Number(character.speed),
        wisdom: Number(character.wisdom)
      };
    });
    characterConfig = { players, enemies };
  }

  function playSound(name) {
    const sound = new Audio(soundConfig[name]);
    sound.volume = soundVolumes[name] ?? 1;
    sound.play().catch(() => {});
  }

  function startBattleMusic() {
    if (audioStarted || state?.ended) return;
    audioStarted = true;
    battleMusic.play().catch(() => {
      audioStarted = false;
    });
  }

  function newCharacter(template, team) {
    return { ...template, team, hpCurrent: template.hpMax, mpCurrent: template.mpMax, cooldownPoint: 0, alive: true, defending: false, actionState: 1 };
  }

  function setPlayerAction(player, action) {
    if (player?.team === "player" && player.alive) player.actionState = action;
  }

  function setPlayerIdle(player) {
    if (player?.team === "player" && player.alive) {
      setPlayerAction(player, player.hpCurrent / player.hpMax < 0.2 ? 9 : 1);
    }
  }

  function prepareActor(character) {
    if (character.team === "player") {
      setPlayerAction(character, 2);
      playSound("playerTurn");
    }
  }

  function resetBattle() {
    battleMusic.pause();
    battleMusic.currentTime = 0;
    victoryMusic.pause();
    victoryMusic.currentTime = 0;
    audioStarted = false;
    state = {
      players: characterConfig.players.map((character) => newCharacter(character, "player")),
      enemies: characterConfig.enemies.map((character) => newCharacter(character, "enemy")),
      acting: null,
      readyQueue: [],
      pendingCommand: null,
      calculation: 0,
      message: "เริ่มการต่อสู้",
      awaitingContinue: false,
      resultEffect: null,
      pendingEnemyDeaths: [],
      enemyBlinking: false,
      ended: false,
      timer: null
    };
    $("#battle-result").classList.add("hidden");
    $("#battle-result").textContent = "";
    render();
    scheduleCalculation();
  }

  function living(team) {
    return state[team].filter((character) => character.alive);
  }

  function allCharacters() {
    return [...state.players, ...state.enemies];
  }

  function activateNextQueuedActor() {
    state.acting = null;
    while (state.readyQueue.length) {
      const next = state.readyQueue.shift();
      if (!next.alive) continue;
      state.acting = next;
      state.pendingCommand = null;
      state.message = `${next.name} พร้อมดำเนินการ`;
      prepareActor(next);
      scheduleEnemyAi();
      return true;
    }
    return false;
  }

  function scheduleCalculation() {
    clearTimeout(state.timer);
    if (!state.ended && !state.awaitingContinue && !state.acting && !state.readyQueue.length) {
      state.timer = setTimeout(calculate, config.calculationIntervalMs);
    }
  }

  function calculate() {
    state.calculation += 1;
    allCharacters().filter((character) => character.alive).forEach((character) => {
      character.cooldownPoint += character.speed;
    });
    const ready = allCharacters()
      .filter((character) => character.alive && character.cooldownPoint >= config.cooldownThreshold)
      .sort((a, b) => b.cooldownPoint - a.cooldownPoint || b.speed - a.speed || Math.random() - 0.5);
    if (ready.length) {
      state.readyQueue = ready;
      activateNextQueuedActor();
      render();
      return;
    }
    render();
    scheduleCalculation();
  }

  function scheduleEnemyAi() {
    if (state.ended || state.acting?.team !== "enemy" || enemyAiConfig.control !== "ai") return;
    setTimeout(runEnemyAi, 350);
  }

  function runEnemyAi() {
    if (state.ended || state.awaitingContinue || state.acting?.team !== "enemy") return;
    const targets = living("players");
    if (!targets.length) {
      checkBattleEnd();
      return;
    }
    const strategy = enemyAiConfig.strategies[enemyAiConfig.selectedStrategy]
      || enemyAiConfig.strategies.always_attack_random;
    const useSkill = Math.random() >= strategy.attackChance && strategy.skillChance > 0;
    if (useSkill) {
      state.message = `${state.acting.name} ต้องการใช้ทักษะ แต่ทักษะยังไม่พร้อมใช้งาน`;
    }
    const target = targets[Math.floor(Math.random() * targets.length)];
    chooseTarget(target);
  }

  function finishTurn(character) {
    character.cooldownPoint = 0;
    character.defending = false;
    state.pendingCommand = null;
    checkBattleEnd();
    state.acting = null;
    state.awaitingContinue = !state.ended;
    render();
    if (state.ended) scheduleCalculation();
  }

  function continueAfterResult() {
    if (!state.awaitingContinue || state.ended) return;
    state.awaitingContinue = false;
    state.resultEffect = null;
    state.pendingEnemyDeaths.forEach((enemy) => {
      enemy.deathPending = false;
      playSound("enemyDeath");
    });
    state.pendingEnemyDeaths = [];
    checkBattleEnd();
    if (state.ended) {
      render();
      return;
    }
    state.players.forEach((player) => {
      if (player.alive) {
        setPlayerIdle(player);
      } else {
        player.actionState = 10;
      }
    });
    activateNextQueuedActor();
    render();
    scheduleCalculation();
  }

  function chooseTarget(target) {
    const attacker = state.acting;
    if (!attacker?.alive || !target?.alive) return;
    state.pendingCommand = null;
    if (attacker.team === "enemy") {
      blinkBeforeEnemyAction(() => resolveAttack(attacker, target));
      return;
    }
    if (attacker.team === "player") {
      setPlayerAction(attacker, 3);
      render();
      setTimeout(() => {
        if (!state.ended && attacker.alive) {
          setPlayerAction(attacker, 4);
          resolveAttack(attacker, target);
        }
      }, 220);
      return;
    }
    resolveAttack(attacker, target);
  }

  function blinkBeforeEnemyAction(action) {
    if (!state.acting || state.acting.team !== "enemy" || state.ended) return;
    state.enemyBlinking = true;
    render();
    setTimeout(() => {
      if (state.ended || !state.acting) return;
      state.enemyBlinking = false;
      action();
    }, 1000);
  }

  function useCommand(type) {
    if (!state.acting?.alive || state.ended) return;
    if (type === "attack") {
      state.pendingCommand = { type: "attack" };
      state.message = "คลิกที่เป้าหมาย";
      renderTargets();
      return;
    }
    if (type === "defend") {
      state.pendingCommand = { type: "defend" };
      $("#confirmation-text").textContent = `${state.acting.name} ใช้การป้องกัน ยืนยันหรือไม่?`;
      $("#confirmation-panel").classList.remove("hidden");
    }
    render();
  }

  function confirmCommand() {
    if (!state.acting || !state.pendingCommand) return;
    const command = state.pendingCommand;
    if (command.type === "defend") {
      const actor = state.acting;
      const defend = () => {
        actor.defending = true;
        state.message = `${actor.name} เพิ่มพลังป้องกันจนกว่าจะถึงเทิร์นถัดไป`;
        finishTurn(actor);
      };
      if (actor.team === "enemy") {
        blinkBeforeEnemyAction(defend);
      } else {
        defend();
      }
      return;
    }
    resolveAttack(state.acting, command.target);
  }

  function resolveAttack(attacker, target) {
    if (!attacker?.alive || !target?.alive) return;
    const difference = target.speed - attacker.speed;
    const rule = difference === 0
      ? { missChance: config.equalSpeedMissChance }
      : difference < 0
        ? null
        : config.hitRules.find((item) => difference >= item.min && difference <= item.max);
    const missChance = rule ? rule.missChance : 0;
    if (Math.random() < missChance) {
      state.message = `${attacker.name} โจมตี ${target.name}`;
      state.resultEffect = { targetId: target.id, text: "พลาด!", kind: "miss" };
      playSound("miss");
      finishTurn(attacker);
      return;
    }
    const factor = config.damage.randomFactors[Math.floor(Math.random() * config.damage.randomFactors.length)];
    const defense = target.defending ? target.defense * config.defend.defenseMultiplier : target.defense;
    const damage = Math.max(config.minimumDamage, Math.round(((attacker.attack * config.damage.attackMultiplier) - defense) * factor));
    if (target.team === "player") {
      target.actionState = 8;
      render();
    }
    setTimeout(() => {
      if (state.ended || !attacker.alive) return;
      target.hpCurrent = Math.max(0, target.hpCurrent - damage);
      if (target.hpCurrent === 0) {
        target.alive = false;
        if (target.team === "enemy") {
          target.deathPending = true;
          state.pendingEnemyDeaths.push(target);
        }
        state.message = `${attacker.name} โจมตี ${target.name} ${target.name} พ่ายแพ้`;
      } else {
        if (target.team === "player") {
          target.actionState = 8;
        }
        state.message = `${attacker.name} โจมตี ${target.name}`;
      }
      playSound("hit");
      state.resultEffect = { targetId: target.id, text: `-${damage}`, kind: "damage" };
      finishTurn(attacker);
    }, target.team === "player" ? 220 : 0);
  }

  function checkBattleEnd() {
    if (state.pendingEnemyDeaths.length) return;
    if (!living("enemies").length) endBattle("ชนะ! ศัตรูทั้งหมดพ่ายแพ้แล้ว");
    else if (!living("players").length) endBattle("พ่ายแพ้ ผู้เล่นทั้งหมดล้มลงแล้ว");
  }

  function endBattle(message) {
    state.ended = true;
    state.message = message;
    state.acting = null;
    clearTimeout(state.timer);
    battleMusic.pause();
    if (message.startsWith("ชนะ")) {
      victoryMusic.currentTime = 0;
      victoryMusic.play().catch(() => {});
    }
    $("#battle-result").textContent = message;
    $("#battle-result").classList.remove("hidden");
  }

  function renderStats() {
    $("#player-stats").innerHTML = state.players.map((player) => {
      const hpPercent = Math.max(0, player.hpCurrent / player.hpMax * 100);
      return `<article class="stat-card ${player.defending ? "defending" : ""} ${player.alive ? "" : "dead"}">
        <div class="face-frame"><img src="${asset(`Player/${player.face}/face.png`)}" alt="${player.name} face"></div>
        <div class="stat-info">
          <h3>${player.name}${player.defending ? " (ป้องกัน)" : ""}</h3>
          <div class="stat-line"><span>พลังชีวิต</span><strong>${player.hpCurrent} / ${player.hpMax}</strong></div>
          <div class="meter"><i style="width:${hpPercent}%"></i></div>
          <div class="stat-line"><span>พลังเวท</span><strong>${player.mpCurrent} / ${player.mpMax}</strong></div>
          <div class="meter mp-meter"><i style="width:${Math.max(0, player.mpCurrent / player.mpMax * 100)}%"></i></div>
        </div>
      </article>`;
    }).join("");
  }

  function spriteMarkup(character) {
    const image = character.team === "player"
      ? asset(`Player/${character.face}/action_${String(character.actionState || 1).padStart(2, "0")}.png`)
      : asset(`Enemy/${character.image}`);
    const effect = state.resultEffect?.targetId === character.id ? `<strong class="combat-effect ${state.resultEffect.kind}">${state.resultEffect.text}</strong>` : "";
    const enemyName = character.team === "enemy" ? `<span class="enemy-name">${character.name}</span>` : "";
    const blinking = state.enemyBlinking && state.acting?.id === character.id ? " enemy-blinking" : "";
    const teamClass = character.team === "enemy" ? "enemy-sprite" : "player-sprite";
    const defeated = !character.alive && !character.deathPending;
    return `<div class="sprite-slot ${teamClass} ${defeated ? "dead" : ""} ${state.acting?.id === character.id ? "acting" : ""}${blinking}" data-character-id="${character.id}">
      <img src="${image}" alt="${character.name}">
      ${enemyName}
      ${effect}
    </div>`;
  }

  function renderDisplay() {
    $("#enemy-stage").innerHTML = state.enemies.map(spriteMarkup).join("");
    $("#player-stage").innerHTML = state.players.map(spriteMarkup).join("");
    const background = config.backgrounds[config.selectedBackground - 1] || config.backgrounds[0];
    $("#battle-display").style.backgroundImage = `url("${background}")`;
  }

  function renderTargets() {
    const panel = $("#target-panel");
    panel.classList.add("hidden");
    panel.innerHTML = "";
  }

  function render() {
    renderStats();
    renderDisplay();
    $("#battle-message").textContent = state.awaitingContinue
      ? `${state.message}`
      : state.message;
    $("#acting-name").textContent = state.ended ? "จบการต่อสู้" : state.acting ? state.acting.name : "กำลังรอ...";
    $("#turn-detail").textContent = state.acting ? `CDP ${state.acting.cooldownPoint} / ${config.cooldownThreshold}` : `รอบคำนวณ ${state.calculation}`;
    const canAct = Boolean(state.acting?.alive) && !state.ended;
    $("#command-actions").classList.toggle("hidden", !canAct || state.awaitingContinue || Boolean(state.pendingCommand));
    $("#confirmation-panel").classList.toggle("hidden", state.pendingCommand?.type !== "defend");
    renderTargets();
    $("#confirm-button").disabled = !state.pendingCommand;
  }

  $("#command-actions").addEventListener("click", (event) => useCommand(event.target.closest("button")?.dataset.command));
  $("#target-panel").addEventListener("click", (event) => {
    const target = allCharacters().find((character) => character.id === event.target.dataset.target);
    if (target) chooseTarget(target);
  });
  ["#enemy-stage", "#player-stage"].forEach((selector) => $(selector).addEventListener("click", (event) => {
    if (state.pendingCommand?.type !== "attack" || state.pendingCommand.target || !state.acting) return;
    const id = event.target.closest(".sprite-slot")?.dataset.characterId;
    const target = allCharacters().find((character) => character.id === id);
    const opponentTeam = state.acting.team === "player" ? "enemy" : "player";
    if (target?.team === opponentTeam && target.alive) {
      event.stopPropagation();
      chooseTarget(target);
    }
  }));
  $("#confirm-button").addEventListener("click", confirmCommand);
  $("#cancel-button").addEventListener("click", () => { state.pendingCommand = null; render(); });
  $("#restart-button").addEventListener("click", resetBattle);
  document.addEventListener("pointerdown", startBattleMusic, { passive: true });
  document.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    continueAfterResult();
  });
  loadCharactersFromSupabase()
    .then(() => {
      $("#restart-button").disabled = false;
      resetBattle();
    })
    .catch((error) => {
      console.error("Could not initialize battle characters", error);
      $("#battle-message").textContent = `ไม่สามารถโหลดข้อมูลการต่อสู้จาก Supabase ได้: ${error.message}`;
      $("#restart-button").disabled = true;
    });
}());
