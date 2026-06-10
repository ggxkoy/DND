import test from "node:test";
import assert from "node:assert/strict";
import { migrateState } from "../src/store.mjs";

function legacyState() {
  return {
    users: { u1: { id: "u1", name: "老用户", characterIds: ["c1"] } },
    sessions: {},
    characters: {
      c1: {
        id: "c1",
        userId: "u1",
        name: "旧角色",
        raceId: "dwarf",
        classId: "fighter",
        stats: { strength: 12, agility: 10, intellect: 10, spirit: 12, charm: 9 }
      }
    },
    rooms: {
      r1: {
        id: "r1",
        ownerId: "u1",
        module: { title: "旧剧本", scenes: [{ id: "s1" }] },
        players: [{ userId: "u1", characterId: "c1", joinedAt: "2026-01-01T00:00:00.000Z" }],
        sceneIndex: 0,
        turn: 3,
        story: [],
        logs: [],
        completed: false
      }
    }
  };
}

test("migrateState 补齐旧档缺失字段", () => {
  const state = migrateState(legacyState());
  assert.equal(state.characters.c1.maxHp, 14); // 力量 12 → +2,战士 +2
  assert.equal(state.rooms.r1.pressure, 0);
  assert.equal(state.rooms.r1.ending, null);
  assert.equal(state.rooms.r1.players[0].hp, 14);
  assert.equal(state.rooms.r1.players[0].status, "active");
});

test("migrateState 幂等且不覆盖已有值", () => {
  const state = migrateState(legacyState());
  state.rooms.r1.pressure = 2;
  state.rooms.r1.players[0].hp = 5;
  state.rooms.r1.players[0].status = "down";
  const again = migrateState(state);
  assert.equal(again.rooms.r1.pressure, 2);
  assert.equal(again.rooms.r1.players[0].hp, 5);
  assert.equal(again.rooms.r1.players[0].status, "down");
});

test("migrateState 容忍缺失顶层集合", () => {
  const state = migrateState({});
  assert.deepEqual(state.users, {});
  assert.deepEqual(state.rooms, {});
});
