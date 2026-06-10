import { getLlmConfig, minimaxUrlCandidates } from "../config.mjs";

const HISTORY_LIMIT = 6;

/**
 * context: { room, scene, choice, actingCharacter, success, roll, total, dc,
 *            party: [{ name, hp, maxHp, status }], eventNotes: string[] }
 */
export async function narrateTurn(context) {
  const aiNarration = await tryAiNarration(context);
  if (aiNarration) {
    return aiNarration;
  }

  const { scene, choice, actingCharacter, success, eventNotes = [] } = context;
  const baseText = success
    ? choice.successText ?? "队伍把握住了时机，局势朝有利方向推进。"
    : choice.failureText ?? "行动未能如愿，局势变得更紧张了。";
  const nextPrompt = success
    ? "新的通路在你们面前展开。"
    : "危险仍在逼近，队伍需要重新评估策略。";
  const eventText = eventNotes.length ? eventNotes.join("") : "";

  return {
    title: `${scene.title} · ${success ? "突破" : "受阻"}`,
    body: `${actingCharacter.name}选择了“${choice.label}”。${baseText}${eventText}${nextPrompt}`,
    logText: `${scene.title}: ${actingCharacter.name}${success ? "成功完成" : "未能完成"}「${choice.label}」。`
  };
}

export function buildNarrationMessages(context) {
  const { room, scene, choice, actingCharacter, success, total, dc, party = [], eventNotes = [] } = context;

  const history = (room.story ?? [])
    .slice(-HISTORY_LIMIT)
    .map((entry, index) => {
      const label = entry.choiceLabel ?? entry.choiceId;
      const summary = entry.narration?.logText || "";
      return `${index + 1}. ${entry.actor}「${label}」→ ${entry.success ? "成功" : "失败"}${summary ? `：${summary}` : ""}`;
    });

  const partyStatus = party
    .map((member) => `${member.name} HP ${member.hp}/${member.maxHp}${member.status === "down" ? "（倒地）" : ""}`)
    .join("；");

  const userLines = [
    `剧本: ${room.module.title}（基调: ${room.module.tone ?? "fantasy"}）`,
    history.length ? `剧情回顾（最近 ${history.length} 条）:\n${history.join("\n")}` : "剧情回顾: 冒险刚刚开始。",
    partyStatus ? `队伍状态: ${partyStatus}；危机值 ${room.pressure ?? 0}/3` : `危机值 ${room.pressure ?? 0}/3`,
    `当前场景: ${scene.title} - ${scene.description}`,
    `本回合: ${actingCharacter.name} 执行「${choice.label}」，d20 总值 ${total} vs DC ${dc} → ${success ? "成功" : "失败"}`
  ];

  if (eventNotes.length) {
    userLines.push(`必须在叙事中体现以下事件: ${eventNotes.join("")}`);
  }

  return [
    {
      role: "system",
      content:
        "你是一个中世纪奇幻 TRPG 旁白。叙事必须与“剧情回顾”保持连贯，body 不超过 120 字。" +
        '请只返回一个 JSON 对象，格式为 {"title":"","body":"","logText":""}。不要输出额外解释。'
    },
    {
      role: "user",
      content: userLines.join("\n")
    }
  ];
}

export async function tryAiNarration(context) {
  const llmConfig = getLlmConfig();
  if (!llmConfig) {
    return null;
  }

  const messages = buildNarrationMessages(context);
  const requestBodies = [
    {
      model: llmConfig.model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.8
    },
    {
      model: llmConfig.model,
      messages,
      temperature: 0.8
    }
  ];

  const apiUrls =
    llmConfig.provider === "minimax" ? minimaxUrlCandidates(llmConfig.apiUrl) : [llmConfig.apiUrl];

  for (const apiUrl of apiUrls) {
    for (const body of requestBodies) {
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${llmConfig.apiKey}`
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
          continue;
        }

        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        const parsed = parseNarrationContent(content);
        if (parsed) {
          return parsed;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

export function parseNarrationContent(content) {
  if (!content || typeof content !== "string") {
    return null;
  }

  const cleaned = stripThinkTags(content).trim();
  if (!cleaned) {
    return null;
  }

  try {
    return JSON.parse(cleaned);
  } catch {}

  const jsonLike = cleaned.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonLike) {
    return null;
  }

  try {
    return JSON.parse(jsonLike);
  } catch {
    return null;
  }
}

export function stripThinkTags(content) {
  return String(content).replace(/<think>[\s\S]*?<\/think>/gi, "");
}
