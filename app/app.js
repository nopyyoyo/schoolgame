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
  const effectsRegistry = new Map((window.ATTACK_EFFECTS || []).map((entry) => [entry.folder, entry]));
  const attackEffectFrameSrc = (folder, frame) => encodeURI(`Attack Effect/${folder}/frame_${String(frame).padStart(2, "0")}.png`);
  const $ = (selector) => document.querySelector(selector);
  const asset = (path) => `../Character/Cut/${path}`;
  let state;
  let ladderContext = null;
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
    const ladderMode = battleParams.get("mode") === "player-ladder";
    if (ladderMode) {
      const playerId = battleParams.get("player");
      const levelNumber = Number(battleParams.get("level"));
      const session = JSON.parse(sessionStorage.getItem(`school-game-player-session-${playerId}`) || "null");
      if (!playerId || !Number.isInteger(levelNumber) || levelNumber < 1 || !session?.token) {
        throw new Error("ไม่พบเซสชันผู้เล่นสำหรับลานประลองส่วนตัว");
      }
      const { data: ladderRows, error: ladderError } = await supabase.rpc("get_player_arena_state", { p_token: session.token });
      if (ladderError || !Array.isArray(ladderRows)) {
        throw new Error(ladderError?.message || "ไม่สามารถโหลดความคืบหน้าลานประลองได้");
      }
      const ladderLevel = ladderRows.find((row) => row.level_number === levelNumber);
      if (!ladderLevel?.active) throw new Error("ลานประลองขั้นนี้ยังไม่เปิด");
      const previous = ladderRows.find((row) => row.level_number === levelNumber - 1);
      if (levelNumber > 1 && !previous?.completed) throw new Error("ต้องผ่านลานประลองขั้นก่อนหน้าก่อน");
      ladderContext = { token: session.token, playerId, levelNumber, level: ladderLevel };
    } else {
      ladderContext = null;
    }
    const requestedLevel = Number(battleParams.get("level"));
    const requestedTeam = battleParams.get("team");
    const level = Array.isArray(window.BATTLE_LEVELS)
      ? window.BATTLE_LEVELS.find((entry) => entry.id === requestedLevel && entry.open)
      : null;
    if (!ladderMode && battleParams.has("level") && !level) {
      throw new Error("This battle level is not open");
    }
    const playerIds = ladderMode
      ? [ladderContext.playerId]
      : requestedTeam
      ? null
      : rosterConfig?.playerIds;
    const enemyIds = ladderMode ? ladderContext.level.enemy_ids : level ? level.enemyIds : rosterConfig?.enemyIds;
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
    const skillsById = new Map((data.skills || []).map((skill) => [skill.id, skill]));
    const equippedSkills = (character) => {
      const ids = [character.equipped?.weapon, character.equipped?.armor, character.equipped?.shield, character.equipped?.accessory]
        .filter(Boolean)
        .flatMap((item) => [item.skill_id1, item.skill_id2, item.skill_id3, item.skill_id4])
        .filter(Boolean);
      return [...new Set(ids)]
        .map((id) => skillsById.get(id))
        .filter((skill) => skill && skill.active !== false);
    };
    const equippedStatTotals = (character) => [character.equipped?.weapon, character.equipped?.armor,
      character.equipped?.shield, character.equipped?.accessory]
      .filter(Boolean)
      .reduce((totals, item) => ({
        hpMax: totals.hpMax + Number(item.hp_stat || 0),
        mpMax: totals.mpMax + Number(item.mp_stat || 0),
        attack: totals.attack + Number(item.attack_stat || 0),
        defense: totals.defense + Number(item.defend_stat || 0),
        speed: totals.speed + Number(item.speed_stat || 0)
      }), { hpMax: 0, mpMax: 0, attack: 0, defense: 0, speed: 0 });
    const battleCharacter = (character, enemy = false) => {
      const totals = equippedStatTotals(character);
      return {
        id: character.id,
        name: character.name,
        ...(enemy ? { image: character.face } : { face: character.face }),
        hpMax: Number(character.hp_max) + totals.hpMax,
        mpMax: Number(character.mp_max) + totals.mpMax,
        attack: Number(character.attack) + totals.attack,
        defense: Number(character.defense) + totals.defense,
        speed: Number(character.speed) + totals.speed,
        wisdom: Number(character.wisdom),
        weakElement: character.weak_element || "",
        skills: equippedSkills(character),
        equipment: character.equipped || {}
      };
    };
    const getCharacter = (id, role) => {
      const character = byId.get(id);
      if (!character || (role && character.role !== role)) {
        throw new Error(`Character ${id} is missing or has the wrong role`);
      }
      return character;
    };
    const playerRole = ladderMode ? null : requestedTeam ? null : "player";
    const players = (ladderMode
      ? data.players.filter((character) => character.id === ladderContext.playerId).map((character) => character.id)
      : requestedTeam
      ? data.players.filter((character) => character.team === requestedTeam).map((character) => character.id)
      : playerIds).map((id) => {
        const character = getCharacter(id, playerRole);
        if (ladderMode && !["player", "teacher"].includes(character.role)) {
          throw new Error(`Character ${id} is not an eligible single-player character`);
        }
        return battleCharacter(character);
      });
    if (players.length < 1 || players.length > 4) {
      throw new Error("Selected team must contain 1 to 4 players");
    }
    const enemies = enemyIds.map((id) => battleCharacter(getCharacter(id, "enemy"), true));
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
      skillMenu: null,
      calculation: 0,
      message: "เริ่มการต่อสู้",
      awaitingContinue: false,
      resultEffects: [],
      impactEffects: [],
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
    const actor = state.acting;
    const strategy = enemyAiConfig.strategies[enemyAiConfig.selectedStrategy]
      || enemyAiConfig.strategies.always_attack_random;
    const affordableSkills = (actor.skills || []).filter((skill) => skill.mp_consumption <= actor.mpCurrent);
    if (affordableSkills.length && Math.random() < strategy.skillChance) {
      const skill = affordableSkills[Math.floor(Math.random() * affordableSkills.length)];
      const sideTeam = allowedTeamForSkill(actor, skill);
      const candidates = living(sideTeam === "enemy" ? "enemies" : "players");
      if (candidates.length) {
        const targets = skill.target === "all" ? candidates : [candidates[Math.floor(Math.random() * candidates.length)]];
        applySkill(actor, skill, targets);
        return;
      }
    }
    const targets = living("players");
    if (!targets.length) {
      checkBattleEnd();
      return;
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
    state.resultEffects = [];
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
      render();
      return;
    }
    if (type === "skill") {
      if (!state.acting.skills?.length) return;
      state.skillMenu = true;
      state.pendingCommand = null;
      state.message = "เลือกทักษะ";
      render();
      return;
    }
    if (type === "defend") {
      state.pendingCommand = { type: "defend" };
      $("#confirmation-text").textContent = `${state.acting.name} ใช้การป้องกัน ยืนยันหรือไม่?`;
      $("#confirmation-panel").classList.remove("hidden");
    }
    render();
  }

  function cancelSkillMenu() {
    state.skillMenu = null;
    state.message = `${state.acting.name} พร้อมดำเนินการ`;
    render();
  }

  function selectSkill(skill) {
    if (!state.acting || skill.mp_consumption > state.acting.mpCurrent) return;
    state.skillMenu = null;
    const mode = skill.target === "all" ? "side" : "single";
    state.pendingCommand = { type: "skill", skill, mode };
    state.message = mode === "side" ? "คลิกฝั่งเป้าหมาย" : "คลิกที่เป้าหมาย";
    render();
  }

  function allowedTeamForSkill(caster, skill) {
    if (skill.skill_type === "heal") return caster.team;
    return caster.team === "player" ? "enemy" : "player";
  }

  function boostedSkillStats(caster, skill) {
    return {
      attack: (caster.attack + (skill.attack_add || 0)) * (skill.attack_multiply || 1),
      wisdom: (caster.wisdom + (skill.wisdom_add || 0)) * (skill.wisdom_multiply || 1)
    };
  }

  function computeMissChance(attackerSpeed, targetSpeed) {
    const difference = targetSpeed - attackerSpeed;
    const rule = difference === 0
      ? { missChance: config.equalSpeedMissChance }
      : difference < 0
        ? null
        : config.hitRules.find((item) => difference >= item.min && difference <= item.max);
    return rule ? rule.missChance : 0;
  }

  function computeDamage(attackPower, defensePower, target) {
    const factor = config.damage.randomFactors[Math.floor(Math.random() * config.damage.randomFactors.length)];
    const defense = target.defending ? defensePower * config.defend.defenseMultiplier : defensePower;
    const minimumDamage = config.minimumDamageValues[Math.floor(Math.random() * config.minimumDamageValues.length)];
    return Math.max(minimumDamage, Math.round(((attackPower * config.damage.attackMultiplier) - defense) * factor));
  }

  // Priority: skill's own effect/sound (when a skill is used) > attacker's
  // equipped weapon's effect/sound (normal attack only) > bare-hand default
  // effect (config.effects.defaultEffect, sound stays null so it falls back
  // to the generic "hit" sound). Scale falls back to config.effects.defaultScale
  // whenever the skill/weapon row doesn't set its own attack_effect_scale.
  function pickAttackAssets(caster, skill) {
    if (skill && (skill.attack_effect || skill.attack_sound)) {
      return {
        effect: skill.attack_effect || null,
        sound: skill.attack_sound || null,
        scale: skill.attack_effect_scale || config.effects.defaultScale
      };
    }
    const weapon = !skill ? caster.equipment?.weapon : null;
    if (weapon && (weapon.attack_effect || weapon.attack_sound)) {
      return {
        effect: weapon.attack_effect || null,
        sound: weapon.attack_sound || null,
        scale: weapon.attack_effect_scale || config.effects.defaultScale
      };
    }
    return { effect: config.effects.defaultEffect || null, sound: null, scale: config.effects.defaultScale };
  }

  function playAttackSound(fileName) {
    const audio = new Audio(`Sounds/${fileName}`);
    audio.volume = config.effects.soundVolume ?? 1;
    audio.play().catch(() => {});
  }

  function startImpactEffect(target, assets, flip, offsetPercent) {
    const entry = assets.effect ? effectsRegistry.get(assets.effect) : null;
    if (!entry) return 0;
    const scale = assets.scale || config.effects.defaultScale;
    const record = { targetId: target.id, folder: assets.effect, frame: 1, flip, offsetPercent, scale };
    state.impactEffects.push(record);
    const timer = setInterval(() => {
      record.frame += 1;
      if (record.frame > entry.frames) {
        clearInterval(timer);
        state.impactEffects = state.impactEffects.filter((item) => item !== record);
      }
      render();
    }, config.effects.frameDurationMs);
    return entry.frames * config.effects.frameDurationMs;
  }

  // Starts the impact effect + sound on one target and returns how long (ms)
  // to wait before the damage/heal number is revealed.
  function beginTargetImpact(attacker, target, assets) {
    const flip = attacker.team === "enemy" && target.team === "player";
    const offsetPercent = attacker.team === target.team
      ? 0
      : (attacker.team === "player" ? config.effects.offsetPercent : -config.effects.offsetPercent);
    const effectDurationMs = startImpactEffect(target, assets, flip, offsetPercent);
    if (assets.sound) {
      playAttackSound(assets.sound);
    } else {
      playSound("hit");
    }
    const soundDurationMs = (assets.sound || assets.effect) ? config.effects.soundDurationMs : 0;
    return Math.max(effectDurationMs, soundDurationMs);
  }

  function applySkill(caster, skill, targets) {
    if (!caster?.alive) return;
    caster.mpCurrent = Math.max(0, caster.mpCurrent - (skill.mp_consumption || 0));
    const boosted = boostedSkillStats(caster, skill);
    const isCastAnimation = skill.skill_type === "magic" || skill.skill_type === "heal";
    const assets = pickAttackAssets(caster, skill);
    const applyEffects = () => {
      if (state.ended || !caster.alive) return;
      const livingTargets = targets.filter((target) => target.alive);
      if (!livingTargets.length) {
        finishTurn(caster);
        return;
      }
      // Phase 1: resolve hit/miss/damage/heal for every target up front,
      // without mutating HP yet, so the reveal happens together afterward.
      const results = livingTargets.map((target) => {
        if (skill.skill_type === "heal") {
          const healAmount = Math.max(0, Math.round(boosted.wisdom * config.skills.healMultiplier));
          return { target, kind: "heal", healAmount };
        }
        const isMagic = skill.skill_type === "magic";
        const missChance = isMagic ? 0 : computeMissChance(caster.speed, target.speed);
        if (Math.random() < missChance) {
          return { target, kind: "miss" };
        }
        const attackPower = isMagic ? boosted.wisdom : boosted.attack;
        const defensePower = isMagic ? target.wisdom : target.defense;
        let damage = computeDamage(attackPower, defensePower, target);
        if (skill.element && skill.element === target.weakElement) {
          damage = Math.round(damage * config.skills.elementMultiplier);
        }
        return { target, kind: "damage", damage };
      });
      // Phase 2: start each target's impact effect/sound simultaneously and
      // wait for the longest one before revealing numbers and applying HP.
      let maxDurationMs = 0;
      results.forEach((result) => {
        if (result.kind === "miss") {
          playSound("miss");
          return;
        }
        if (result.kind === "damage" && result.target.team === "player") {
          result.target.actionState = 8;
        }
        maxDurationMs = Math.max(maxDurationMs, beginTargetImpact(caster, result.target, assets));
      });
      render();
      setTimeout(() => {
        if (state.ended || !caster.alive) return;
        state.resultEffects = [];
        results.forEach(({ target, kind, damage, healAmount }) => {
          if (kind === "miss") {
            state.resultEffects.push({ targetId: target.id, text: "พลาด!", kind: "miss" });
            return;
          }
          if (kind === "heal") {
            const before = target.hpCurrent;
            target.hpCurrent = Math.min(target.hpMax, target.hpCurrent + healAmount);
            state.resultEffects.push({ targetId: target.id, text: `+${target.hpCurrent - before}`, kind: "heal" });
            return;
          }
          target.hpCurrent = Math.max(0, target.hpCurrent - damage);
          if (target.hpCurrent === 0) {
            target.alive = false;
            if (target.team === "enemy") {
              target.deathPending = true;
              state.pendingEnemyDeaths.push(target);
            }
          } else if (target.team === "player") {
            target.actionState = 8;
          }
          state.resultEffects.push({ targetId: target.id, text: `-${damage}`, kind: "damage" });
        });
        state.message = `${caster.name} ใช้ ${skill.skill_name}`;
        finishTurn(caster);
      }, maxDurationMs);
    };
    const run = () => {
      if (caster.team === "enemy") {
        blinkBeforeEnemyAction(applyEffects);
        return;
      }
      if (caster.team === "player") {
        setPlayerAction(caster, isCastAnimation ? 5 : 3);
        render();
        setTimeout(() => {
          if (state.ended || !caster.alive) return;
          setPlayerAction(caster, isCastAnimation ? 6 : 4);
          applyEffects();
        }, 220);
        return;
      }
      applyEffects();
    };
    run();
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
    const missChance = computeMissChance(attacker.speed, target.speed);
    if (Math.random() < missChance) {
      state.message = `${attacker.name} โจมตี ${target.name}`;
      state.resultEffects = [{ targetId: target.id, text: "พลาด!", kind: "miss" }];
      playSound("miss");
      finishTurn(attacker);
      return;
    }
    const damage = computeDamage(attacker.attack, target.defense, target);
    const assets = pickAttackAssets(attacker, null);
    if (target.team === "player") {
      target.actionState = 8;
    }
    const impactDurationMs = beginTargetImpact(attacker, target, assets);
    const durationMs = Math.max(impactDurationMs, target.team === "player" ? 220 : 0);
    render();
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
      state.resultEffects = [{ targetId: target.id, text: `-${damage}`, kind: "damage" }];
      finishTurn(attacker);
    }, durationMs);
  }

  function checkBattleEnd() {
    if (state.pendingEnemyDeaths.length) return;
    if (!living("enemies").length) endBattle("ชนะ! ศัตรูทั้งหมดพ่ายแพ้แล้ว");
    else if (!living("players").length) endBattle("พ่ายแพ้ ผู้เล่นทั้งหมดล้มลงแล้ว");
  }

  async function recordLadderWin() {
    if (!ladderContext || ladderContext.winRecorded) return;
    ladderContext.winRecorded = true;
    const { data, error } = await supabase.rpc("record_player_arena_win", {
      p_token: ladderContext.token,
      p_level_number: ladderContext.levelNumber,
      p_request_id: crypto.randomUUID()
    });
    if (error || !Array.isArray(data) || !data[0]) {
      ladderContext.winRecorded = false;
      throw new Error(error?.message || "ไม่สามารถบันทึกผลลานประลองได้");
    }
    state.message = `ชนะ! ผ่านลานประลองขั้นที่ ${ladderContext.levelNumber} — กลับหน้าผู้เล่นเพื่อรับรางวัล`;
    render();
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
    if (message.startsWith("ชนะ") && ladderContext) {
      void recordLadderWin().catch((error) => {
        state.message = `ชนะการต่อสู้ แต่บันทึกผลไม่สำเร็จ: ${error.message}`;
        render();
      });
    }
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

  function impactMarkup(character) {
    const impact = (state.impactEffects || []).find((item) => item.targetId === character.id);
    if (!impact) return "";
    const entry = effectsRegistry.get(impact.folder);
    if (!entry) return "";
    const src = attackEffectFrameSrc(impact.folder, impact.frame);
    const scale = impact.scale || config.effects.defaultScale;
    const scaleX = impact.flip ? -scale : scale;
    return `<img class="attack-effect-sprite" src="${src}" alt="" style="left:calc(50% + ${impact.offsetPercent}%); transform: translate(-50%, -50%) scale(${scaleX}, ${scale});">`;
  }

  function spriteMarkup(character) {
    const image = character.team === "player"
      ? asset(`Player/${character.face}/action_${String(character.actionState || 1).padStart(2, "0")}.png`)
      : asset(`Enemy/${character.image}`);
    const effect = (state.resultEffects || []).find((item) => item.targetId === character.id);
    const effectMarkup = effect ? `<strong class="combat-effect ${effect.kind}">${effect.text}</strong>` : "";
    const enemyName = character.team === "enemy" ? `<span class="enemy-name">${character.name}</span>` : "";
    const blinking = state.enemyBlinking && state.acting?.id === character.id ? " enemy-blinking" : "";
    const teamClass = character.team === "enemy" ? "enemy-sprite" : "player-sprite";
    const defeated = !character.alive && !character.deathPending;
    return `<div class="sprite-slot ${teamClass} ${defeated ? "dead" : ""} ${state.acting?.id === character.id ? "acting" : ""}${blinking}" data-character-id="${character.id}">
      <img src="${image}" alt="${character.name}">
      ${enemyName}
      ${impactMarkup(character)}
      ${effectMarkup}
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

  function renderSkillMenu() {
    const panel = $("#skill-panel");
    if (!state.skillMenu || !state.acting) {
      panel.classList.add("hidden");
      panel.innerHTML = "";
      return;
    }
    panel.classList.remove("hidden");
    const skills = state.acting.skills || [];
    panel.innerHTML = skills.map((skill) => {
      const disabled = skill.mp_consumption > state.acting.mpCurrent;
      return `<button class="skill-option" data-skill-id="${skill.id}" ${disabled ? "disabled" : ""}>${skill.skill_name}<span>MP ${skill.mp_consumption}</span></button>`;
    }).join("") + `<button class="secondary-button" data-skill-cancel>ยกเลิก</button>`;
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
    const playerControlsVisible = canAct && state.acting?.team === "player" && !state.awaitingContinue;
    const skillMenuOpen = Boolean(state.skillMenu);
    $("#command-actions").classList.toggle("hidden", !playerControlsVisible || Boolean(state.pendingCommand) || skillMenuOpen);
    $("#confirmation-panel").classList.toggle("hidden", !playerControlsVisible || state.pendingCommand?.type !== "defend" || skillMenuOpen);
    const skillButton = document.querySelector('[data-command="skill"]');
    if (skillButton) skillButton.disabled = !(state.acting?.skills?.length);
    renderSkillMenu();
    renderTargets();
    $("#confirm-button").disabled = !state.pendingCommand;
  }

  $("#command-actions").addEventListener("click", (event) => useCommand(event.target.closest("button")?.dataset.command));
  $("#skill-panel").addEventListener("click", (event) => {
    if (event.target.closest("[data-skill-cancel]")) {
      cancelSkillMenu();
      return;
    }
    const button = event.target.closest(".skill-option");
    if (!button || button.disabled || !state.acting) return;
    const skill = (state.acting.skills || []).find((item) => item.id === button.dataset.skillId);
    if (skill) selectSkill(skill);
  });
  $("#target-panel").addEventListener("click", (event) => {
    const target = allCharacters().find((character) => character.id === event.target.dataset.target);
    if (target) chooseTarget(target);
  });
  ["#enemy-stage", "#player-stage"].forEach((selector) => $(selector).addEventListener("click", (event) => {
    if (!state.acting || !state.pendingCommand) return;
    const stageTeam = selector === "#enemy-stage" ? "enemy" : "player";
    if (state.pendingCommand.type === "attack") {
      if (state.pendingCommand.target) return;
      const id = event.target.closest(".sprite-slot")?.dataset.characterId;
      const target = allCharacters().find((character) => character.id === id);
      const opponentTeam = state.acting.team === "player" ? "enemy" : "player";
      if (target?.team === opponentTeam && target.alive) {
        event.stopPropagation();
        chooseTarget(target);
      }
      return;
    }
    if (state.pendingCommand.type === "skill") {
      const skill = state.pendingCommand.skill;
      if (state.pendingCommand.mode === "side") {
        const targets = living(stageTeam === "enemy" ? "enemies" : "players");
        if (!targets.length) return;
        event.stopPropagation();
        state.pendingCommand = null;
        applySkill(state.acting, skill, targets);
        render();
        return;
      }
      const id = event.target.closest(".sprite-slot")?.dataset.characterId;
      const target = allCharacters().find((character) => character.id === id);
      const allowedTeam = allowedTeamForSkill(state.acting, skill);
      if (target?.team === allowedTeam && target.alive) {
        event.stopPropagation();
        state.pendingCommand = null;
        applySkill(state.acting, skill, [target]);
        render();
      }
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
