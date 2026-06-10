# Dragons & Dungeons Web TRPG

一个可部署到 Railway 的 D20 网页跑团 MVP，包含：

- 角色创建：四种族（人类/矮人/精灵/提夫林）、四职业（战士/法师/牧师/盗贼）、五维属性、技能与装备
- D20 检定：d20 + 属性修正 + 同伴修正 vs DC，自由行动按文本与局势动态推断技能和 DC
- 生存压力：角色 HP、失败掉血、危机值累积爆发、倒地救助、胜利/败退/团灭三种结局
- 多人房间：邀请码加入、SSE 实时同步（行动、加入、换图即时推送，无需轮询）
- AI 守秘人：可接入 LLM 生成连贯叙事（带剧情历史上下文），无密钥时使用本地叙事引擎
- 场景生图：配置 MiniMax API Key 后自动为每个场景生成 16:9 插画，未配置时使用程序生成的 SVG 海报

## 本地运行

```powershell
npm install
npm start
```

默认访问：

```text
http://localhost:3000
```

运行测试：

```powershell
npm test
```

## 游戏规则（D20）

- 每次行动掷 d20，加上对应属性修正（`(属性-10)/2` 向下取整）与同伴技能修正，达到 DC 即成功
- 成功推进场景并降低危机值；失败提升危机值并使行动者损失 1~3 点 HP（大失败 d20=1 额外惩罚）
- 危机值达到 3 触发危机爆发：全队掉血、被迫推进场景；最后一幕爆发则以"败退"结局收场
- HP 归零的角色倒地，无法行动，队友可执行动态出现的"救助"选项（医学检定 DC 10）将其救起
- 全员倒地判定团灭；最后一幕检定成功则达成胜利结局
- 自由行动的 DC 由剧本难度、行动风险用词、文本复杂度与当前危机值动态推算（范围 8~18）

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

## 免费部署（Render）

