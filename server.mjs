import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import express from "express";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, ".local");
const DATA_FILE = path.join(DATA_DIR, "app-state.json");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DEFAULT_AGENTROUTER_API_URL = "https://agentrouter.org/v1/chat/completions";
const DEFAULT_AGENTROUTER_MODEL = "glm-4.6";
const DEFAULT_MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5";

const RACES = {
  human: {
    label: "人类",
    portrait: "Human Strategist",
    bonuses: { strength: 1, agility: 1, intellect: 1, spirit: 1, charm: 1 }
  },
  dwarf: {
    label: "矮人",
    portrait: "Dwarf Warden",
    bonuses: { strength: 2, agility: 0, intellect: 0, spirit: 2, charm: -1 }
  },
  elf: {
    label: "精灵",
    portrait: "Elf Seer",
    bonuses: { strength: 0, agility: 2, intellect: 2, spirit: 0, charm: 1 }
  },
  tiefling: {
    label: "提夫林",
    portrait: "Infernal Diplomat",
    bonuses: { strength: 0, agility: 1, intellect: 1, spirit: 1, charm: 2 }
  }
};

const CLASSES = {
  fighter: {
    label: "战士",
    portrait: "Steel Vanguard",
    skills: ["athletics", "survival", "intimidation"],
    gear: ["长剑", "盾牌", "锁子甲"]
  },
  mage: {
    label: "法师",
    portrait: "Arcane Scholar",
    skills: ["arcana", "history", "investigation"],
    gear: ["法杖", "法术书", "奥术披风"]
  },
  cleric: {
    label: "牧师",
    portrait: "Temple Herald",
    skills: ["medicine", "insight", "religion"],
    gear: ["圣徽", "权杖", "治疗药剂"]
  },
  rogue: {
    label: "盗贼",
    portrait: "Shadow Operative",
    skills: ["stealth", "sleight", "deception"],
    gear: ["匕首", "开锁工具", "烟雾弹"]
  }
};

const COMPANIONS = [
  {
    id: "thief-cautious",
    name: "维斯",
    role: "谨慎的盗贼",
    trait: "偏好侦察与陷阱处理",
    modifiers: { stealth: 2, investigation: 1, deception: 1 }
  },
  {
    id: "cleric-rash",
    name: "艾琳",
    role: "鲁莽的牧师",
    trait: "治疗强，但冲动冒险",
    modifiers: { medicine: 2, persuasion: -1, athletics: 1 }
  },
  {
    id: "ranger-calm",
    name: "索恩",
    role: "冷静的游侠",
    trait: "擅长远程和追踪",
    modifiers: { survival: 2, perception: 2, athletics: 1 }
  }
];

const OFFICIAL_MODULES = [
  {
    id: "ember-catacomb",
    title: "余烬地窟",
    summary: "在火山余脉下探索一座被遗忘的熔岩墓穴。",
    tone: "heroic fantasy",
    difficulty: 13,
    scenes: [
      {
        id: "entrance",
        title: "地窟入口",
        description: "裂开的黑曜石门后涌出热浪，墙面铭文闪烁暗红光。",
        choices: [
          {
            id: "survey",
            label: "观察铭文",
            kind: "skill",
            skill: "arcana",
            dc: 12,
            successText: "你辨认出这是封印警告，指出了一条安全通道。",
            failureText: "你误解铭文，触发了熔火喷气。"
          },
          {
            id: "push",
            label: "强行推门",
            kind: "skill",
            skill: "athletics",
            dc: 14,
            successText: "石门轰然开启，露出通往祭坛的阶梯。",
            failureText: "门纹丝不动，巨响惊醒了地窟中的东西。"
          }
        ]
      },
      {
        id: "altar",
        title: "灰烬祭坛",
        description: "祭坛中央漂浮着一枚灼热晶核，周围散落盔甲残骸。",
        choices: [
          {
            id: "convince",
            label: "安抚守墓灵",
            kind: "skill",
            skill: "persuasion",
            dc: 13,
            successText: "守墓灵承认你并非盗墓者，允许你带走晶核。",
            failureText: "灵体怒吼，灰烬旋风席卷整个大厅。"
          },
          {
            id: "snatch",
            label: "直接夺取晶核",
            kind: "skill",
            skill: "sleight",
            dc: 15,
            successText: "你抓住时机迅速取走晶核，祭坛陷阱未能锁定你。",
            failureText: "晶核发出刺目强光，队伍被迫后撤。"
          }
        ]
      }
    ]
  },
  {
    id: "moonwatch-hollow",
    title: "月望空谷",
    summary: "护送失踪学者穿过被幻术笼罩的峡谷。",
    tone: "mystic exploration",
    difficulty: 12,
    scenes: [
      {
        id: "mist",
        title: "迷雾岔路",
        description: "银白迷雾吞没山道，远处传来疑似求救的回音。",
        choices: [
          {
            id: "track",
            label: "追踪脚印",
            kind: "skill",
            skill: "survival",
            dc: 12,
            successText: "你识破幻音，找到了真正的营地遗迹。",
            failureText: "你被雾中倒影误导，绕回了原地。"
          },
          {
            id: "pray",
            label: "以灵性感知异常",
            kind: "skill",
            skill: "insight",
            dc: 11,
            successText: "你的直觉锁定了施术者残留的魔力方向。",
            failureText: "幻术干扰了你的心智，队伍士气下降。"
          }
        ]
      }
    ]
  }
];

