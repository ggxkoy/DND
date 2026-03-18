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
const DEFAULT_LLM_API_URL = "https://agentrouter.org/v1/chat/completions";
const DEFAULT_LLM_MODEL = "glm-4.6";
const NARRATIVE_TEMPLATES = {
  coc7: {
    label: "COC7 调查",
    short: "守秘人调查",
    aiStyle:
      "你是《克苏鲁的呼唤》第七版风格的守秘人。强调未知恐惧、线索、理智压力、压抑气氛。",
    fallbackTone: "压抑、诡异、调查导向"
  },
  fantasy: {
    label: "奇幻冒险",
    short: "地下城奇幻",
    aiStyle:
      "你是经典奇幻 TRPG 旁白。强调英雄行动、遗迹、魔法痕迹、战术空间与高戏剧性反馈。",
    fallbackTone: "神秘、冒险、史诗感"
  }
};

const ATTRIBUTES = ["str", "con", "siz", "dex", "app", "int", "pow", "edu"];
const SUCCESS_NAMES = {
  critical: "大成功",
  extreme: "极难成功",
  hard: "困难成功",
  regular: "常规成功",
  failure: "失败",
  fumble: "大失败"
};
const DIFFICULTY_NAMES = {
  regular: "常规",
  hard: "困难",
  extreme: "极难"
};

const OCCUPATIONS = {
  antiquarian: {
    label: "古董商",
    portrait: "dusty antiquarian, 1920s cosmic horror illustration",
    credit: [30, 70],
    occupationSkills: [
      "appraise",
      "history",
      "libraryUse",
      "spotHidden",
      "charm",
      "psychology",
      "languageOwn",
      "languageOther"
    ],
    skillBonuses: { appraise: 25, history: 20, libraryUse: 20, spotHidden: 15 }
  },
  journalist: {
    label: "记者",
    portrait: "restless journalist, flashbulb noir, 1920s cosmic horror",
    credit: [9, 30],
    occupationSkills: [
      "artCraftPhotography",
      "fastTalk",
      "languageOwn",
      "libraryUse",
      "psychology",
      "spotHidden",
      "listen",
      "persuade"
    ],
    skillBonuses: { fastTalk: 25, libraryUse: 20, spotHidden: 20, psychology: 10 }
  },
  doctor: {
    label: "医生",
    portrait: "fatigued physician, surgical gloves, 1920s horror art",
    credit: [30, 80],
    occupationSkills: [
      "firstAid",
      "medicine",
      "scienceBiology",
      "psychology",
      "languageLatin",
      "persuade",
      "listen",
      "sciencePharmacy"
    ],
    skillBonuses: { firstAid: 25, medicine: 25, psychology: 15, listen: 10 }
  },
  detective: {
    label: "侦探",
    portrait: "private detective, trench coat, rain-soaked lovecraftian alley",
    credit: [20, 50],
    occupationSkills: [
      "law",
      "libraryUse",
      "listen",
      "psychology",
      "spotHidden",
      "track",
      "firearmsHandgun",
      "stealth"
    ],
    skillBonuses: { spotHidden: 25, psychology: 20, law: 15, track: 15 }
  }
};

const CORE_SKILLS = {
  appraise: { label: "估价", base: 5, attribute: "edu" },
  archaeology: { label: "考古学", base: 1, attribute: "edu" },
  artCraftPhotography: { label: "艺术/手艺（摄影）", base: 5, attribute: "dex" },
  charm: { label: "魅惑", base: 15, attribute: "app" },
  fastTalk: { label: "话术", base: 5, attribute: "app" },
  firearmsHandgun: { label: "射击（手枪）", base: 20, attribute: "dex" },
  firstAid: { label: "急救", base: 30, attribute: "edu" },
  history: { label: "历史", base: 5, attribute: "edu" },
  intimidate: { label: "恐吓", base: 15, attribute: "pow" },
  languageLatin: { label: "外语（拉丁语）", base: 1, attribute: "edu" },
  languageOther: { label: "外语", base: 1, attribute: "edu" },
  languageOwn: { label: "母语", base: 40, attribute: "edu" },
  law: { label: "法律", base: 5, attribute: "edu" },
  libraryUse: { label: "图书馆使用", base: 20, attribute: "edu" },
  listen: { label: "聆听", base: 20, attribute: "pow" },
  medicine: { label: "医学", base: 1, attribute: "edu" },
  occult: { label: "神秘学", base: 5, attribute: "edu" },
  persuade: { label: "说服", base: 10, attribute: "pow" },
  psychology: { label: "心理学", base: 10, attribute: "pow" },
  scienceBiology: { label: "科学（生物）", base: 1, attribute: "edu" },
  sciencePharmacy: { label: "科学（药学）", base: 1, attribute: "edu" },
  stealth: { label: "潜行", base: 20, attribute: "dex" },
  spotHidden: { label: "侦查", base: 25, attribute: "int" },
  track: { label: "追踪", base: 10, attribute: "int" }
};

