import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DATA_DIR, DATA_FILE } from "./config.mjs";
import { computeMaxHp } from "./game/rules.mjs";

let db = null;

export async function initStore() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    const content = await readFile(DATA_FILE, "utf8");
    db = JSON.parse(content);
  } catch {
    db = emptyState();
  }

  migrateState(db);
  await persist();
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Store not initialized. Call initStore() first.");
  }
  return db;
}

export async function persist() {
  await writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

export function emptyState() {
  return {
    users: {},
    sessions: {},
    characters: {},
    rooms: {}
  };
}

/**
 * 为旧存档补齐新增字段(character.maxHp、room.pressure/ending、player.hp/status),幂等。
 */
export function migrateState(state) {
  state.users ??= {};
  state.sessions ??= {};
  state.characters ??= {};
  state.rooms ??= {};

  for (const character of Object.values(state.characters)) {
    character.maxHp ??= computeMaxHp(character);
  }

  for (const room of Object.values(state.rooms)) {
    room.pressure ??= 0;
    room.ending ??= null;
    for (const player of room.players ?? []) {
      const character = state.characters[player.characterId];
      player.hp ??= character?.maxHp ?? 10;
      player.status ??= "active";
    }
  }

  return state;
}
