import crypto from "node:crypto";
import { RACES, CLASSES } from "../data/content.mjs";

export const PRESSURE_LIMIT = 3;
export const RESCUE_DC = 10;

export function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

export function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

export function getCompanionBonus(room, skill) {
  return room.companions.reduce((sum, companion) => sum + Number(companion.modifiers?.[skill] ?? 0), 0);
}

export function validateModule(moduleDefinition) {
  if (!moduleDefinition?.title || !Array.isArray(moduleDefinition.scenes) || !moduleDefinition.scenes.length) {
    throw new Error("剧本必须包含 title 和 scenes。");
  }
}

export function computeMaxHp(character) {
  const strength = Number(character?.stats?.strength ?? 10);
  const classBonus = character?.classId === "fighter" ? 2 : 0;
  return Math.max(6, 10 + getModifier(strength) * 2 + classBonus);
}

export function buildCharacter({ id, userId, name, raceId, classId, skillChoices, gearChoices, backstory }) {
  const race = RACES[raceId];
  const job = CLASSES[classId];
  const stats = {
    strength: 10 + race.bonuses.strength,
    agility: 10 + race.bonuses.agility,
    intellect: 10 + race.bonuses.intellect,
    spirit: 10 + race.bonuses.spirit,
    charm: 10 + race.bonuses.charm
  };
  const skills = [...new Set([...job.skills, ...skillChoices])];
  const gear = [...new Set([...job.gear, ...gearChoices])];

  const character = {
    id,
    userId,
    name,
    raceId,
    classId,
    backstory,
    stats,
    skills,
    gear,
    portraitPrompt: `${race.portrait}, ${job.portrait}, parchment fantasy concept art`,
    createdAt: new Date().toISOString()
  };
  character.maxHp = computeMaxHp(character);
  return character;
}

export function inferSkillFromText(freeText, scene) {
  const merged = `${freeText} ${scene?.description ?? ""}`;
  if (/(潜行|躲|隐匿|偷)/.test(merged)) {
    return "stealth";
  }
  if (/(说服|交涉|谈判|劝)/.test(merged)) {
    return "persuasion";
  }
  if (/(调查|观察|分析)/.test(merged)) {
    return "investigation";
  }
  if (/(推|举|撞|砍|冲)/.test(merged)) {
    return "athletics";
  }
  return "insight";
}

export function inferFreeActionDc({ moduleDifficulty, freeText = "", pressure = 0 }) {
  let dc = Number(moduleDifficulty ?? 12);
  if (/(强攻|硬闯|跳|冲|砍|偷袭|夺|挑衅|猛|撞)/.test(freeText)) {
    dc += 2;
  }
  if (/(小心|慢慢|悄悄|观察|试探|掩护|谨慎)/.test(freeText)) {
    dc -= 1;
  }
  if (freeText.length > 40) {
    dc += 1;
  }
  dc += Math.floor(Number(pressure || 0) / 2);
  return Math.min(18, Math.max(8, dc));
}

export function buildFreeChoice(scene, freeText, { moduleDifficulty, pressure = 0 } = {}) {
  if (!freeText?.trim()) {
    return null;
  }

  return {
    id: `free-${crypto.randomUUID().slice(0, 6)}`,
    label: freeText,
    kind: "free",
    skill: inferSkillFromText(freeText, scene),
    dc: inferFreeActionDc({ moduleDifficulty, freeText, pressure })
  };
}

export function buildRescueChoice(targetCharacter) {
  return {
    id: `rescue-${targetCharacter.id}`,
    label: `救助 ${targetCharacter.name}`,
    kind: "rescue",
    skill: "medicine",
    dc: RESCUE_DC
  };
}

export function computeFailureDamage({ roll, total, dc }) {
  let damage = 1;
  if (dc - total >= 5) {
    damage += 1;
  }
  if (roll === 1) {
    damage += 1;
  }
  return damage;
}

/**
 * 结算一次行动对房间状态的全部影响(危机值、HP、场景推进、结局),
 * 返回事件列表供日志与叙事使用。直接原地修改 room 与 players。
 */
export function applyActionOutcome({ room, actingPlayer, rescueTargetPlayer = null, success, roll, total, dc, maxHpOf, nameOf }) {
  const events = [];
  room.pressure = Number(room.pressure ?? 0);
  const lastSceneIndex = room.module.scenes.length - 1;

  const damagePlayer = (player, amount) => {
    if (player.status === "down") {
      return;
    }
    player.hp = Math.max(0, Number(player.hp ?? maxHpOf(player)) - amount);
    events.push({ type: "damage", characterId: player.characterId, name: nameOf(player), amount, hp: player.hp, maxHp: maxHpOf(player) });
    if (player.hp <= 0) {
      player.status = "down";
      events.push({ type: "down", characterId: player.characterId, name: nameOf(player) });
    }
  };

  if (success) {
    room.pressure = Math.max(0, room.pressure - 1);

    if (rescueTargetPlayer) {
      const maxHp = maxHpOf(rescueTargetPlayer);
      rescueTargetPlayer.hp = Math.min(maxHp, Math.ceil(maxHp / 2));
      rescueTargetPlayer.status = "active";
      events.push({ type: "rescued", characterId: rescueTargetPlayer.characterId, name: nameOf(rescueTargetPlayer), hp: rescueTargetPlayer.hp, maxHp });
    } else if (room.sceneIndex >= lastSceneIndex) {
      room.completed = true;
      room.ending = "victory";
      events.push({ type: "ending", ending: "victory" });
    } else {
      room.sceneIndex += 1;
      events.push({ type: "advance", sceneIndex: room.sceneIndex });
    }
    return events;
  }

  room.pressure += roll === 1 ? 2 : 1;
  damagePlayer(actingPlayer, computeFailureDamage({ roll, total, dc }));

  if (!room.completed && room.pressure >= PRESSURE_LIMIT) {
    room.pressure = 0;
    events.push({ type: "crisis" });
    for (const player of room.players) {
      damagePlayer(player, 1);
    }
    if (room.sceneIndex >= lastSceneIndex) {
      room.completed = true;
      room.ending = "retreat";
      events.push({ type: "ending", ending: "retreat" });
    } else {
      room.sceneIndex += 1;
      events.push({ type: "forcedAdvance", sceneIndex: room.sceneIndex });
    }
  }

  if (!room.completed && room.players.length && room.players.every((player) => player.status === "down")) {
    room.completed = true;
    room.ending = "wipe";
    events.push({ type: "ending", ending: "wipe" });
  }

  return events;
}

export function describeOutcomeEvents(events) {
  const lines = [];
  for (const event of events) {
    switch (event.type) {
      case "damage":
        lines.push(`${event.name} 受到 ${event.amount} 点伤害（HP ${event.hp}/${event.maxHp}）。`);
        break;
      case "down":
        lines.push(`${event.name} 倒下了！需要队友救助。`);
        break;
      case "rescued":
        lines.push(`${event.name} 被救起，恢复了行动能力（HP ${event.hp}/${event.maxHp}）。`);
        break;
      case "crisis":
        lines.push("危机爆发！局势失控，全队受创，被迫转移。");
        break;
      case "forcedAdvance":
        lines.push("队伍在混乱中被迫闯入下一区域。");
        break;
      case "ending":
        if (event.ending === "victory") {
          lines.push("冒险达成阶段性结局，房间已标记为完成。");
        } else if (event.ending === "retreat") {
          lines.push("队伍被迫撤离，冒险以败退告终。");
        } else if (event.ending === "wipe") {
          lines.push("全员倒地，冒险失败。");
        }
        break;
      default:
        break;
    }
  }
  return lines;
}
