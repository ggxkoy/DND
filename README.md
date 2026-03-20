# COC7 Web TRPG

一个可部署到 Railway 的《克苏鲁的呼唤》第七版网页跑团 MVP，包含：

- 调查员创建：职业、八维属性、兴趣技能、背景
- COC7 检定：D100、常规/困难/极难成功、奖励骰/惩罚骰
- 理智系统：SAN、Luck、HP、MP、伤害加值与体格
- 案件房间：官方调查模组与自定义 JSON 模组
- 守秘人叙事：可接入 LLM 生成 COC 风格场景反馈，也可在无密钥时使用本地叙事引擎

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

## MiniMax 接入

现在后端也直接支持 MiniMax 的 OpenAI 兼容接口，有两种配置方式。

### 方式 1：显式使用 MiniMax 专用变量

```text
MINIMAX_API_KEY=你的 MiniMax API Key
MINIMAX_BASE_URL=https://api.minimax.io/v1
MINIMAX_MODEL=MiniMax-M2.5
```

### 方式 2：沿用通用 LLM 变量

```text
LLM_PROVIDER=minimax
LLM_API_KEY=你的 MiniMax API Key
LLM_BASE_URL=https://api.minimax.io/v1
LLM_MODEL=MiniMax-M2.5
```

兼容说明：

- `LLM_PROVIDER=minimax` 时，后端会优先按 MiniMax 处理
- `LLM_BASE_URL` 现在也会被识别，不再只接受 `LLM_API_URL`
- 若 MiniMax 返回带 `<think>...</think>` 的内容，后端会先剥离思考片段，再解析叙事 JSON
- 若 `response_format=json_object` 不被目标端接受，后端会自动退回普通文本请求并继续尝试解析 JSON

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
