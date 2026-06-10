import test from "node:test";
import assert from "node:assert/strict";
import { buildScenePrompt, parseImageResponse, sceneArtFileName } from "../src/llm/artist.mjs";

test("buildScenePrompt 含场景、基调与风格后缀", () => {
  const prompt = buildScenePrompt(
    { tone: "mystic exploration" },
    { title: "迷雾岔路", description: "银白迷雾吞没山道。" }
  );
  assert.match(prompt, /迷雾岔路/);
  assert.match(prompt, /mystic exploration/);
  assert.match(prompt, /no text/);
});

test("buildScenePrompt 截断超长描述并兜底基调", () => {
  const longDescription = "雾".repeat(300);
  const prompt = buildScenePrompt({}, { title: "t", description: longDescription });
  assert.ok(!prompt.includes("雾".repeat(121)));
  assert.match(prompt, /dark fantasy/);
});

test("parseImageResponse 字符串/数组/缺失", () => {
  assert.equal(parseImageResponse({ data: { image_base64: "abc" } }), "abc");
  assert.equal(parseImageResponse({ data: { image_base64: ["xyz"] } }), "xyz");
  assert.equal(parseImageResponse({ data: {} }), null);
  assert.equal(parseImageResponse(null), null);
  assert.equal(parseImageResponse({ data: { image_base64: [] } }), null);
});

test("sceneArtFileName 命名规则", () => {
  assert.equal(sceneArtFileName("room1", 2), "room1-2.png");
});