const SKILL_MAP = {
  athletics: "strength",
  survival: "spirit",
  intimidation: "charm",
  arcana: "intellect",
  history: "intellect",
  investigation: "intellect",
  medicine: "spirit",
  insight: "spirit",
  religion: "spirit",
  stealth: "agility",
  sleight: "agility",
  deception: "charm",
  persuasion: "charm",
  perception: "spirit"
};

let db = await loadState();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

app.get("/api/bootstrap", async (req, res) => {
  const session = getSession(req);
  res.json({
    session,
    characters: session ? getOwnedCharacters(session.user.id) : [],
    races: RACES,
    classes: CLASSES,
    companions: COMPANIONS,
    modules: OFFICIAL_MODULES,
    rooms: listRooms(session?.user?.id),
    config: {
      aiEnabled: Boolean(getLlmConfig())
    }
  });
});

app.post("/api/auth/guest", async (req, res) => {
  const user = createUser({
    name: `游客${String(Math.floor(Math.random() * 9000) + 1000)}`,
    isGuest: true,
    passwordHash: ""
  });
  const session = issueSession(user.id);
  await persist();
  res.json({ session, user });
});

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "用户名和密码不能为空。" });
  }
  if (findUserByName(username)) {
    return res.status(409).json({ error: "用户名已存在。" });
  }

  const user = createUser({
    name: username,
    isGuest: false,
    passwordHash: hashText(password)
  });
  const session = issueSession(user.id);
  await persist();
  res.json({ session, user });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  const user = findUserByName(username);
  if (!user || user.passwordHash !== hashText(password)) {
    return res.status(401).json({ error: "账号或密码错误。" });
  }

  const session = issueSession(user.id);
  await persist();
  res.json({ session, user });
});

app.post("/api/characters", async (req, res) => {
  const session = requireSession(req, res);
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
  const session = requireSession(req, res);
  if (!session) {
    return;
  }

  try {
    const { roomName, moduleId, scriptJson, companionIds = [], characterId } = req.body ?? {};
    const moduleDefinition = resolveModule(moduleId, scriptJson);
    const ownerCharacter = getOwnedCharacter(session.user.id, characterId);

    if (!roomName || !ownerCharacter) {
      return res.status(400).json({ error: "房间名称或角色无效。" });
    }

    const room = createRoom({
      roomName,
      moduleDefinition,
      ownerId: session.user.id,
      characterId,
      companionIds
    });

    db.rooms[room.id] = room;
    await persist();
    res.json({ room });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/rooms/:roomId/join", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) {
    return;
  }

  const room = db.rooms[req.params.roomId];
  const { characterId } = req.body ?? {};
  const character = getOwnedCharacter(session.user.id, characterId);

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
    room.players.push({
      userId: session.user.id,
      characterId,
      joinedAt: new Date().toISOString()
    });
    pushLog(room, `${character.name} 加入了房间。`);
    room.lastUpdatedAt = new Date().toISOString();
    await persist();
  }

  res.json({ room: hydrateRoom(room, session.user.id) });
});

app.get("/api/rooms/:roomId", async (req, res) => {
  const room = db.rooms[req.params.roomId];
  if (!room) {
    return res.status(404).json({ error: "房间不存在。" });
  }

  const session = getSession(req);
  res.json({ room: hydrateRoom(room, session?.user?.id ?? null) });
});