const COMPANIONS = [
  {
    id: "nun-mara",
    name: "玛拉修女",
    role: "冷静的照护者",
    trait: "擅长安抚与急救，见惯了噩梦。",
    support: { skill: "firstAid", bonusDice: 1, sanBuffer: 1 }
  },
  {
    id: "porter-hale",
    name: "黑尔",
    role: "寡言搬运工",
    trait: "能在最糟的天气里搬开封死的门板。",
    support: { skill: "spotHidden", bonusDice: 1 }
  },
  {
    id: "reporter-ivy",
    name: "艾薇",
    role: "偏执记者",
    trait: "闻得到谎言，也敢追问不该问的名字。",
    support: { skill: "psychology", bonusDice: 1 }
  }
];

const OFFICIAL_MODULES = [
  {
    id: "nameless-wharf",
    title: "无名码头",
    summary: "调查夜雾中的失踪者与一艘从未靠岸的货船。",
    tone: "cosmic dread",
    scenes: [
      {
        id: "fog-pier",
        title: "雾中的木栈桥",
        description:
          "夜潮把腐木拍得发响，潮湿绳索上残留着奇怪的海腥味。远处有汽笛，但码头尽头并没有船。",
        choices: [
          {
            id: "inspect-prints",
            label: "检查潮湿脚印",
            skill: "track",
            difficulty: "regular",
            bonusSkillFromCompanion: "track",
            successText: "脚印在尽头突然消失，像是有人被拖进了水里。",
            failureText: "潮水抹平了痕迹，只剩下令人烦躁的回音。",
            sanLossOnFailure: [0, 1]
          },
          {
            id: "listen-horn",
            label: "聆听雾中汽笛",
            skill: "listen",
            difficulty: "hard",
            successText: "那不是船笛，更像某种模仿汽笛的呼号。",
            failureText: "你听了太久，反而分不清那声音来自海上还是脑海。",
            sanLossOnFailure: [1, 3]
          }
        ]
      },
      {
        id: "warehouse",
        title: "封死的仓库",
        description:
          "仓库门上的铁钉崭新得不合时宜，地面却散着一圈早已干涸的盐渍。门缝里似乎有人低声祈祷。",
        choices: [
          {
            id: "force-door",
            label: "撬开门板",
            skill: "spotHidden",
            difficulty: "regular",
            successText: "你先发现了暗钩，没让自己触发门后的陷阱。",
            failureText: "门后坠落的符纸碎片让你胸口一紧，某种东西正在醒来。",
            sanLossOnFailure: [1, 4]
          },
          {
            id: "calm-voice",
            label: "尝试安抚门后的人",
            skill: "persuade",
            difficulty: "hard",
            successText: "门后的人哆嗦着交出钥匙，并低声说出“深潜者”一词。",
            failureText: "祈祷瞬间变成尖叫，你只来得及后退。",
            sanLossOnFailure: [1, 3]
          }
        ]
      }
    ]
  },
  {
    id: "st-august-ledger",
    title: "圣奥古斯丁账本",
    summary: "一份教会账本记录了不该存在的病人与死亡日期。",
    tone: "gothic mystery",
    scenes: [
      {
        id: "archive",
        title: "教堂档案室",
        description:
          "尘封账册堆得像坟丘，煤油灯照亮了墙上被刮去的圣像眼睛。空气中弥漫着药味和蜡油味。",
        choices: [
          {
            id: "find-ledger",
            label: "查找异常账目",
            skill: "libraryUse",
            difficulty: "regular",
            successText: "你找到了被换封皮的账本，里面每隔七页就会重复一个名字。",
            failureText: "你翻错了册子，先看到了令人反胃的临终记录。",
            sanLossOnFailure: [0, 2]
          },
          {
            id: "read-margin",
            label: "解读页边批注",
            skill: "occult",
            difficulty: "hard",
            successText: "这些批注不是祷词，而是某种召唤顺序。",
            failureText: "你只看懂了零碎音节，但它们已经在你脑中形成回声。",
            sanLossOnFailure: [1, 4]
          }
        ]
      }
    ]
  }
];

