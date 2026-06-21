# Claudio · 个人 AI 电台

根据「Claudio 的施工图」实现的一套个人 AI 电台系统：
- **AI 大脑**：DeepSeek `deepseek-v4-flash`（思考模式默认关闭）
- **语音合成**：MiMo `mimo-v2.5-tts`
- **音乐来源**：网易云音乐（NeteaseCloudMusicApi）
- **前端**：PWA（Player / History / Profile / Settings 四视图）
- **播放体验**：每次交互先播放 DJ 播报，再播放歌曲
- **反馈与历史**：喜欢 / 还行 / 讨厌，历史记录自动沉淀
- **品味进化**：导入歌单 + 历史反馈 → 自动生成 `taste.md`，每 2 天自动刷新

## 快速开始

```bash
npm install

# 复制示例环境变量文件并填入你的密钥
cp .env.example .env
# 编辑 .env，填写 DEEPSEEK_API_KEY 和 MIMO_API_KEY

npm start
```

服务默认启动在 `http://localhost:8080`，PWA 页面在根路径 `/`。

> ⚠️ 不要把真实的 `.env` 文件提交到 Git，它已被 `.gitignore` 排除。

## 项目结构

```
.
├── server.js                 # Express + WebSocket 入口
├── config.js                 # API 密钥与模型配置
├── src/
│   ├── brain/
│   │   ├── claudio.js        # 核心大脑：意图→上下文→AI→音乐→TTS
│   │   ├── context.js        # 6 片 prompt 组装
│   │   ├── deepseek.js       # DeepSeek 适配器
│   │   ├── router.js         # 简单意图分流
│   │   └── taste.js          # 品味语料生成器
│   ├── music/netease.js      # 网易云音乐适配器
│   ├── voice/tts.js          # MiMo TTS 管线与缓存
│   ├── scheduler/scheduler.js# 节律调度 + 每 2 天自动更新品味
│   ├── state/state.js        # JSON 状态持久化
│   └── api/routes.js         # HTTP API
├── public/                   # PWA 前端
├── user/                     # 用户品味语料
├── prompts/                  # 系统提示词
└── cache/tts/                # TTS 缓存
```

## React 前端（Phase 1）

新的 React + Vite + TypeScript + Tailwind + shadcn 前端位于 `client/`，与现有纯 JS PWA 并存：

- 旧 PWA 仍在根路径 `/`（`public/`），不受影响。
- React 构建产物挂在子路径 `/react`，dev 与 prod 均如此。

### 开发

```bash
# 1. 先启动后端（提供 /api 与 /stream）
npm start

# 2. 另开终端，启动 Vite dev server（:5173，自动代理 /api、/stream 到 :8080）
cd client
npm install
npm run dev
# 打开 http://localhost:5173/react/
```

### 生产构建

```bash
# 在仓库根目录
npm run build:client     # 等价于 cd client && npm run build → 输出 client/dist
npm start                # 访问 http://localhost:8080/react/
```

Phase 1 仅包含应用外壳（TopBar + 4 个占位视图）与全屏 `InteractiveDots` 背景效果；各视图逻辑将在后续阶段迁移。

## HTTP API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 用户发消息，返回 say/play/tts |
| GET  | `/api/now` | 当前播放 |
| GET  | `/api/next` | AI 规划下一首 |
| GET  | `/api/taste` | 用户品味语料 |
| POST | `/api/taste/analyze` | 导入歌单 + 历史 → 生成新品味语料 |
| GET  | `/api/history` | 播放历史（含喜欢/讨厌/还行） |
| POST | `/api/feedback` | 提交歌曲反馈 |
| GET  | `/api/plan/today` | 今日节律规划 |
| GET  | `/api/stream?id=<netease_id>` | 音频代理流（解决 CORS/Referer/过期） |
| WS   | `/stream` | 流式聊天、进度与节律推送 |

## 个性化配置

编辑 `user/` 下的文件即可改变 Claudio 对你的理解：
- `taste.md`：音乐品味
- `routines.md`：日常节律
- `playlists.json`：常备歌单
- `mood-rules.md`：情绪规则

修改 `prompts/dj-persona.md` 可调整 DJ 人格与输出 JSON 格式。

## 安全提示

当前 `config.js` 已按需求内置了默认 API Key。生产环境建议：
1. 复制 `.env.example` 为 `.env`
2. 在 `.env` 中填写密钥
3. 修改 `config.js` 使用 `require('dotenv').config()`

## 已知限制

- 网易云音乐 URL 可能带时效性，播放失败时可尝试点击「下一首」重新解析。
- TTS 使用非流式调用合成后缓存，流式模式已在 `src/voice/tts.js` 中保留接口。
