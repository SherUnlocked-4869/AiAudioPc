const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const ContextBuilder = require('./context');
const IntentRouter = require('./router');
const DeepSeekAdapter = require('./deepseek');
const NeteaseAdapter = require('../music/netease');
const TTS = require('../voice/tts');
const state = require('../state/state');
const config = require('../../config');

class ClaudioBrain extends EventEmitter {
  constructor(options = {}) {
    super();
    this.context = new ContextBuilder();
    this.router = new IntentRouter();
    this.deepseek = new DeepSeekAdapter();
    this.netease = new NeteaseAdapter(options.neteaseBaseURL);
    this.tts = new TTS();
  }

  async think(userInput = '', toolResults = [], { emitProgress } = {}) {
    // 1. 意图分流
    const intent = await this.router.route(userInput);
    console.log('[claudio] intent:', intent);
    this.emit('progress', { stage: 'routing', intent });

    // 对模糊请求做扩展，帮助 AI 理解
    let expandedInput = userInput;
    if (/^(来首歌|来首|放首歌|给首歌|推荐首歌|推首歌)/.test(userInput)) {
      expandedInput = '请根据我的品味推荐一首歌';
    }

    // 2. 组装上下文
    const { messages } = this.context.build(expandedInput, toolResults);
    this.emit('progress', { stage: 'context', message: '已组装上下文' });

    // 3. 调用 AI（默认关闭 thinking，响应更快；无用户输入时提高温度增加多样性）
    this.emit('progress', { stage: 'thinking', message: 'Claudio 正在思考…' });
    const temp = (!userInput && !toolResults.length) ? 1.05 : 0.85;
    let result = await this.deepseek.chat(messages, { temperature: temp });
    console.log('[claudio] ai result keys:', Object.keys(result));

    // 4. 过滤掉最近播放过的歌曲，避免重复
    result.play = this.filterRecentTracks(result.play || []);
    const isMusicRequest = !userInput || /(歌|曲|音乐|下一首|推荐|听|放|播放)/.test(userInput);
    if (!result.play.length && isMusicRequest) {
      console.log('[claudio] empty play list for music request, retrying...');
      result = await this.deepseek.chat(messages, { temperature: 1.15 });
      result.play = this.filterRecentTracks(result.play || []);
    }
    if (!result.play.length && isMusicRequest) {
      console.log('[claudio] still empty, fallback to playlist');
      result = await this.fallbackFromPlaylist(result);
    }

    // 5. 并行解析歌曲 + 合成 TTS
    const playPromise = this.resolveTracks(result.play);
    const ttsPromise = result.say
      ? this.tts.synthesize(result.say, '温暖、自然、像深夜电台 DJ 一样播报，语速适中。')
      : Promise.resolve(null);

    this.emit('progress', { stage: 'resolving', message: '正在找歌并合成语音…' });
    const [resolved, ttsPath] = await Promise.all([playPromise, ttsPromise]);

    // 5. 记录对话
    state.appendMessage('user', userInput, { intent: intent.intent });
    state.appendMessage('assistant', result.say, { play: resolved.map(t => t.name) });

    const ttsUrl = ttsPath ? `/cache/tts/${require('path').basename(ttsPath)}` : null;
    state.setLastSay(result.say, ttsUrl);

    const response = {
      say: result.say,
      play: resolved,
      reason: result.reason,
      segue: result.segue,
      tts: ttsUrl,
      intent: intent.intent,
    };

    this.emit('response', response);
    return response;
  }

  filterRecentTracks(tracks) {
    if (!Array.isArray(tracks)) return [];
    const recent = state.getRecentPlays(20);
    const recentIds = new Set(recent.map(p => String(p.id)));
    const recentKeys = new Set(recent.map(p => `${p.name}-${p.artist}`));
    return tracks.filter(t => {
      const key = `${t.name}-${t.artist}`;
      return !recentIds.has(String(t.id)) && !recentKeys.has(key);
    });
  }

  async resolveTracks(tracks) {
    if (!Array.isArray(tracks)) return [];

    const resolved = await Promise.all(
      tracks.slice(0, 3).map(async (track) => {
        const keyword = `${track.name} ${track.artist}`;
        const song = await this.netease.resolve(keyword);
        if (song) {
          const stored = state.recordPlay(song, 'dj');
          return {
            ...track,
            ...stored,
            // 前端使用代理流地址，避免 CORS/Referer/URL 过期问题
            url: `/api/stream?id=${stored.id}`,
            sourceUrl: stored.url,
          };
        }
        return track;
      })
    );

    return resolved;
  }

  async directPlay(keyword) {
    const song = await this.netease.resolve(keyword);
    if (!song) {
      return { ok: false, message: `没找到《${keyword}》，换个关键词试试。` };
    }
    const stored = state.recordPlay(song, 'direct');
    return { ok: true, play: { ...stored, url: `/api/stream?id=${stored.id}`, sourceUrl: stored.url } };
  }

  async nowPlaying() {
    const s = state.load();
    return s.nowPlaying;
  }

  async nextTrack() {
    const s = state.load();
    const recent = s.plays.slice(-5);
    const mood = this.inferMoodFromHistory(recent);
    let resp = await this.think('', [{ tool: 'mood_inference', result: { mood } }]);

    // 如果 AI 没有返回歌曲，重试一次；若仍为空，从用户歌单兜底
    if (!resp.play || !resp.play.length) {
      console.log('[claudio] nextTrack empty, retrying...');
      resp = await this.think('请推荐一首歌', [{ tool: 'mood_inference', result: { mood } }]);
    }
    if (!resp.play || !resp.play.length) {
      console.log('[claudio] nextTrack still empty, fallback to playlist');
      resp = await this.fallbackFromPlaylist(resp);
    }
    return resp;
  }

  async fallbackFromPlaylist(baseResp) {
    try {
      const playlists = JSON.parse(fs.readFileSync(path.join(config.paths.user, 'playlists.json'), 'utf-8'));
      const keys = Object.keys(playlists).filter(k => Array.isArray(playlists[k]) && playlists[k].length);
      if (!keys.length) return baseResp;
      const key = keys[Math.floor(Math.random() * keys.length)];
      const songs = playlists[key];
      const song = songs[Math.floor(Math.random() * songs.length)];
      const resolved = await this.resolveTracks([{ name: song.name, artist: song.artist, reason: '从用户歌单兜底推荐' }]);
      if (!resolved.length) return baseResp;
      const actual = resolved[0];
      const fallbackSays = [
        `来一首${actual.artist}的《${actual.name}》，换个心情。`,
        `突然想放这首《${actual.name}》，${actual.artist}的声音很适合现在。`,
        `从歌单里翻出《${actual.name}》，${actual.artist}，希望你喜欢。`,
        `这首《${actual.name}》-${actual.artist}，像老朋友突然出现。`,
        `换换口味，听${actual.artist}的《${actual.name}》。`,
      ];
      const say = baseResp.say || fallbackSays[Math.floor(Math.random() * fallbackSays.length)];
      return { ...baseResp, say, play: resolved };
    } catch (err) {
      console.error('[claudio] fallback error:', err.message);
      return baseResp;
    }
  }

  inferMoodFromHistory(plays) {
    if (!plays.length) return 'neutral';
    const hours = new Date().getHours();
    if (hours >= 22 || hours < 6) return 'night';
    if (hours >= 7 && hours < 10) return 'morning';
    return 'auto';
  }
}

module.exports = ClaudioBrain;
