import test from "node:test";
import assert from "node:assert/strict";
import {
  getModifier,
  computeMaxHp,
  inferSkillFromText,
  inferFreeActionDc,
  computeFailureDamage,
  applyActionOutcome,
  validateModule,
  buildFreeChoice,
  buildRescueChoice
} from "../src/game/rules.mjs";

test("getModifier 边界", () => {
  assert.equal(getModifier(8), -1);
  assert.equal(getModifier(10), 0);
  assert.equal(getModifier(11), 0);
  assert.equal(getModifier(12), 1);
});

test("computeMaxHp 含力量修正与战士加成", () => {
  assert.equal(computeMaxHp({ stats: { strength: 10 }, classId: "mage" }), 10);
  assert.equal(computeMaxHp({ stats: { strength: 12 }, classId: "fighter" }), 14);
  assert.equal(computeMaxHp({ stats: { strength: 4 }, classId: "mage" }), 6); // 下限
  assert.equal(computeMaxHp({}), 10); // 缺字段兜底
});

test("inferSkillFromText 关键词分支", () => {
  assert.equal(inferSkillFromText("尝试潜行绕后", {}), "stealth");
  assert.equal(inferSkillFromText("和守卫谈判", {}), "persuasion");
  assert.equal(inferSkillFromText("调查桌上的文件", {}), "investigation");
  assert.equal(inferSkillFromText("砍断绳索", {}), "athletics");
  assert.equal(inferSkillFromText("静静等待", {}), "insight");
  // 修正正则后,单独的"行"字不再误判为 stealth
  assert.equal(inferSkillFromText("行礼致意", {}), "insight");
});

test("inferFreeActionDc 各因子", () => {
  assert.equal(inferFreeActionDc({ moduleDifficulty: 12, freeText: "等待" }), 12);
  assert.equal(inferFreeActionDc({ moduleDifficulty: 12, freeText: "强攻正门" }), 14);
  assert.equal(inferFreeActionDc({ moduleDifficulty: 12, freeText: "小心观察" }), 11);
  assert.equal(inferFreeActionDc({ moduleDifficulty: 12, freeText: "侦查".repeat(21) }), 13); // 长文本 +1
  assert.equal(inferFreeActionDc({ moduleDifficulty: 12, freeText: "等待", pressure: 2 }), 13);
  assert.equal(inferFreeActionDc({ moduleDifficulty: 30, freeText: "强攻" }), 18); // 上限
  assert.equal(inferFreeActionDc({ moduleDifficulty: 5, freeText: "小心" }), 8); // 下限
  assert.equal(inferFreeActionDc({ moduleDifficulty: undefined, freeText: "" }), 12); // 默认难度
});

test("buildFreeChoice 空文本返回 null,正常生成动态 DC", () => {
  assert.equal(buildFreeChoice({}, "  "), null);
  const choice = buildFreeChoice({ description: "" }, "小心观察四周", { moduleDifficulty: 13, pressure: 0 });
  assert.equal(choice.kind, "free");
  assert.equal(choice.skill, "investigation");
  assert.equal(choice.dc, 12);
});

test("computeFailureDamage 普通/大差距/大失败", () => {
  assert.equal(computeFailureDamage({ roll: 10, total: 11, dc: 13 }), 1);
  assert.equal(computeFailureDamage({ roll: 10, total: 5, dc: 13 }), 2);
  assert.equal(computeFailureDamage({ roll: 1, total: 2, dc: 13 }), 3);
});

test("validateModule 校验", () => {
  assert.doesNotThrow(() => validateModule({ title: "t", scenes: [{}] }));
  assert.throws(() => validateModule({ scenes: [{}] }));
  assert.throws(() => validateModule({ title: "t", scenes: [] }));
  assert.throws(() => validateModule(null));
});

function makeRoom({ sceneCount = 2, sceneIndex = 0, pressure = 0, players }) {
  return {
    module: { scenes: Array.from({ length: sceneCount }, (_, i) => ({ id: `s${i}` })) },
    sceneIndex,
    pressure,
    completed: false,
    ending: null,
    players
  };
}

const maxHpOf = () => 10;
const nameOf = (p) => p.characterId;

