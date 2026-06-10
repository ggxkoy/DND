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

export async function generateSceneImage(prompt) {
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
          aspect_ratio: "16:9",
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

      const image = await generateSceneImage(buildScenePrompt(room.module, scene));
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