let db = await loadState();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(PUBLIC_DIR));

app.get("/api/bootstrap", (req, res) => {
  const session = getSession(req);
  res.json({
    session,
    characters: session ? getOwnedCharacters(session.user.id) : [],
    occupations: OCCUPATIONS,
    skills: CORE_SKILLS,
    companions: COMPANIONS,
    modules: OFFICIAL_MODULES.map(summarizeModule),
    narrativeTemplates: NARRATIVE_TEMPLATES,
    rooms: listRooms(),
    config: {
      aiEnabled: Boolean(getLlmApiKey()),
      system: "COC7"
    }
  });
});

app.post("/api/auth/guest", async (req, res) => {
  const user = createUser({
    name: `访客${String(Math.floor(Math.random() * 9000) + 1000)}`,
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

  const {
    name,
    occupationId,
    interestSkills = [],
    backstory = "",
    hometown = "",
    age = 28
  } = req.body ?? {};

  if (!name || !OCCUPATIONS[occupationId]) {
    return res.status(400).json({ error: "调查员参数不完整。" });
  }

  const character = buildInvestigator({
    id: crypto.randomUUID(),
    userId: session.user.id,
    name,
    occupationId,
    interestSkills,
    backstory,
    hometown,
    age: Number(age) || 28
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
    const {
      roomName,
      moduleId,
      scriptJson,
      companionIds = [],
      characterId,
      narrationTemplate = "coc7"
    } = req.body ?? {};
    if (!roomName || !characterId || !db.characters[characterId]) {
      return res.status(400).json({ error: "房间名称或调查员无效。" });
    }
    const moduleDefinition = resolveModule(moduleId, scriptJson);
    const room = createRoom({
      roomName,
      moduleDefinition,
      ownerId: session.user.id,
      characterId,
      companionIds,
      narrationTemplate
    });
    db.rooms[room.id] = room;
    await persist();
    res.json({ room: hydrateRoom(room) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/rooms/:roomId", (req, res) => {
  const room = db.rooms[req.params.roomId];
  if (!room || !isCocRoom(room)) {
    return res.status(404).json({ error: "房间不存在。" });
  }
  res.json({ room: hydrateRoom(room) });
});

app.post("/api/rooms/:roomId/action", async (req, res) => {
  const session = requireSession(req, res);
  if (!session) {
    return;
  }

  const room = db.rooms[req.params.roomId];
  const { choiceId, characterId, freeText = "", narrationTemplate } = req.body ?? {};
  if (!room || !isCocRoom(room)) {
    return res.status(404).json({ error: "房间不存在。" });
  }
  if (narrationTemplate && NARRATIVE_TEMPLATES[narrationTemplate]) {
    room.narrationTemplate = narrationTemplate;
  }

  const investigator = db.characters[characterId];
  const scene = getCurrentScene(room);
  const choice = scene?.choices?.find((item) => item.id === choiceId) ?? buildFreeChoice(freeText);
  if (!investigator || !scene || !choice) {
    return res.status(400).json({ error: "无效行动。" });
  }

  const effectiveSkill = getEffectiveSkill(investigator, choice.skill);
  const support = getSupportEffect(room, choice.skill);
  const roll = rollD100({
    bonusDice: support.skill === choice.skill ? support.bonusDice : 0,
    penaltyDice: choice.penaltyDice ?? 0
  });
  const outcome = evaluateCheck({
    roll: roll.value,
    skill: effectiveSkill,
    difficulty: choice.difficulty || "regular"
  });
  const sanLossRange = outcome.success
    ? choice.sanLossOnSuccess ?? [0, 0]
    : choice.sanLossOnFailure ?? [0, 1];
  const sanLoss = Math.max(0, rollRange(sanLossRange) - (support.sanBuffer || 0));
  investigator.derived.san = Math.max(0, investigator.derived.san - sanLoss);
  investigator.status.lastSanLoss = sanLoss;
  investigator.status.lastRoll = roll.value;

  const narration = await narrateTurn({
    room,
    scene,
    choice,
    investigator,
    outcome,
    sanLoss,
    roll,
    effectiveSkill
  });

  room.turn += 1;
  room.lastUpdatedAt = new Date().toISOString();
  room.story.push({
    id: crypto.randomUUID(),
    sceneId: scene.id,
    actor: investigator.name,
    choiceId: choice.id,
    result: outcome.level,
    roll: roll.value,
    target: outcome.target,
    sanLoss,
    narration
  });
  pushLog(
    room,
    `${investigator.name}进行 ${CORE_SKILLS[choice.skill]?.label || choice.skill} 检定：${roll.label} 对 ${outcome.target}，结果为${SUCCESS_NAMES[outcome.level]}。`
  );
  if (sanLoss > 0) {
    pushLog(room, `${investigator.name} 失去 ${sanLoss} 点理智。`);
  }
  pushLog(room, narration.logText);

  const wasLastScene = room.sceneIndex === room.module.scenes.length - 1;
  if (outcome.success && !wasLastScene) {
    room.sceneIndex += 1;
  } else if (outcome.success && wasLastScene) {
    room.completed = true;
    pushLog(room, "调查抵达阶段性结局，守秘人记录已封存。");
  }

  await persist();
  res.json({
    room: hydrateRoom(room),
    outcome: {
      roll: roll.value,
      target: outcome.target,
      level: outcome.level,
      label: SUCCESS_NAMES[outcome.level],
      success: outcome.success,
      sanLoss,
      narration
    }
  });
});

app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`COC7 web table is listening on http://localhost:${PORT}`);
});

async function loadState() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    const initialState = { users: {}, sessions: {}, characters: {}, rooms: {} };
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
  return { token, user: sanitizeUser(db.users[userId]) };
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
  if (!token || typeof token !== "string" || !db.sessions[token]) {
    return null;
  }
  return { token, user: sanitizeUser(db.users[db.sessions[token].userId]) };
}

function requireSession(req, res) {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: "请先登录或以访客进入。" });
    return null;
  }
  return session;
}