Railway 已无长期免费层，想免费托管推荐 [Render](https://render.com) 的 Free Web Service，仓库里已带好 `render.yaml`：

1. 将仓库推送到 GitHub。
2. 登录 Render → New → **Blueprint**，选择该仓库，Render 会读取 `render.yaml` 自动创建服务。
3. 部署时在控制台填入 `MINIMAX_API_KEY`（或其他 LLM 变量），不要把 key 写进仓库。
4. 部署完成后访问分配的 `https://xxx.onrender.com` 域名即可。

免费层注意事项：

- 15 分钟无访问后服务会休眠，下次打开有约 30~60 秒冷启动
- 免费实例没有持久磁盘，**重启/重新部署后 `.local/` 中的存档与场景图会重置**（与未挂卷的 Railway 行为一致）
- SSE 长连接在休眠唤醒后由浏览器 EventSource 自动重连，无需处理

### 其他免费平台（Docker）

仓库里也提供了通用 `Dockerfile`，可直接部署到任何支持容器的免费平台：

- **Koyeb**：免费额度含 1 个服务，连接 GitHub 选 Docker 构建即可
- **Hugging Face Spaces**：新建 Docker 类型 Space 并推送本仓库（Space 必须公开），在 Settings → Variables 配置 key
- **Google Cloud Run**：每月免费额度充足但需绑卡，`gcloud run deploy --source .` 一条命令完成

应用通过 `process.env.PORT` 读取端口，自动适配各平台的端口注入。

## 自托管 + Cloudflare Tunnel（数据可持久的免费方案）

如果你有一台能常开的电脑（家用机/NAS/闲置主机），用 [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 把本机服务暴露到公网是唯一**数据真正持久**的免费方案——存档和场景图都留在本机 `.local/` 目录，没有休眠和冷启动。

### 临时隧道（最快，无需注册）

```powershell
npm start          # 终端 1：启动游戏服务
npm run tunnel     # 终端 2：需先安装 cloudflared
```

`npm run tunnel` 等价于 `cloudflared tunnel --url http://localhost:3000`，会输出一个随机的 `https://xxx.trycloudflare.com` 地址，发给玩家即可联机。注意：**每次重开隧道地址都会变**，适合单次跑团。

### 固定域名隧道（长期使用）

需要一个免费 Cloudflare 账号和一个托管在 Cloudflare 的域名：

```bash
cloudflared tunnel login
cloudflared tunnel create dnd
cloudflared tunnel route dns dnd trpg.你的域名.com
cloudflared tunnel run --url http://localhost:3000 dnd
```

之后可把 `cloudflared` 注册为系统服务（`cloudflared service install`）随开机自启。

### 适配说明

- SSE 实时推送可正常穿透 Cloudflare：Cloudflare 代理对约 100 秒无数据的连接会断开，本项目内置 25 秒心跳，长连接不会被掐
- cloudflared 需要放行出站 7844 端口（家庭宽带默认放行；公司/受限网络可能封禁）
- 大陆玩家访问 Cloudflare 边缘节点速度一般，但可用
- 机器关机即服务下线，适合固定时间开团的场景

## AgentRouter + GLM 接入

当前后端默认按 AgentRouter 的 OpenAI 兼容接口调用 `glm-4.6`：

- 推荐直接配置 `LLM_API_URL=https://agentrouter.org/v1/chat/completions`
- 如果你填的是 `https://agentrouter.org` 或 `https://agentrouter.org/v1`，后端也会自动补全到正确的 `chat/completions` endpoint
- 默认模型是 `glm-4.6`
- 如需切换到其他兼容 OpenAI Chat Completions 的平台，再覆盖 `LLM_API_URL` 与 `LLM_MODEL`

## MiniMax 接入

后端支持 MiniMax 的 OpenAI 兼容接口，有两种配置方式。

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
- **海外/国内平台自动切换**：MiniMax 海外（`api.minimax.io`）与国内（`api.minimaxi.com`）平台的 key 不互通。后端在默认端点鉴权失败时会自动尝试另一个端点（叙事与生图均适用），因此国内平台的 key 无需额外配置即可使用

## MiniMax 场景生图

只要配置了 `MINIMAX_API_KEY`，建房与场景推进时会自动调用 MiniMax 图片生成接口（默认模型 `image-01`，16:9）为当前场景生成插画：

```text
MINIMAX_API_KEY=你的 MiniMax API Key
# 可选覆盖：
MINIMAX_IMAGE_MODEL=image-01
MINIMAX_IMAGE_URL=https://api.minimax.io/v1/image_generation
```

- 生图为异步执行，不阻塞行动；生成完成后通过 SSE 推送，前端自动换图
- 生成期间与未配置 key 时展示程序生成的 SVG 占位海报
- 图片缓存在 `.local/art/` 目录；Railway 未挂载持久卷时重启会丢图，再次访问场景会自动补生成
- 国内平台的 key 同样可用（自动切换到 `api.minimaxi.com`，见上文）

## 实时同步（SSE）

- 房间内行动、加入、场景换图通过 `GET /api/rooms/:roomId/events` 的 Server-Sent Events 即时推送
- 大厅房间列表变化通过 `GET /api/events` 推送
- 推送为"有更新"信号，客户端收到后带会话 token 重新拉取，断线后浏览器按 `retry` 间隔自动重连

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

## 代码结构

```text
server.mjs            # 入口：初始化存储、启动 HTTP 服务
src/
├── config.mjs        # 环境变量与 LLM/生图配置解析
├── store.mjs         # JSON 文件持久化与旧存档迁移
├── auth.mjs          # 轻量账号与会话
├── routes.mjs        # 全部 HTTP 路由
├── events.mjs        # SSE 订阅与广播
├── data/content.mjs  # 种族/职业/同伴/官方模组数据
├── game/rules.mjs    # 检定、危机值、HP、救助等核心规则（纯函数）
├── game/room.mjs     # 房间生命周期与视图组装
├── game/art.mjs      # 场景图占位 SVG 与生成图选路
└── llm/
    ├── narrator.mjs  # AI 叙事（含剧情历史上下文）与本地降级
    └── artist.mjs    # MiniMax 场景生图队列
tests/                # node:test 单元测试
```

## 当前实现说明

- 账号系统为轻量本地账号，适合 MVP 演示
- 数据默认保存在 `.local/app-state.json`，旧版本存档启动时自动迁移补齐新字段
- Railway 上若不挂载持久卷，重启后数据会重置
