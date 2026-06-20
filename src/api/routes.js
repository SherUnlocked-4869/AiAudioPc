const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const config = require('../../config');
const state = require('../state/state');
const TasteAnalyzer = require('../brain/taste');

function createRoutes(brain) {
  const tasteAnalyzer = new TasteAnalyzer();
  const router = express.Router();

  // POST /api/chat - 用户发消息，DJ 思考并返回 say/play/tts
  router.post('/chat', express.json(), async (req, res) => {
    try {
      const { text } = req.body || {};
      const response = await brain.think(text);
      res.json({ ok: true, ...response });
    } catch (err) {
      console.error('[api] /chat error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/now - 当前播放 + 上次 DJ 播报
  router.get('/now', async (req, res) => {
    const track = await brain.nowPlaying();
    const lastSay = state.getLastSay();
    res.json({ ok: true, nowPlaying: track, ...lastSay });
  });

  // GET /api/next - 下一首（由 AI 规划）
  router.get('/next', async (req, res) => {
    try {
      const response = await brain.nextTrack();
      res.json({ ok: true, ...response });
    } catch (err) {
      console.error('[api] /next error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/taste - 返回用户品味语料摘要
  router.get('/taste', (req, res) => {
    const taste = fs.readFileSync(path.join(config.paths.user, 'taste.md'), 'utf-8');
    res.json({ ok: true, taste });
  });

  // POST /api/taste/analyze - 根据歌单+历史生成新的品味语料
  router.post('/taste/analyze', express.json(), async (req, res) => {
    try {
      const { playlist } = req.body || {};
      const newTaste = await tasteAnalyzer.generate(playlist);
      res.json({ ok: true, taste: newTaste });
    } catch (err) {
      console.error('[api] /taste/analyze error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // GET /api/history - 播放历史（含喜欢/讨厌/还行）
  router.get('/history', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = state.getPlayHistory(limit);
    res.json({ ok: true, history });
  });

  // POST /api/feedback - 提交对歌曲的喜欢/讨厌/还行
  router.post('/feedback', express.json(), (req, res) => {
    const { id, feedback } = req.body || {};
    if (!id || !['like', 'dislike', 'neutral'].includes(feedback)) {
      return res.status(400).json({ ok: false, error: 'invalid feedback' });
    }
    const ok = state.setFeedback(id, feedback);
    res.json({ ok });
  });

  // GET /api/plan/today - 今日节律规划
  router.get('/plan/today', (req, res) => {
    const routines = fs.readFileSync(path.join(config.paths.user, 'routines.md'), 'utf-8');
    const s = state.load();
    res.json({ ok: true, plan: s.plan || {}, routines });
  });

  // GET /tts/:file - 播放 TTS 缓存文件
  router.get('/tts/:file', (req, res) => {
    const file = path.join(config.paths.cache, 'tts', req.params.file);
    if (!file.startsWith(path.resolve(config.paths.cache, 'tts'))) {
      return res.status(403).send('forbidden');
    }
    if (!fs.existsSync(file)) return res.status(404).send('not found');
    res.setHeader('Content-Type', 'audio/wav');
    fs.createReadStream(file).pipe(res);
  });

  // GET /api/stream?id=<netease_id> - 代理音频流，解决浏览器 CORS/Referer/过期问题
  router.get('/stream', async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ ok: false, error: 'missing id' });

    try {
      const urlInfo = await brain.netease.getSongUrl(id);
      if (!urlInfo || !urlInfo.url) {
        return res.status(404).json({ ok: false, error: '无法获取歌曲 URL' });
      }

      const headers = {
        Referer: 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };
      const range = req.headers.range;
      if (range) headers.Range = range;

      const audioRes = await axios({
        method: 'get',
        url: urlInfo.url,
        responseType: 'stream',
        headers,
        timeout: 15000,
        validateStatus: s => s >= 200 && s < 300,
      });

      const ct = (audioRes.headers['content-type'] || 'audio/mpeg').split(';')[0];
      res.status(audioRes.status);
      res.setHeader('Content-Type', ct);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (audioRes.headers['content-range']) {
        res.setHeader('Content-Range', audioRes.headers['content-range']);
      }
      if (audioRes.headers['content-length']) {
        res.setHeader('Content-Length', audioRes.headers['content-length']);
      }
      audioRes.data.pipe(res);
    } catch (err) {
      console.error('[api] /stream error:', err.message);
      res.status(502).json({ ok: false, error: '音频流获取失败' });
    }
  });

  // 直接搜索/解析音乐
  router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: 'missing q' });
    const songs = await brain.netease.search(q);
    res.json({ ok: true, songs });
  });

  return router;
}

module.exports = createRoutes;