function getOwnedCharacters(userId) {
  return Object.values(db.characters)
    .filter((character) => character.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function buildInvestigator({ id, userId, name, occupationId, interestSkills, backstory, hometown, age }) {
  const occupation = OCCUPATIONS[occupationId];
  const stats = generateAttributes(name, occupationId);
  const derived = deriveStats(stats);
  const skills = buildSkills(occupation, stats, interestSkills);

  return {
    id,
    userId,
    name,
    occupationId,
    age,
    hometown,
    backstory,
    stats,
    derived,
    skills,
    portraitPrompt: occupation.portrait,
    createdAt: new Date().toISOString(),
    status: {
      lastRoll: null,
      lastSanLoss: 0
    }
  };
}

function generateAttributes(seedA, seedB) {
  const seed = hashText(`${seedA}:${seedB}`);
  let cursor = 0;
  const next = (min, max) => {
    const part = seed.slice(cursor, cursor + 4);
    cursor = (cursor + 4) % seed.length;
    return min + (parseInt(part, 16) % (max - min + 1));
  };

  return {
    str: next(40, 80),
    con: next(40, 80),
    siz: next(40, 80),
    dex: next(40, 80),
    app: next(35, 80),
    int: next(50, 85),
    pow: next(45, 80),
    edu: next(50, 90)
  };
}

function deriveStats(stats) {
  const sum = stats.str + stats.siz;
  const dbTable = getDamageBonusAndBuild(sum);
  return {
    hp: Math.floor((stats.con + stats.siz) / 10),
    mp: Math.floor(stats.pow / 5),
    san: stats.pow,
    luck: clamp(rollRange([40, 80]), 20, 99),
    move: computeMove(stats),
    damageBonus: dbTable.damageBonus,
    build: dbTable.build
  };
}

function buildSkills(occupation, stats, interestSkills) {
  const result = {};
  for (const [skillId, definition] of Object.entries(CORE_SKILLS)) {
    result[skillId] = definition.base + Math.floor((stats[definition.attribute] || 0) / 10);
  }
  for (const [skillId, bonus] of Object.entries(occupation.skillBonuses || {})) {
    result[skillId] = clamp((result[skillId] || 0) + bonus, 1, 95);
  }
  for (const skillId of interestSkills.filter(Boolean)) {
    result[skillId] = clamp((result[skillId] || 0) + 10, 1, 95);
  }
  return result;
}

function getDamageBonusAndBuild(sum) {
  if (sum <= 64) return { damageBonus: "-2", build: -2 };
  if (sum <= 84) return { damageBonus: "-1", build: -1 };
  if (sum <= 124) return { damageBonus: "0", build: 0 };
  if (sum <= 164) return { damageBonus: "+1d4", build: 1 };
  if (sum <= 204) return { damageBonus: "+1d6", build: 2 };
  const extra = Math.ceil((sum - 204) / 80);
  return { damageBonus: `+${extra + 1}d6`, build: 2 + extra };
}

function computeMove(stats) {
  if (stats.dex < stats.siz && stats.str < stats.siz) return 7;
  if (stats.dex > stats.siz && stats.str > stats.siz) return 9;
  return 8;
}

function resolveModule(moduleId, scriptJson) {
  if (scriptJson) {
    const parsed = JSON.parse(scriptJson);
    validateModule(parsed);
    return parsed;
  }
  const official = OFFICIAL_MODULES.find((module) => module.id === moduleId);
  if (!official) {
    throw new Error("未找到指定模组。");
  }
  return official;
}

function validateModule(moduleDefinition) {
  if (!moduleDefinition?.title || !Array.isArray(moduleDefinition.scenes) || !moduleDefinition.scenes.length) {
    throw new Error("模组必须包含 title 和 scenes。");
  }
}

function summarizeModule(module) {
  return {
    id: module.id,
    title: module.title,
    summary: module.summary,
    tone: module.tone
  };
}

function createRoom({ roomName, moduleDefinition, ownerId, characterId, companionIds, narrationTemplate }) {
  const room = {
    id: crypto.randomUUID().slice(0, 8),
    roomName,
    ownerId,
    module: moduleDefinition,
    players: [{ userId: ownerId, characterId, joinedAt: new Date().toISOString() }],
    companions: companionIds
      .map((id) => COMPANIONS.find((item) => item.id === id))
      .filter(Boolean),
    narrationTemplate: NARRATIVE_TEMPLATES[narrationTemplate] ? narrationTemplate : "coc7",
    sceneIndex: 0,
    turn: 0,
    story: [],
    logs: [],
    completed: false,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString()
  };
  pushLog(room, `调查房间「${roomName}」已建立，模组为《${moduleDefinition.title}》。`);
  return room;
}

function hydrateRoom(room) {
  return {
    ...room,
    currentScene: getCurrentScene(room),
    players: room.players.map((player) => ({
      ...player,
      user: sanitizeUser(db.users[player.userId]),
      character: db.characters[player.characterId]
    })),
    sceneArt: buildSceneArt(room)
  };
}

function listRooms() {
  return Object.values(db.rooms)
    .filter(isCocRoom)
    .sort((a, b) => (a.lastUpdatedAt < b.lastUpdatedAt ? 1 : -1))
    .map((room) => ({
      id: room.id,
      roomName: room.roomName,
      moduleTitle: room.module.title,
      players: room.players.length,
      completed: room.completed,
      lastUpdatedAt: room.lastUpdatedAt
    }));
}

function getCurrentScene(room) {
  return room.module.scenes[room.sceneIndex] ?? room.module.scenes.at(-1);
}

function isCocRoom(room) {
  if (!room?.module?.scenes?.every((scene) => Array.isArray(scene.choices))) {
    return false;
  }
  const validChoices = room.module.scenes.every((scene) =>
    scene.choices.every((choice) => !choice.skill || CORE_SKILLS[choice.skill])
  );
  const validPlayers = room.players?.every((player) => db.characters[player.characterId]?.occupationId);
  return Boolean(validChoices && validPlayers);
}

function getEffectiveSkill(investigator, skillId) {
  return clamp(investigator.skills[skillId] || CORE_SKILLS[skillId]?.base || 5, 1, 99);
}

function getSupportEffect(room, skillId) {
  return room.companions.reduce(
    (acc, companion) => {
      if (companion.support.skill === skillId) {
        acc.skill = skillId;
        acc.bonusDice += companion.support.bonusDice || 0;
        acc.sanBuffer += companion.support.sanBuffer || 0;
      }
      return acc;
    },
    { skill: null, bonusDice: 0, sanBuffer: 0 }
  );
}

function rollD100({ bonusDice = 0, penaltyDice = 0 } = {}) {
  const ones = randomInt(0, 9);
  const baseTens = randomInt(0, 9);
  const tensPool = [baseTens];
  for (let i = 0; i < Math.max(bonusDice, penaltyDice); i += 1) {
    tensPool.push(randomInt(0, 9));
  }
  const chosenTens =
    bonusDice > penaltyDice
      ? Math.min(...tensPool)
      : penaltyDice > bonusDice
        ? Math.max(...tensPool)
        : baseTens;
  const value = chosenTens === 0 && ones === 0 ? 100 : chosenTens * 10 + ones;
  return {
    value,
    label:
      bonusDice || penaltyDice
        ? `${value}（十位池 ${tensPool.join("/")}，个位 ${ones}）`
        : `${value}`
  };
}

function evaluateCheck({ roll, skill, difficulty }) {
  const regularTarget = skill;
  const hardTarget = Math.floor(skill / 2);
  const extremeTarget = Math.floor(skill / 5);
  const target =
    difficulty === "extreme"
      ? extremeTarget
      : difficulty === "hard"
        ? hardTarget
        : regularTarget;

  if (roll === 1) {
    return { success: true, level: "critical", target };
  }
  if ((roll === 100 || (roll >= 96 && skill < 50)) && roll > target) {
    return { success: false, level: "fumble", target };
  }
  if (roll <= extremeTarget) {
    return { success: true, level: "extreme", target };
  }
  if (roll <= hardTarget) {
    return { success: true, level: "hard", target };
  }
  if (roll <= regularTarget && roll <= target) {
    return { success: true, level: "regular", target };
  }
  return { success: false, level: "failure", target };
}

function buildFreeChoice(freeText) {
  if (!freeText?.trim()) {
    return null;
  }
  return {
    id: `free-${crypto.randomUUID().slice(0, 6)}`,
    label: freeText.trim(),
    skill: inferSkill(freeText),
    difficulty: "regular",
    sanLossOnFailure: [0, 1]
  };
}

function inferSkill(text) {
  if (/[调查|搜索|查看|分析]/.test(text)) return "spotHidden";
  if (/[说服|安抚|交流|谈判]/.test(text)) return "persuade";
  if (/[倾听|偷听|辨认声音]/.test(text)) return "listen";
  if (/[躲藏|潜入|跟踪]/.test(text)) return "stealth";
  if (/[查资料|翻书|检索]/.test(text)) return "libraryUse";
  return "psychology";
}

async function narrateTurn({ room, scene, choice, investigator, outcome, sanLoss, roll, effectiveSkill }) {
  const aiNarration = await tryAiNarration({
    room,
    scene,
    choice,
    investigator,
    outcome,
    sanLoss,
    roll,
    effectiveSkill
  });
  if (aiNarration) {
    return aiNarration;
  }

  const conclusion = outcome.success
    ? choice.successText || "调查员从恐惧里撬开了一条线索。"
    : choice.failureText || "线索没有出现，只有更沉重的不安。";
  const template = NARRATIVE_TEMPLATES[room.narrationTemplate] || NARRATIVE_TEMPLATES.coc7;
  return {
    title: `${scene.title} · ${SUCCESS_NAMES[outcome.level]}`,
    body: `【${template.short}】${investigator.name}以 ${roll.value}/${effectiveSkill} 的结果进行${CORE_SKILLS[choice.skill]?.label || choice.skill}检定，得到${SUCCESS_NAMES[outcome.level]}。${conclusion}${sanLoss > 0 ? ` 理智再度滑落 ${sanLoss} 点。` : ""}`,
    logText: `${scene.title}：${investigator.name}${outcome.success ? "取得线索" : "没能稳住局面"}。`
  };
}

async function tryAiNarration(context) {
  const apiKey = getLlmApiKey();
  if (!apiKey) {
    return null;
  }
  const apiUrl = normalizeChatCompletionsUrl(process.env.LLM_API_URL || DEFAULT_LLM_API_URL);
  const model = process.env.LLM_MODEL || DEFAULT_LLM_MODEL;
  const template = NARRATIVE_TEMPLATES[context.room.narrationTemplate] || NARRATIVE_TEMPLATES.coc7;
  const prompt = [
    template.aiStyle,
    "请用中文写一段简洁但有画面感的场景反馈，不要写规则解释，不要越界代替玩家做长期决定。",
    `模组：${context.room.module.title}`,
    `场景：${context.scene.title} - ${context.scene.description}`,
    `调查员：${context.investigator.name}，职业：${OCCUPATIONS[context.investigator.occupationId]?.label || "调查员"}`,
    `行动：${context.choice.label}`,
    `检定技能：${CORE_SKILLS[context.choice.skill]?.label || context.choice.skill} ${context.effectiveSkill}`,
    `结果：${SUCCESS_NAMES[context.outcome.level]}，掷骰 ${context.roll.value}`,
    `理智变动：-${context.sanLoss}`,
    `叙事模板：${template.label}`,
    '返回 JSON：{"title":"","body":"","logText":""}'
  ].join("\n");

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.85
      })
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : null;
  } catch {
    return null;
  }
}

