import test from "node:test";
import assert from "node:assert/strict";
import { parseNarrationContent, stripThinkTags, buildNarrationMessages } from "../src/llm/narrator.mjs";

test("parseNarrationContent 纯 JSON", () => {
  const parsed = parseNarrationContent('{"title":"t","body":"b","logText":"l"}');
  assert.deepEqual(parsed, { title: "t", body: "b", logText: "l" });
});

test("parseNarrationContent 带代码围栏与杂文本", () => {
  const parsed = parseNarrationContent('好的，以下是结果：\n```json\n{"title":"t","body":"b","logText":"l"}\n```');
  assert.equal(parsed.title, "t");
});

test("parseNarrationContent 剥离 <think> 标签", () => {
  const parsed = parseNarrationContent('<think>让我想想…</think>{"title":"t","body":"b","logText":"l"}');
  assert.equal(parsed.title, "t");
  assert.equal(stripThinkTags("<think>x</think>y"), "y");
});

test("parseNarrationContent 垃圾输入返回 null", () => {
  assert.equal(parseNarrationContent("完全不是 JSON"), null);
  assert.equal(parseNarrationContent(""), null);
  assert.equal(parseNarrationContent(null), null);
  assert.equal(parseNarrationContent("<think>only thoughts</think>"), null);
});

function makeContext(overrides = {}) {
  return {
    room: {
      module: { title: "余烬地窟", tone: "heroic fantasy" },
      pressure: 2,
      story: Array.from({ length: 10 }, (_, i) => ({
        actor: `角色${i}`,
        choiceId: `c${i}`,
        choiceLabel: `行动${i}`,
        success: i % 2 === 0,
        narration: { logText: `第 ${i} 回合记录` }
      }))
    },
    scene: { title: "灰烬祭坛", description: "祭坛中央漂浮着晶核。" },
    choice: { label: "安抚守墓灵" },
    actingCharacter: { name: "测试者" },
    success: true,
    roll: 15,
    total: 17,
    dc: 13,
    party: [
      { name: "测试者", hp: 7, maxHp: 14, status: "active" },
      { name: "队友", hp: 0, maxHp: 10, status: "down" }
    ],
    eventNotes: [],
    ...overrides
  };
}

test("buildNarrationMessages 历史只取最近 6 条", () => {
  const [system, user] = buildNarrationMessages(makeContext());
  assert.equal(system.role, "system");
  assert.match(system.content, /JSON/);
  assert.match(user.content, /剧情回顾（最近 6 条）/);
  assert.ok(user.content.includes("行动9"));
  assert.ok(!user.content.includes("行动3")); // 第 4 条之前被截断
});

test("buildNarrationMessages 含队伍 HP 与危机值", () => {
  const [, user] = buildNarrationMessages(makeContext());
  assert.match(user.content, /测试者 HP 7\/14/);
  assert.match(user.content, /队友 HP 0\/10（倒地）/);
  assert.match(user.content, /危机值 2\/3/);
});

test("buildNarrationMessages 事件附加指令", () => {
  const [, user] = buildNarrationMessages(makeContext({ eventNotes: ["危机爆发！局势失控。"] }));
  assert.match(user.content, /必须在叙事中体现以下事件: 危机爆发/);
});

test("buildNarrationMessages 无历史时提示冒险开始", () => {
  const context = makeContext();
  context.room.story = [];
  const [, user] = buildNarrationMessages(context);
  assert.match(user.content, /冒险刚刚开始/);
});
