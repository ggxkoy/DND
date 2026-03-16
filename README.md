# Dragons & Dungeons Web TRPG

一个可部署到 Railway 的 AI 跑团网页站点 MVP，包含：

- 角色创建：种族、职业、属性、技能、装备、头像联动
- 房间大厅：创建房间、加入房间、官方模组与自定义 JSON 剧本
- 冒险流程：动态叙事、行动选项、D20 掷骰判定、日志滚动
- 组队系统：AI 队友和玩家角色共同参与冒险
- AI 扩展位：可接入 LLM 生成剧情，也可在无密钥时使用本地叙事引擎

## 本地运行

```powershell
npm install
npm start
```

默认访问：

```text
http://localhost:3000
```

## Railway 部署

1. 将仓库推送到 GitHub。
2. 在 Railway 创建新项目并连接该仓库。
3. Railway 会自动执行：
   - `npm install`
   - `npm start`
4. 设置可选环境变量：

```text
PORT=3000
LLM_API_URL=https://agentrouter.org/v1/chat/completions
LLM_API_KEY=你的 AgentRouter API Key
LLM_MODEL=glm-4.6
```

如果未配置 LLM 相关变量，系统会使用内置叙事引擎，仍可完整游玩。

## AgentRouter + GLM 接入

当前后端默认按 AgentRouter 的 OpenAI 兼容接口调用 `glm-4.6`：

- 推荐直接配置 `LLM_API_URL=https://agentrouter.org/v1/chat/completions`
- 如果你填的是 `https://agentrouter.org` 或 `https://agentrouter.org/v1`，后端也会自动补全到正确的 `chat/completions` endpoint
- 默认模型是 `glm-4.6`
- 如需切换到其他兼容 OpenAI Chat Completions 的平台，再覆盖 `LLM_API_URL` 与 `LLM_MODEL`

## 自定义剧本格式

支持导入 JSON，示例：

```json
{
  "title": "灰堡地窖",
  "summary": "调查古堡地下室的异变。",
  "tone": "dark fantasy",
  "difficulty": 13,
  "scenes": [
    {
      "id": "gate",
      "title": "锈蚀铁门",
      "description": "布满藤蔓的铁门后传来低沉回响。",
      "choices": [
        {
          "id": "inspect",
          "label": "调查门锁",
          "kind": "skill",
          "skill": "investigation",
          "dc": 12,
          "successText": "你发现门锁机关仍能运作。",
          "failureText": "你误触暗针，队伍士气受挫。"
        }
      ]
    }
  ]
}
```

## 当前实现说明

- 账号系统为轻量本地账号，适合 MVP 演示
- 数据默认保存在 `.local/app-state.json`
- Railway 上若不挂载持久卷，重启后数据会重置
- 场景图为程序生成的 SVG 海报，占位于真实绘图接口之前