test("applyActionOutcome 成功降压并推进场景", () => {
  const actor = { characterId: "a", hp: 10, status: "active" };
  const room = makeRoom({ pressure: 2, players: [actor] });
  const events = applyActionOutcome({ room, actingPlayer: actor, success: true, roll: 15, total: 18, dc: 12, maxHpOf, nameOf });
  assert.equal(room.pressure, 1);
  assert.equal(room.sceneIndex, 1);
  assert.ok(events.some((e) => e.type === "advance"));
});

test("applyActionOutcome 最后一幕成功 → victory", () => {
  const actor = { characterId: "a", hp: 10, status: "active" };
  const room = makeRoom({ sceneIndex: 1, players: [actor] });
  applyActionOutcome({ room, actingPlayer: actor, success: true, roll: 15, total: 18, dc: 12, maxHpOf, nameOf });
  assert.equal(room.completed, true);
  assert.equal(room.ending, "victory");
});

test("applyActionOutcome 失败升压掉血,大失败双倍压力", () => {
  const actor = { characterId: "a", hp: 10, status: "active" };
  const room = makeRoom({ players: [actor] });
  applyActionOutcome({ room, actingPlayer: actor, success: false, roll: 10, total: 10, dc: 12, maxHpOf, nameOf });
  assert.equal(room.pressure, 1);
  assert.equal(actor.hp, 9);
  assert.equal(room.sceneIndex, 0); // 失败不推进

  applyActionOutcome({ room, actingPlayer: actor, success: false, roll: 1, total: 1, dc: 12, maxHpOf, nameOf });
  assert.equal(room.pressure, 0); // 1 + 2 = 3 → 爆发归零
});

test("applyActionOutcome 危机爆发: 全队掉血 + 强制推进", () => {
  const a = { characterId: "a", hp: 10, status: "active" };
  const b = { characterId: "b", hp: 10, status: "active" };
  const room = makeRoom({ pressure: 2, players: [a, b] });
  const events = applyActionOutcome({ room, actingPlayer: a, success: false, roll: 10, total: 8, dc: 12, maxHpOf, nameOf });
  assert.ok(events.some((e) => e.type === "crisis"));
  assert.ok(events.some((e) => e.type === "forcedAdvance"));
  assert.equal(room.pressure, 0);
  assert.equal(room.sceneIndex, 1);
  assert.equal(a.hp, 8); // 失败 1 点 + 危机 1 点
  assert.equal(b.hp, 9); // 危机 1 点
});

test("applyActionOutcome 最后一幕危机爆发 → retreat", () => {
  const a = { characterId: "a", hp: 10, status: "active" };
  const room = makeRoom({ sceneIndex: 1, pressure: 2, players: [a] });
  applyActionOutcome({ room, actingPlayer: a, success: false, roll: 10, total: 8, dc: 12, maxHpOf, nameOf });
  assert.equal(room.completed, true);
  assert.equal(room.ending, "retreat");
});

test("applyActionOutcome HP 归零倒地,全员倒地 → wipe", () => {
  const a = { characterId: "a", hp: 1, status: "active" };
  const room = makeRoom({ players: [a] });
  const events = applyActionOutcome({ room, actingPlayer: a, success: false, roll: 10, total: 8, dc: 12, maxHpOf, nameOf });
  assert.equal(a.status, "down");
  assert.ok(events.some((e) => e.type === "down"));
  assert.equal(room.completed, true);
  assert.equal(room.ending, "wipe");
});

test("applyActionOutcome 救助成功恢复半血并回归 active,不推进场景", () => {
  const a = { characterId: "a", hp: 10, status: "active" };
  const b = { characterId: "b", hp: 0, status: "down" };
  const room = makeRoom({ pressure: 1, players: [a, b] });
  const events = applyActionOutcome({
    room, actingPlayer: a, rescueTargetPlayer: b, success: true, roll: 15, total: 18, dc: 10, maxHpOf, nameOf
  });
  assert.equal(b.status, "active");
  assert.equal(b.hp, 5);
  assert.equal(room.sceneIndex, 0); // 救助不推进场景
  assert.equal(room.pressure, 0); // 成功仍降压
  assert.ok(events.some((e) => e.type === "rescued"));
});

test("buildRescueChoice 结构", () => {
  const choice = buildRescueChoice({ id: "c1", name: "艾琳" });
  assert.equal(choice.id, "rescue-c1");
  assert.equal(choice.skill, "medicine");
  assert.equal(choice.dc, 10);
  assert.equal(choice.kind, "rescue");
});
