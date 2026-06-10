import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeChatCompletionsUrl,
  normalizeProvider,
  getLlmConfig,
  getImageConfig,
  DEFAULT_AGENTROUTER_API_URL,
  DEFAULT_MINIMAX_IMAGE_URL
} from "../src/config.mjs";

test("normalizeChatCompletionsUrl 各种输入", () => {
  assert.equal(
    normalizeChatCompletionsUrl("https://api.minimax.io/v1/chat/completions"),
    "https://api.minimax.io/v1/chat/completions"
  );
  assert.equal(
    normalizeChatCompletionsUrl("https://api.minimax.io/v1"),
    "https://api.minimax.io/v1/chat/completions"
  );
  assert.equal(
    normalizeChatCompletionsUrl("https://agentrouter.org"),
    "https://agentrouter.org/v1/chat/completions"
  );
  assert.equal(
    normalizeChatCompletionsUrl("https://example.com/"),
    "https://example.com/v1/chat/completions"
  );
  assert.equal(normalizeChatCompletionsUrl(""), DEFAULT_AGENTROUTER_API_URL);
});

test("normalizeProvider 大小写与空白", () => {
  assert.equal(normalizeProvider(" MiniMax "), "minimax");
  assert.equal(normalizeProvider(undefined), "");
});

test("getLlmConfig 无任何 key 返回 null", () => {
  assert.equal(getLlmConfig({}), null);
});

test("getLlmConfig 通用 LLM_API_KEY 走 AgentRouter 默认", () => {
  const config = getLlmConfig({ LLM_API_KEY: "k" });
  assert.equal(config.provider, "generic");
  assert.equal(config.apiUrl, DEFAULT_AGENTROUTER_API_URL);
  assert.equal(config.model, "glm-4.6");
});

test("getLlmConfig LLM_PROVIDER=minimax 优先 MiniMax", () => {
  const config = getLlmConfig({ LLM_PROVIDER: "minimax", LLM_API_KEY: "k" });
  assert.equal(config.provider, "minimax");
  assert.match(config.apiUrl, /minimax/);
  assert.equal(config.model, "MiniMax-M2.5");
});

test("getLlmConfig 仅 MINIMAX_API_KEY 也走 MiniMax", () => {
  const config = getLlmConfig({ MINIMAX_API_KEY: "mk" });
  assert.equal(config.provider, "minimax");
  assert.equal(config.apiKey, "mk");
});

test("getImageConfig 有/无 MINIMAX_API_KEY", () => {
  assert.equal(getImageConfig({}), null);
  const config = getImageConfig({ MINIMAX_API_KEY: "mk" });
  assert.equal(config.apiKey, "mk");
  assert.equal(config.apiUrl, DEFAULT_MINIMAX_IMAGE_URL);
  assert.equal(config.model, "image-01");
  const custom = getImageConfig({ MINIMAX_API_KEY: "mk", MINIMAX_IMAGE_MODEL: "image-02" });
  assert.equal(custom.model, "image-02");
});
