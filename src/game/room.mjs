import crypto from "node:crypto";
import { COMPANIONS, OFFICIAL_MODULES } from "../data/content.mjs";
import { sanitizeUser } from "../auth.mjs";
import { validateModule, buildRescueChoice } from "./rules.mjs";
import { buildSceneArt } from "./art.mjs";

export function resolveModule(moduleId, scriptJson) {
  if (scriptJson) {
    const parsed = JSON.parse(scriptJson);
    validateModule(parsed);
    return parsed;
  }

  const official = OFFICIAL_MODULES.find((item) => item.id === moduleId);
  if (!official) {
    throw new Error("未找到指定剧本。");
  }
  return official;
}

export function createRoom(db, { roomName, moduleDefinition, ownerId, characterId, companionIds }) {
  const roomId = crypto.randomUUID().slice(0, 8);
  const room = {
    id: roomId,
    roomName,
    ownerId,
    module: moduleDefinition,
    players: [buildPlayerEntry(db, ownerId, characterId)],
    companions: companionIds
      .map((companionId) => COMPANIONS.find((companion) => companion.id === companionId))
      .filter(Boolean),
    sceneIndex: 0,
    turn: 0,
    pressure: 0,
    ending: null,
    story: [],
    logs: [],
    completed: false,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString()
  };
  pushLog(room, `房间「${roomName}」已建立，剧本为《${moduleDefinition.title}》。`);
  return room;
}

export function buildPlayerEntry(db, userId, characterId) {
  const character = db.characters[characterId];
  return {
    userId,
    characterId,
    hp: character?.maxHp ?? 10,
    status: "active",
    joinedAt: new Date().toISOString()
  };
}

export function hydrateRoom(db, room, viewerUserId = null) {
  const viewerMembership = viewerUserId
    ? room.players.find((player) => player.userId === viewerUserId) ?? null
    : null;

  return {
    ...room,
    inviteCode: room.id.toUpperCase(),
    owner: sanitizeUser(db.users[room.ownerId]),
    currentScene: getSceneWithDynamicChoices(db, room),
    viewer: {
      isMember: Boolean(viewerMembership),
      characterId: viewerMembership?.characterId ?? null,
      status: viewerMembership?.status ?? null
    },
    players: room.players.map((player) => ({
      ...player,
      user: sanitizeUser(db.users[player.userId]),
      character: db.characters[player.characterId]
    })),
    sceneArt: buildSceneArt(room)
  };
}

export function listRooms(db, viewerUserId = null) {
  return Object.values(db.rooms)
    .sort((left, right) => (left.lastUpdatedAt < right.lastUpdatedAt ? 1 : -1))
    .map((room) => ({
      id: room.id,
      inviteCode: room.id.toUpperCase(),
      roomName: room.roomName,
      ownerName: db.users[room.ownerId]?.name ?? "未知团长",
      moduleTitle: room.module.title,
      sceneTitle: getCurrentScene(room)?.title ?? room.module.title,
      players: room.players.length,
      completed: room.completed,
      lastUpdatedAt: room.lastUpdatedAt,
      viewerIsMember: viewerUserId
        ? room.players.some((player) => player.userId === viewerUserId)
        : false
    }));
}

export function getCurrentScene(room) {
  return room.module.scenes[room.sceneIndex] ?? room.module.scenes.at(-1);
}

/**
 * 展示层注入救助选项,不污染 module 原始数据。
 */
export function getSceneWithDynamicChoices(db, room) {
  const scene = getCurrentScene(room);
  if (!scene || room.completed) {
    return scene;
  }

  const downedPlayers = room.players.filter((player) => player.status === "down");
  if (!downedPlayers.length) {
    return scene;
  }

  const rescueChoices = downedPlayers
    .map((player) => db.characters[player.characterId])
    .filter(Boolean)
    .map((character) => buildRescueChoice(character));

  return { ...scene, choices: [...(scene.choices ?? []), ...rescueChoices] };
}

export function pushLog(room, message) {
  room.logs.unshift({
    id: crypto.randomUUID(),
    text: message,
    at: new Date().toISOString()
  });
  room.logs = room.logs.slice(0, 40);
}
