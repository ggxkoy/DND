import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ART_DIR, getImageConfig, minimaxUrlCandidates } from "../config.mjs";
import { broadcastRoom } from "../events.mjs";

const RETRY_COOLDOWN_MS = 60000;
const inFlight = new Set();
const lastAttemptAt = new Map();

export function sceneArtFileName(roomId, sceneIndex) {
  // image-01 返回 JPEG
  return `${roomId}-${sceneIndex}.jpg`;
}

export function portraitFileName(characterId) {
  return `portrait-${characterId}.jpg`;
}

export function buildPortraitPrompt(character, race, job) {
  return [
    "Fantasy tabletop RPG character portrait.",
    `Character: ${character.name}, ${race?.portrait || race?.label || "adventurer"}, ${job?.portrait || job?.label || "hero"}.`,
    `Background notes: ${character.backstory || "mysterious adventurer"}.`,
    "Bust portrait, dramatic rim light, detailed costume, painterly realism, clean background.",
    "No text, no UI, no watermark."
  ].join(" ");
}

/**
 * 建卡时同步生成立绘并落盘(一次性成本,玩家创建后立即看到);
 * 失败时静默跳过,角色照常创建。
 */
export async function ensureCharacterPortrait(character, race, job) {
  if (character.portraitArt?.url || !getImageConfig()) {
    return false;
  }

  const prompt = buildPortraitPrompt(character, race, job);
  const image = await generateImage(prompt, "3:4");
  if (!image) {
    return false;
  }

  try {
    await mkdir(ART_DIR, { recursive: true });
    await writeFile(path.join(ART_DIR, portraitFileName(character.id)), image);
  } catch (error) {
    console.warn("Portrait save failed:", error.message);
    return false;
  }

  character.portraitArt = {
    url: `/art/${portraitFileName(character.id)}`,
    prompt,
    generatedAt: new Date().toISOString()
  };
  return true;
}

export function buildScenePrompt(moduleDefinition, scene) {
  const description = String(scene.description ?? "").slice(0, 120);
  const tone = moduleDefinition.tone || "dark fantasy";
  return `${scene.title}：${description} ${tone}, dark fantasy concept art, atmospheric, cinematic lighting, detailed environment, no text`;
}

export function parseImageResponse(payload) {
  const base64 = payload?.data?.image_base64;
  if (Array.isArray(base64)) {
    return typeof base64[0] === "string" && base64[0] ? base64[0] : null;
  }
  if (typeof base64 === "string" && base64) {
    return base64;
  }
  return null;
}

export async function generateImage(prompt, aspectRatio = "16:9") {
  const config = getImageConfig();
  if (!config) {
    return null;
  }

  for (const apiUrl of minimaxUrlCandidates(config.apiUrl)) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          prompt,
          aspect_ratio: aspectRatio,
          response_format: "base64",
          n: 1
        }),
        signal: AbortSignal.timeout(60000)
      });

      if (!response.ok) {
        continue;
      }

      // MiniMax 鉴权失败也可能返回 HTTP 200 + base_resp 错误,靠解析结果判断
      const payload = await response.json();
      const base64 = parseImageResponse(payload);
      if (base64) {
        return Buffer.from(base64, "base64");
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * 异步生成当前场景图,不阻塞调用方;按 roomId:sceneIndex 去重,
 * 失败后 60 秒内不重试。成功落盘后通过 SSE 通知房间订阅者换图。
 */
export function queueSceneArt(room) {
  if (!getImageConfig()) {
    return;
  }

  const sceneIndex = room.sceneIndex ?? 0;
  const scene = room.module.scenes[sceneIndex] ?? room.module.scenes.at(-1);
  if (!scene) {
    return;
  }

  const key = `${room.id}:${sceneIndex}`;
  if (inFlight.has(key)) {
    return;
  }
  const lastAttempt = lastAttemptAt.get(key) ?? 0;
  if (Date.now() - lastAttempt < RETRY_COOLDOWN_MS) {
    return;
  }

  inFlight.add(key);
  lastAttemptAt.set(key, Date.now());

  (async () => {
    try {
      const filePath = path.join(ART_DIR, sceneArtFileName(room.id, sceneIndex));
      if (existsSync(filePath)) {
        return;
      }

      const image = await generateImage(buildScenePrompt(room.module, scene), "16:9");
      if (!image) {
        return;
      }

      await mkdir(ART_DIR, { recursive: true });
      await writeFile(filePath, image);
      broadcastRoom(room.id, { type: "art", lastUpdatedAt: new Date().toISOString() });
    } catch (error) {
      console.warn("Scene art generation failed:", error.message);
    } finally {
      inFlight.delete(key);
    }
  })();
}
