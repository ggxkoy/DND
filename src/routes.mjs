import crypto from "node:crypto";
import path from "node:path";
import express from "express";
import { PUBLIC_DIR, ART_DIR, getLlmConfig } from "./config.mjs";
import { getDb, persist } from "./store.mjs";
import {
  createUser,
  issueSession,
  hashText,
  findUserByName,
  getSession,
  requireSession
} from "./auth.mjs";
import { RACES, CLASSES, COMPANIONS, OFFICIAL_MODULES, SKILL_MAP } from "./data/content.mjs";
import {
  rollD20,
  getModifier,
  getCompanionBonus,
  buildCharacter,
  buildFreeChoice,
  buildRescueChoice,
  applyActionOutcome,
  describeOutcomeEvents
} from "./game/rules.mjs";
import {
  resolveModule,
  createRoom,
  buildPlayerEntry,
  hydrateRoom,
  listRooms,
  getCurrentScene,
  pushLog
} from "./game/room.mjs";
import { narrateTurn } from "./llm/narrator.mjs";
import { queueSceneArt } from "./llm/artist.mjs";
import { subscribeRoom, subscribeLobby, broadcastRoom, broadcastLobby } from "./events.mjs";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(PUBLIC_DIR));
  app.use("/art", express.static(ART_DIR));

  app.get("/api/bootstrap", async (req, res) => {
    const db = getDb();
    const session = getSession(db, req);
    res.json({
      session,
      characters: session ? getOwnedCharacters(db, session.user.id) : [],
      races: RACES,
      classes: CLASSES,
      companions: COMPANIONS,
      modules: OFFICIAL_MODULES,
      rooms: listRooms(db, session?.user?.id),
      config: {
        aiEnabled: Boolean(getLlmConfig())
      }
    });
  });

  app.get("/api/events", (req, res) => {
    subscribeLobby(req, res);
  });

  app.post("/api/auth/guest", async (req, res) => {
    const db = getDb();
    const user = createUser(db, {
      name: `游客${String(Math.floor(Math.random() * 9000) + 1000)}`,
      isGuest: true,
      passwordHash: ""
    });
    const session = issueSession(db, user.id);
    await persist();
    res.json({ session, user });
  });

  app.post("/api/auth/register", async (req, res) => {
    const db = getDb();
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return res.status(400).json({ error: "用户名和密码不能为空。" });
    }
    if (findUserByName(db, username)) {
      return res.status(409).json({ error: "用户名已存在。" });
    }

    const user = createUser(db, {
      name: username,
      isGuest: false,
      passwordHash: hashText(password)
    });
    const session = issueSession(db, user.id);
    await persist();
    res.json({ session, user });
  });

  app.post("/api/auth/login", async (req, res) => {
    const db = getDb();
    const { username, password } = req.body ?? {};
    const user = findUserByName(db, username);
    if (!user || user.passwordHash !== hashText(password)) {
      return res.status(401).json({ error: "账号或密码错误。" });
    }

    const session = issueSession(db, user.id);
    await persist();
    res.json({ session, user });
  });

  app.post("/api/characters", async (req, res) => {
    const db = getDb();
    const session = requireSession(db, req, res);
    if (!session) {
      return;
    }

    const { name, raceId, classId, skillChoices = [], gearChoices = [], backstory = "" } =
      req.body ?? {};
    if (!name || !RACES[raceId] || !CLASSES[classId]) {
      return res.status(400).json({ error: "角色参数不完整。" });
    }

    const character = buildCharacter({
      id: crypto.randomUUID(),
      userId: session.user.id,
      name,
      raceId,
      classId,
      skillChoices,
      gearChoices,
      backstory
    });

    db.characters[character.id] = character;
    db.users[session.user.id].characterIds.unshift(character.id);
    await persist();
    res.json({ character });
  });

  app.post("/api/rooms", async (req, res) => {
    const db = getDb();
    const session = requireSession(db, req, res);
    if (!session) {
      return;
    }

    try {
      const { roomName, moduleId, scriptJson, companionIds = [], characterId } = req.body ?? {};
      const moduleDefinition = resolveModule(moduleId, scriptJson);
      const ownerCharacter = getOwnedCharacter(db, session.user.id, characterId);

      if (!roomName || !ownerCharacter) {
        return res.status(400).json({ error: "房间名称或角色无效。" });
      }

      const room = createRoom(db, {
        roomName,
        moduleDefinition,
        ownerId: session.user.id,
        characterId,
        companionIds
      });

      db.rooms[room.id] = room;
      await persist();
      queueSceneArt(room);
      broadcastLobby();
      res.json({ room: hydrateRoom(db, room, session.user.id) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/rooms/:roomId/join", async (req, res) => {
    const db = getDb();
    const session = requireSession(db, req, res);
    if (!session) {
      return;
    }

    const room = db.rooms[req.params.roomId];
    const { characterId } = req.body ?? {};
    const character = getOwnedCharacter(db, session.user.id, characterId);

    if (!room || !character) {
      return res.status(404).json({ error: "房间或角色不存在。" });
    }

    if (room.completed) {
      return res.status(400).json({ error: "该房间已结束，暂时不能再加入。" });
    }

    const existingPlayer = room.players.find((player) => player.userId === session.user.id);
    if (existingPlayer && existingPlayer.characterId !== characterId) {
      return res.status(409).json({ error: "你已经使用其他角色加入了这个房间。" });
    }

    const alreadyInRoom = room.players.some((player) => player.characterId === characterId);
    if (!alreadyInRoom) {
      room.players.push(buildPlayerEntry(db, session.user.id, characterId));
      pushLog(room, `${character.name} 加入了房间。`);
      room.lastUpdatedAt = new Date().toISOString();
      await persist();
      broadcastRoom(room.id, { type: "joined", lastUpdatedAt: room.lastUpdatedAt });
      broadcastLobby();
    }

    res.json({ room: hydrateRoom(db, room, session.user.id) });
  });

  app.get("/api/rooms/:roomId", async (req, res) => {
    const db = getDb();
    const room = db.rooms[req.params.roomId];
    if (!room) {
      return res.status(404).json({ error: "房间不存在。" });
    }

    const session = getSession(db, req);
    res.json({ room: hydrateRoom(db, room, session?.user?.id ?? null) });
  });

  app.get("/api/rooms/:roomId/events", (req, res) => {
    const db = getDb();
    const room = db.rooms[req.params.roomId];
    if (!room) {
      return res.status(404).json({ error: "房间不存在。" });
    }
    subscribeRoom(room.id, req, res);
  });

  app.post("/api/rooms/:roomId/action", async (req, res) => {
    const db = getDb();
    const session = requireSession(db, req, res);
    if (!session) {
      return;
    }

    const room = db.rooms[req.params.roomId];
    const { choiceId, characterId, freeText = "" } = req.body ?? {};
    if (!room) {
      return res.status(404).json({ error: "房间不存在。" });
    }

    if (room.completed) {
      return res.status(400).json({ error: "这个房间已经完成当前冒险了。" });
    }

    const actingCharacter = db.characters[characterId];
    if (!actingCharacter || actingCharacter.userId !== session.user.id) {
      return res.status(403).json({ error: "你只能使用自己的角色执行行动。" });
    }

    const roomMembership = room.players.find(
      (player) => player.userId === session.user.id && player.characterId === characterId
    );
    if (!roomMembership) {
      return res.status(403).json({ error: "请先以该角色加入房间后再行动。" });
    }

    if (roomMembership.status === "down") {
      return res.status(400).json({ error: `${actingCharacter.name} 已倒地，需要队友救助后才能行动。` });
    }

    const scene = getCurrentScene(room);
    let choice = null;
    let rescueTargetPlayer = null;

    if (typeof choiceId === "string" && choiceId.startsWith("rescue-")) {
      const targetCharacterId = choiceId.slice("rescue-".length);
      rescueTargetPlayer = room.players.find(
        (player) => player.characterId === targetCharacterId && player.status === "down"
      );
      const targetCharacter = db.characters[targetCharacterId];
      if (!rescueTargetPlayer || !targetCharacter) {
        return res.status(400).json({ error: "该同伴当前不需要救助。" });
      }
      choice = buildRescueChoice(targetCharacter);
    } else {
      choice =
        scene?.choices?.find((item) => item.id === choiceId) ??
        buildFreeChoice(scene, freeText, {
          moduleDifficulty: room.module.difficulty,
          pressure: room.pressure
        });
    }

    if (!choice || !scene) {
      return res.status(400).json({ error: "无效的行动。" });
    }

    const roll = rollD20();
    const abilityKey = SKILL_MAP[choice.skill] ?? "intellect";
    const abilityModifier = getModifier(actingCharacter.stats[abilityKey] ?? 10);
    const teamModifier = getCompanionBonus(room, choice.skill);
    const total = roll + abilityModifier + teamModifier;
    const dc = Number(choice.dc ?? room.module.difficulty ?? 12);
    const success = total >= dc;

    const maxHpOf = (player) => db.characters[player.characterId]?.maxHp ?? 10;
    const nameOf = (player) => db.characters[player.characterId]?.name ?? "队员";

    const events = applyActionOutcome({
      room,
      actingPlayer: roomMembership,
      rescueTargetPlayer,
      success,
      roll,
      total,
      dc,
      maxHpOf,
      nameOf
    });
    const eventNotes = describeOutcomeEvents(events);

    const party = room.players.map((player) => ({
      name: nameOf(player),
      hp: player.hp,
      maxHp: maxHpOf(player),
      status: player.status
    }));

    const narration = await narrateTurn({
      room,
      scene,
      choice,
      actingCharacter,
      success,
      roll,
      total,
      dc,
      freeText,
      party,
      eventNotes
    });

    room.turn += 1;
    room.lastUpdatedAt = new Date().toISOString();
    room.story.push({
      id: crypto.randomUUID(),
      sceneId: scene.id,
      choiceId: choice.id,
      choiceLabel: choice.label,
      actor: actingCharacter.name,
      success,
      roll,
      total,
      dc,
      narration
    });

    pushLog(
      room,
      `${actingCharacter.name} 执行「${choice.label}」: d20(${roll}) + 修正(${abilityModifier}) + 队友(${teamModifier}) = ${total} / DC ${dc} -> ${success ? "成功" : "失败"}`
    );
    for (const note of eventNotes) {
      pushLog(room, note);
    }
    pushLog(room, narration.logText);

    await persist();
    queueSceneArt(room);
    broadcastRoom(room.id, { type: "action", turn: room.turn, lastUpdatedAt: room.lastUpdatedAt });
    broadcastLobby();

    res.json({
      room: hydrateRoom(db, room, session.user.id),
      outcome: {
        success,
        roll,
        total,
        dc,
        narration,
        notes: eventNotes
      }
    });
  });

  app.use((req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  return app;
}

function getOwnedCharacters(db, userId) {
  return Object.values(db.characters)
    .filter((character) => character.userId === userId)
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

function getOwnedCharacter(db, userId, characterId) {
  const character = db.characters[characterId];
  if (!character || character.userId !== userId) {
    return null;
  }
  return character;
}