function getLlmApiKey() {
  return process.env.LLM_API_KEY || process.env.ZHIPU_API_KEY || "";
}

function normalizeChatCompletionsUrl(rawUrl) {
  const value = String(rawUrl || "").trim().replace(/\/+$/, "");
  if (!value) return DEFAULT_LLM_API_URL;
  if (value.endsWith("/chat/completions")) return value;
  if (value.endsWith("/v1")) return `${value}/chat/completions`;
  return `${value}/v1/chat/completions`;
}

function buildSceneArt(room) {
  const scene = getCurrentScene(room);
  const title = escapeXml(scene.title);
  const summary = escapeXml(scene.description.slice(0, 88));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1b1a22"/>
          <stop offset="50%" stop-color="#3b3d45"/>
          <stop offset="100%" stop-color="#0f1016"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#bg)"/>
      <circle cx="970" cy="120" r="110" fill="rgba(230,240,255,0.1)"/>
      <path d="M0 580 C120 500, 240 540, 360 500 S650 610, 840 550 S1080 500, 1200 540 L1200 720 L0 720 Z" fill="rgba(18,20,26,0.88)"/>
      <rect x="92" y="88" width="1016" height="544" rx="26" fill="rgba(224,216,188,0.07)" stroke="rgba(224,216,188,0.18)" stroke-width="2"/>
      <text x="126" y="180" fill="#efe7d1" font-size="58" font-family="Georgia, serif">${title}</text>
      <text x="126" y="248" fill="#d9d0bc" font-size="28" font-family="Georgia, serif">${summary}</text>
      <text x="126" y="610" fill="#bcae8b" font-size="24" font-family="Georgia, serif">Keeper Illustration · ${escapeXml(room.module.title)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function pushLog(room, text) {
  room.logs.unshift({
    id: crypto.randomUUID(),
    text,
    at: new Date().toISOString()
  });
  room.logs = room.logs.slice(0, 40);
}

function rollRange([min, max]) {
  return randomInt(min, max);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
