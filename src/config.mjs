import path from "node:path";

export const PORT = Number(process.env.PORT || 3000);
export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, ".local");
export const DATA_FILE = path.join(DATA_DIR, "app-state.json");
export const PUBLIC_DIR = path.join(ROOT_DIR, "public");
export const ART_DIR = path.join(DATA_DIR, "art");

export const DEFAULT_AGENTROUTER_API_URL = "https://agentrouter.org/v1/chat/completions";
export const DEFAULT_AGENTROUTER_MODEL = "glm-4.6";
export const DEFAULT_MINIMAX_API_URL = "https://api.minimax.io/v1/chat/completions";
export const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5";
export const DEFAULT_MINIMAX_IMAGE_URL = "https://api.minimax.io/v1/image_generation";
export const DEFAULT_MINIMAX_IMAGE_MODEL = "image-01";

export function getLlmConfig(env = process.env) {
  const provider = normalizeProvider(env.LLM_PROVIDER);
  const llmApiKey = env.LLM_API_KEY?.trim() || "";
  const minimaxApiKey = env.MINIMAX_API_KEY?.trim() || "";
  const zhipuApiKey = env.ZHIPU_API_KEY?.trim() || "";

  if (provider === "minimax" && (llmApiKey || minimaxApiKey)) {
    return {
      provider: "minimax",
      apiKey: minimaxApiKey || llmApiKey,
      apiUrl: normalizeChatCompletionsUrl(
        env.MINIMAX_BASE_URL || env.LLM_BASE_URL || env.LLM_API_URL || DEFAULT_MINIMAX_API_URL
      ),
      model: env.MINIMAX_MODEL?.trim() || env.LLM_MODEL?.trim() || DEFAULT_MINIMAX_MODEL
    };
  }

  if (llmApiKey || zhipuApiKey) {
    return {
      provider: provider || "generic",
      apiKey: llmApiKey || zhipuApiKey,
      apiUrl: normalizeChatCompletionsUrl(
        env.LLM_API_URL || env.LLM_BASE_URL || DEFAULT_AGENTROUTER_API_URL
      ),
      model: env.LLM_MODEL?.trim() || DEFAULT_AGENTROUTER_MODEL
    };
  }

  if (minimaxApiKey) {
    return {
      provider: "minimax",
      apiKey: minimaxApiKey,
      apiUrl: normalizeChatCompletionsUrl(
        env.MINIMAX_BASE_URL || env.LLM_BASE_URL || DEFAULT_MINIMAX_API_URL
      ),
      model: env.MINIMAX_MODEL?.trim() || env.LLM_MODEL?.trim() || DEFAULT_MINIMAX_MODEL
    };
  }

  return null;
}

export function getImageConfig(env = process.env) {
  const apiKey = env.MINIMAX_API_KEY?.trim() || "";
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    apiUrl: env.MINIMAX_IMAGE_URL?.trim() || DEFAULT_MINIMAX_IMAGE_URL,
    model: env.MINIMAX_IMAGE_MODEL?.trim() || DEFAULT_MINIMAX_IMAGE_MODEL
  };
}

export function normalizeProvider(rawValue) {
  return String(rawValue || "")
    .trim()
    .toLowerCase();
}

export function normalizeChatCompletionsUrl(rawUrl) {
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