app.post("/api/rooms/:roomId/action", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) {
    return;
  }

  const room = db.rooms[req.params.roomId];
  const { choiceId, characterId, freeText = "" } = req.body ?? {};
  if (!room) {
    return res.status(404).json({ error: "房间不存在。" });
  }

  const actingCharacter = db.characters[characterId];
  const roomMembership = room.players.find(
    (player) => player.userId === session.user.id && player.characterId === characterId
  );
  const scene = getCurrentScene(room);
  const choice =
    scene?.choices?.find((item) => item.id === choiceId) ??
    buildFreeChoice(scene, freeText);

  if (room.completed) {
    return res.status(400).json({ error: "这个房间已经完成当前冒险了。" });
  }

  if (!actingCharacter || actingCharacter.userId !== session.user.id) {
    return res.status(403).json({ error: "你只能使用自己的角色执行行动。" });
  }

  if (!roomMembership) {
    return res.status(403).json({ error: "请先以该角色加入房间后再行动。" });
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

  const narration = await narrateTurn({
    room,
    scene,
    choice,
    actingCharacter,
    success,
    roll,
    total,
    dc,
    freeText
  });

  const wasLastScene = room.sceneIndex === room.module.scenes.length - 1;
  room.turn += 1;
  room.lastUpdatedAt = new Date().toISOString();
  room.story.push({
    id: crypto.randomUUID(),
    sceneId: scene.id,
    choiceId: choice.id,
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
  pushLog(room, narration.logText);

  if (success && !wasLastScene) {
    room.sceneIndex += 1;
  } else if (success && wasLastScene) {
    room.completed = true;
    pushLog(room, "冒险达成阶段性结局，房间已标记为完成。");
  }

  await persist();
  res.json({
    room: hydrateRoom(room, session.user.id),
    outcome: {
      success,
      roll,
      total,
      dc,
      narration
    }
  });
});

app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Dragons & Dungeons is listening on http://localhost:${PORT}`);
});

async function loadState() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    const content = await readFile(DATA_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    const initialState = {
      users: {},
      sessions: {},
      characters: {},
      rooms: {}
    };
    await writeFile(DATA_FILE, JSON.stringify(initialState, null, 2), "utf8");
    return initialState;
  }
}

async function persist() {
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function createUser({ name, isGuest, passwordHash }) {
  const id = crypto.randomUUID();
  const user = {
    id,
    name,
    isGuest,
    passwordHash,
    characterIds: [],
    createdAt: new Date().toISOString()
  };
  db.users[id] = user;
  return user;
}

function issueSession(userId) {
  const token = crypto.randomUUID();
  db.sessions[token] = {
    token,
    userId,
    createdAt: new Date().toISOString()
  };
  return {
    token,
    user: sanitizeUser(db.users[userId])
  };
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    isGuest: user.isGuest,
    characterIds: user.characterIds,
    createdAt: user.createdAt
  };
}

function findUserByName(name) {
  return Object.values(db.users).find((user) => user.name === name);
}

function getSession(req) {
  const token = req.headers["x-session-token"];
  if (!token || typeof token !== "string") {
    return null;
  }

  const rawSession = db.sessions[token];
  if (!rawSession) {
    return null;
  }

  return {
    token,
    user: sanitizeUser(db.users[rawSession.userId])
  };
}

function requireSession(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "请先登录或进入游客模式。" });
    return null;
  }
  return session;
}

function getOwnedCharacters(userId) {
  return Object.values(db.characters)
    .filter((character) => character.userId === userId)
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
}

function getOwnedCharacter(userId, characterId) {
  const character = db.characters[characterId];
  if (!character || character.userId !== userId) {
    return null;
  }
  return character;
}

