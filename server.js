const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const EventEmitter = require('events');

const config = require('./config');
const ClaudioBrain = require('./src/brain/claudio');
const createRoutes = require('./src/api/routes');
const Scheduler = require('./src/scheduler/scheduler');
const state = require('./src/state/state');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/stream' });
const bus = new EventEmitter();

const brain = new ClaudioBrain();
const scheduler = new Scheduler(bus);

// 静态文件 / PWA：HTML/JS/CSS 禁用长期缓存，避免旧版本循环
const staticOptions = {
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
};
app.use(express.static(path.join(__dirname, 'public'), staticOptions));
app.use('/user', express.static(path.join(__dirname, 'user')));
app.use('/prompts', express.static(path.join(__dirname, 'prompts')));
app.use('/cache/tts', express.static(path.join(__dirname, 'cache', 'tts')));
app.use('/api', createRoutes(brain));

// React 前端（Phase 1）：构建产物在 client/dist，挂在 /react，不影响旧 PWA 的 /
app.use('/react', express.static(path.join(__dirname, 'client/dist'), staticOptions));
app.get(['/react', '/react/{*path}'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// 健康检查
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// WebSocket 流式聊天
wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  ws.send(JSON.stringify({ type: 'hello', text: 'Claudio 已上线，随时陪你听歌。' }));

  const onProgress = (p) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'progress', ...p }));
    }
  };
  brain.on('progress', onProgress);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'chat') {
        const response = await brain.think(msg.text);
        ws.send(JSON.stringify({ type: 'response', ...response }));
      }
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      console.error('[ws] message error:', err.message);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });

  ws.on('close', () => {
    brain.off('progress', onProgress);
    console.log('[ws] client disconnected');
  });
});

// 节律调度事件广播给所有 WS 客户端
bus.on('scheduler', (payload) => {
  const data = JSON.stringify({ type: 'scheduler', ...payload });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });

  // 自动触发 AI 规划
  if (payload.text) {
    brain.think(payload.text).catch(err => console.error('[scheduler] auto think error:', err.message));
  }
});

// 启动
server.listen(config.port, () => {
  scheduler.start();
  console.log(`[claudio] server running at http://localhost:${config.port}`);
  console.log('[claudio] websocket at ws://localhost:%d/stream', config.port);
});

// 优雅退出
process.on('SIGINT', () => {
  scheduler.stop();
  server.close(() => process.exit(0));
});
