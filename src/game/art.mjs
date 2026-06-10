import { existsSync } from "node:fs";
import path from "node:path";
import { ART_DIR, getImageConfig } from "../config.mjs";
import { queueSceneArt, sceneArtFileName } from "../llm/artist.mjs";

function getCurrentScene(room) {
  return room.module.scenes[room.sceneIndex] ?? room.module.scenes.at(-1);
}

export function buildSceneArt(room) {
  const fileName = sceneArtFileName(room.id, room.sceneIndex ?? 0);
  if (existsSync(path.join(ART_DIR, fileName))) {
    return `/art/${fileName}`;
  }

  // 配了生图 key 但磁盘缺图(如重启丢失)时按需重新入队,期间先展示 SVG 占位
  if (getImageConfig()) {
    queueSceneArt(room);
  }
  return buildPlaceholderArt(room);
}

export function buildPlaceholderArt(room) {
  const scene = getCurrentScene(room);
  const palette = room.completed
    ? ["#d4b06a", "#f3e7bf", "#6d4b26"]
    : ["#4d2c1d", "#d19d55", "#1e1411"];
  const title = encodeXml(scene.title);
  const summary = encodeXml(scene.description.slice(0, 80));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}" />
          <stop offset="55%" stop-color="${palette[1]}" />
          <stop offset="100%" stop-color="${palette[2]}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="720" fill="url(#sky)" />
      <circle cx="945" cy="140" r="84" fill="rgba(255,248,220,0.35)" />
      <path d="M0 560 C180 470, 330 640, 540 560 S930 430, 1200 580 L1200 720 L0 720 Z" fill="rgba(35,19,14,0.65)" />
      <path d="M0 610 C200 540, 410 690, 650 610 S980 520, 1200 645 L1200 720 L0 720 Z" fill="rgba(15,8,6,0.82)" />
      <rect x="88" y="94" width="1024" height="532" rx="24" fill="rgba(245, 232, 204, 0.12)" stroke="rgba(245,232,204,0.28)" stroke-width="2" />
      <text x="120" y="180" fill="#fff7df" font-size="62" font-family="Georgia, serif">${title}</text>
      <text x="120" y="250" fill="#fef4d6" font-size="28" font-family="Georgia, serif">${summary}</text>
      <text x="120" y="608" fill="#fbe9b6" font-size="24" font-family="Georgia, serif">Scene Illustration · ${encodeXml(room.module.title)}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export function encodeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