function buildCharacter({ id, userId, name, raceId, classId, skillChoices, gearChoices, backstory }) {
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

  return {
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
}

function resolveModule(moduleId, scriptJson) {
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

function validateModule(moduleDefinition) {
  if (!moduleDefinition?.title || !Array.isArray(moduleDefinition.scenes) || !moduleDefinition.scenes.length) {
    throw new Error("剧本必须包含 title 和 scenes。");
  }
}

function createRoom({ roomName, moduleDefinition, ownerId, characterId, companionIds }) {
  const roomId = crypto.randomUUID().slice(0, 8);
  const room = {
    id: roomId,
    roomName,
    ownerId,
    module: moduleDefinition,
    players: [
      {
        userId: ownerId,
        characterId,
        joinedAt: new Date().toISOString()
      }
    ],
    companions: companionIds
      .map((companionId) => COMPANIONS.find((companion) => companion.id === companionId))
      .filter(Boolean),
    sceneIndex: 0,
    turn: 0,
    story: [],
    logs: [],
    completed: false,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString()
  };
  pushLog(room, `房间「${roomName}」已建立，剧本为《${moduleDefinition.title}》。`);
  return room;
}

function hydrateRoom(room, viewerUserId = null) {
  const viewerMembership = viewerUserId
    ? room.players.find((player) => player.userId === viewerUserId) ?? null
    : null;

  return {
    ...room,
    inviteCode: room.id.toUpperCase(),
    owner: sanitizeUser(db.users[room.ownerId]),
    currentScene: getCurrentScene(room),
    viewer: {
      isMember: Boolean(viewerMembership),
      characterId: viewerMembership?.characterId ?? null
    },
    players: room.players.map((player) => ({
      ...player,
      user: sanitizeUser(db.users[player.userId]),
      character: db.characters[player.characterId]
    })),
    sceneArt: buildSceneArt(room)
  };
}

function listRooms(viewerUserId = null) {
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

function getCurrentScene(room) {
  return room.module.scenes[room.sceneIndex] ?? room.module.scenes.at(-1);
}

function getModifier(score) {
  return Math.floor((score - 10) / 2);
}

function rollD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function getCompanionBonus(room, skill) {
  return room.companions.reduce((sum, companion) => sum + Number(companion.modifiers?.[skill] ?? 0), 0);
}

function pushLog(room, message) {
  room.logs.unshift({
    id: crypto.randomUUID(),
    text: message,
    at: new Date().toISOString()
  });
  room.logs = room.logs.slice(0, 40);
}

function buildFreeChoice(scene, freeText) {
  if (!freeText?.trim()) {
    return null;
  }

  return {
    id: `free-${crypto.randomUUID().slice(0, 6)}`,
    label: freeText,
    kind: "free",
    skill: inferSkillFromText(freeText, scene),
    dc: 13
  };
}

function inferSkillFromText(freeText, scene) {
  const merged = `${freeText} ${scene?.description ?? ""}`;
  if (/[潜行|躲|隐匿|偷]/.test(merged)) {
    return "stealth";
  }
  if (/[说服|交涉|谈判|劝]/.test(merged)) {
    return "persuasion";
  }
  if (/[调查|观察|分析]/.test(merged)) {
    return "investigation";
  }
  if (/[推|举|撞|砍|冲]/.test(merged)) {
    return "athletics";
  }
  return "insight";
}

async function narrateTurn({ room, scene, choice, actingCharacter, success, roll, total, dc, freeText }) {
  const aiNarration = await tryAiNarration({
    room,
    scene,
    choice,
    actingCharacter,
    success,
    roll,
    total,
    dc,
    freeText
  });
  if (aiNarration) {
    return aiNarration;
  }

  const baseText = success
    ? choice.successText ?? "队伍把握住了时机，局势朝有利方向推进。"
    : choice.failureText ?? "行动未能如愿，局势变得更紧张了。";
  const nextPrompt = success
    ? "新的通路在你们面前展开。"
    : "危险仍在逼近，队伍需要重新评估策略。";

  return {
    title: `${scene.title} · ${success ? "突破" : "受阻"}`,
    body: `${actingCharacter.name}选择了“${choice.label}”。${baseText}${nextPrompt}`,
    logText: `${scene.title}: ${actingCharacter.name}${success ? "成功完成" : "未能完成"}「${choice.label}」。`
  };
}

async function tryAiNarration(context) {
  const llmConfig = getLlmConfig();
  if (!llmConfig) {
    return null;
  }

  const prompt = [
    "你是一个中世纪奇幻 TRPG 旁白。",
    `剧本: ${context.room.module.title}`,
    `当前场景: ${context.scene.title} - ${context.scene.description}`,
    `角色: ${context.actingCharacter.name}`,
    `行动: ${context.choice.label}`,
    `检定结果: ${context.success ? "成功" : "失败"}，总值 ${context.total}，DC ${context.dc}`,
    "请只返回一个 JSON 对象，格式为 {\"title\":\"\",\"body\":\"\",\"logText\":\"\"}。不要输出额外解释。"
  ].join("\n");

  const requestBodies = [
    {
      model: llmConfig.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.8
    },
    {
      model: llmConfig.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8
    }
  ];

  try {
    for (const body of requestBodies) {
      const response = await fetch(llmConfig.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmConfig.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      const parsed = parseNarrationContent(content);
      if (parsed) {
        return parsed;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function getLlmConfig() {
  const provider = normalizeProvider(process.env.LLM_PROVIDER);
  const llmApiKey = process.env.LLM_API_KEY?.trim() || "";
  const minimaxApiKey = process.env.MINIMAX_API_KEY?.trim() || "";
  const zhipuApiKey = process.env.ZHIPU_API_KEY?.trim() || "";

  if (provider === "minimax" && (llmApiKey || minimaxApiKey)) {
    return {
      provider: "minimax",
      apiKey: minimaxApiKey || llmApiKey,
      apiUrl: normalizeChatCompletionsUrl(
        process.env.MINIMAX_BASE_URL ||
          process.env.LLM_BASE_URL ||
          process.env.LLM_API_URL ||
          DEFAULT_MINIMAX_API_URL
      ),
      model:
        process.env.MINIMAX_MODEL?.trim() ||
        process.env.LLM_MODEL?.trim() ||
        DEFAULT_MINIMAX_MODEL
    };
  }

  if (llmApiKey || zhipuApiKey) {
    return {
      provider: provider || "generic",
      apiKey: llmApiKey || zhipuApiKey,
      apiUrl: normalizeChatCompletionsUrl(
        process.env.LLM_API_URL || process.env.LLM_BASE_URL || DEFAULT_AGENTROUTER_API_URL
      ),
      model: process.env.LLM_MODEL?.trim() || DEFAULT_AGENTROUTER_MODEL
    };
  }

  if (minimaxApiKey) {
    return {
      provider: "minimax",
      apiKey: minimaxApiKey,
      apiUrl: normalizeChatCompletionsUrl(
        process.env.MINIMAX_BASE_URL || process.env.LLM_BASE_URL || DEFAULT_MINIMAX_API_URL
      ),
      model:
        process.env.MINIMAX_MODEL?.trim() ||
        process.env.LLM_MODEL?.trim() ||
        DEFAULT_MINIMAX_MODEL
    };
  }

  return null;
}

function normalizeProvider(rawValue) {
  return String(rawValue || "")
    .trim()
    .toLowerCase();
}

function normalizeChatCompletionsUrl(rawUrl) {
  const value = String(rawUrl || "").trim().replace(/\/+$/, "");
  if (!value) {
    return DEFAULT_AGENTROUTER_API_URL;
  }
  if (value.endsWith("/chat/completions")) {
    return value;
  }
  if (value.endsWith("/v1")) {
    return `${value}/chat/completions`;
  }
  if (value === "https://agentrouter.org") {
    return "https://agentrouter.org/v1/chat/completions";
  }
  return `${value}/v1/chat/completions`;
}

function parseNarrationContent(content) {
  if (!content || typeof content !== "string") {
    return null;
  }

  const cleaned = stripThinkTags(content).trim();
  if (!cleaned) {
    return null;
  }

  try {
    return JSON.parse(cleaned);
  } catch {}

  const jsonLike = cleaned.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonLike) {
    return null;
  }

  try {
    return JSON.parse(jsonLike);
  } catch {
    return null;
  }
}

function stripThinkTags(content) {
  return String(content).replace(/<think>[\s\S]*?<\/think>/gi, "");
}

function buildSceneArt(room) {
  const scene = getCurrentScene(room);
  const palette = room.completed
    ? ["#d4b06a", "#f3e7bf", "#6d4b26"]
    : ["#4d2c1d", "#d19d55", "#1e1411"];
  const title = encodeXml(scene.title);
  const summary = encodeXml(scene.description.slice(0, 80));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}" />
          <stop offset="55%" stop-color="${palette[1]}" />
          <stop offset="100%" stop-color="${palette[2]}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#sky)" />
      <circle cx="945" cy="140" r="84" fill="rgba(255,248,220,0.35)" />
      <path d="M0 560 C180 470, 330 640, 540 560 S930 430, 1200 580 L1200 720 L0 720 Z" fill="rgba(35,19,14,0.65)" />
      <path d="M0 610 C200 540, 410 690, 650 610 S980 520, 1200 645 L1200 720 L0 720 Z" fill="rgba(15,8,6,0.82)" />
      <rect x="88" y="94" width="1024" height="532" rx="24" fill="rgba(245, 232, 204, 0.12)" stroke="rgba(245,232,204,0.28)" stroke-width="2" />
      <text x="120" y="180" fill="#fff7df" font-size="62" font-family="Georgia, serif">${title}</text>
      <text x="120" y="250" fill="#fef4d6" font-size="28" font-family="Georgia, serif">${summary}</text>
      <text x="120" y="608" fill="#fbe9b6" font-size="24" font-family="Georgia, serif">Scene Illustration · ${encodeXml(room.module.title)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function encodeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
