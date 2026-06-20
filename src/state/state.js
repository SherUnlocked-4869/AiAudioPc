const fs = require('fs');
const path = require('path');
const config = require('../../config');

const STATE_FILE = path.join(config.paths.data, 'state.json');

const defaultState = {
  messages: [],         // 对话历史
  plays: [],            // 播放记录
  plan: {},             // 今日规划
  prefs: {},            // 偏好
  nowPlaying: null,     // 当前播放
  lastCheckIn: null,    // 上次节律检查
  lastTasteUpdate: 0,   // 上次自动生成品味语料时间
  lastSay: '',          // 上次 DJ 播报文本
  lastTTS: null,        // 上次 DJ 播报语音文件
};

function load() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
      fs.writeFileSync(STATE_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
      return JSON.parse(JSON.stringify(defaultState));
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return { ...defaultState, ...JSON.parse(raw || '{}') };
  } catch (err) {
    console.error('[state] load error:', err.message);
    return JSON.parse(JSON.stringify(defaultState));
  }
}

function save(state) {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('[state] save error:', err.message);
  }
}

function appendMessage(role, content, extra = {}) {
  const state = load();
  state.messages.push({ role, content, ts: Date.now(), ...extra });
  // 保留最近 50 条
  if (state.messages.length > 50) state.messages = state.messages.slice(-50);
  save(state);
}

function recordPlay(track, source = 'dj') {
  const state = load();
  const idx = state.plays.findIndex(p => p.id === track.id);
  let stored;
  if (idx !== -1) {
    // 更新播放时间和来源，保留已有反馈，并移到末尾作为最新记录
    const existing = state.plays[idx];
    existing.ts = Date.now();
    existing.source = source;
    existing.url = track.url || existing.url;
    state.plays.splice(idx, 1);
    state.plays.push(existing);
    stored = existing;
  } else {
    stored = { ...track, source, ts: Date.now(), feedback: 'neutral' };
    state.plays.push(stored);
  }
  state.nowPlaying = stored;
  if (state.plays.length > 200) state.plays = state.plays.slice(-200);
  save(state);
  return stored;
}

function setFeedback(id, feedback) {
  const state = load();
  // 找到该歌曲最近的播放记录
  const idx = state.plays.map(p => String(p.id)).lastIndexOf(String(id));
  if (idx !== -1) {
    state.plays[idx].feedback = feedback;
    save(state);
    return true;
  }
  return false;
}

function getPlayHistory(n = 50) {
  const state = load();
  return state.plays.slice().reverse().slice(0, n);
}

function setLastSay(say, tts) {
  const state = load();
  state.lastSay = say || '';
  state.lastTTS = tts || null;
  save(state);
}

function getLastSay() {
  const state = load();
  return { say: state.lastSay || '', tts: state.lastTTS || null };
}

function setNowPlaying(track) {
  const state = load();
  state.nowPlaying = track;
  save(state);
}

function getRecentPlays(n = 5) {
  const state = load();
  return state.plays.slice(-n);
}

function getMessages(n = 20) {
  const state = load();
  return state.messages.slice(-n);
}

module.exports = {
  load,
  save,
  appendMessage,
  recordPlay,
  setNowPlaying,
  setFeedback,
  setLastSay,
  getLastSay,
  getRecentPlays,
  getMessages,
  getPlayHistory,
};
