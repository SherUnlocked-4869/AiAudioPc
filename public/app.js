const app = {
  ws: null,
  audio: null,
  ttsAudio: null,
  currentTTS: null,
  queue: [],
  currentTrack: null,
  initialized: false,
  isPlaying: false,
  visualizerTimer: null,
};

const $ = id => document.getElementById(id);
const FEEDBACK_LABELS = { like: '喜欢', neutral: '还行', dislike: '讨厌' };

function init() {
  if (app.initialized) return;
  app.initialized = true;
  app.audio = $('audio');
  app.ttsAudio = new Audio();
  createVisualizer();
  bindAudioEvents();
  bindControls();
  connectWS();
  bindTabs();
  bindChat();
  bindFeedback();
  bindQuickActions();
  bindTasteAnalysis();
  checkAPI();
  loadProfile();
  registerSW();
  console.log('[app] initialized');
}

function createVisualizer() {
  const container = $('visualizer');
  container.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const bar = document.createElement('span');
    bar.style.height = '8%';
    container.appendChild(bar);
  }
}

function startVisualizer() {
  try {
    if (app.visualizerTimer) return;
    const vis = $('visualizer');
    if (!vis) return;
    const bars = vis.children;
    app.visualizerTimer = setInterval(() => {
      for (const bar of bars) {
        const h = Math.floor(Math.random() * 80 + 10);
        bar.style.height = h + '%';
      }
    }, 100);
  } catch (err) {
    console.error('[startVisualizer]', err);
  }
}

function stopVisualizer() {
  try {
    clearInterval(app.visualizerTimer);
    app.visualizerTimer = null;
    const vis = $('visualizer');
    if (vis) {
      for (const bar of vis.children) bar.style.height = '8%';
    }
  } catch (err) {
    console.error('[stopVisualizer]', err);
  }
}

function bindAudioEvents() {
  app.audio.addEventListener('error', (e) => {
    console.error('audio error', e);
    if (app.audio.error && app.audio.error.code === MediaError.MEDIA_ERR_NETWORK) {
      showStatus('音频加载失败，尝试重新解析…', true);
      if (app.currentTrack && app.currentTrack.id && !app.currentTrack._retried) {
        app.currentTrack._retried = true;
        refreshAndPlay(app.currentTrack);
      }
    }
  });

  app.audio.addEventListener('loadedmetadata', () => {
    $('duration').textContent = formatTime(app.audio.duration || 0);
    $('progress').value = 0;
    $('current-time').textContent = '0:00';
  });

  app.audio.addEventListener('timeupdate', () => {
    const pct = app.audio.duration ? (app.audio.currentTime / app.audio.duration) * 100 : 0;
    $('progress').value = pct;
    $('current-time').textContent = formatTime(app.audio.currentTime || 0);
  });

  app.audio.addEventListener('play', () => {
    app.isPlaying = true;
    updatePlayPauseBtn();
    startVisualizer();
    showStatus('正在播放');
  });

  app.audio.addEventListener('pause', () => {
    app.isPlaying = false;
    updatePlayPauseBtn();
    stopVisualizer();
  });

  app.audio.addEventListener('ended', () => {
    app.isPlaying = false;
    updatePlayPauseBtn();
    stopVisualizer();
    // 自动播放下一首
    if (app.queue.length) {
      const next = app.queue.shift();
      setCurrentTrack(next);
      playSongOnly();
    }
  });

  app.audio.addEventListener('waiting', () => {
    showStatus('缓冲中…', true);
  });

  app.ttsAudio.addEventListener('ended', () => {
    if (app.currentTrack) playSongOnly();
  });

  app.ttsAudio.addEventListener('error', () => {
    if (app.currentTrack) playSongOnly();
  });

  $('progress').addEventListener('input', (e) => {
    if (!app.audio.duration) return;
    app.audio.currentTime = (e.target.value / 100) * app.audio.duration;
  });
}

function bindControls() {
  $('play-pause').addEventListener('click', () => {
    if (!app.audio.src) return;
    if (app.isPlaying) {
      app.audio.pause();
    } else {
      app.audio.play().catch(() => {});
    }
  });

  $('next-btn').addEventListener('click', () => {
    console.log('[next-btn] clicked');
    addChat('user', '下一首');
    showStatus('Claudio 正在规划下一首…', true);
    fetchNext();
  });
}

function updatePlayPauseBtn() {
  $('play-pause').textContent = app.isPlaying ? '⏸' : '▶';
}

function stopAllAudio() {
  try {
    if (app.audio) app.audio.pause();
    if (app.ttsAudio) app.ttsAudio.pause();
    stopVisualizer();
    app.isPlaying = false;
    updatePlayPauseBtn();
  } catch (err) {
    console.error('[stopAllAudio]', err);
  }
}

function formatTime(sec) {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function connectWS() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/stream`;
  app.ws = new WebSocket(wsUrl);

  app.ws.onopen = () => {
    updateConnection(true);
    $('ws-status').textContent = '已连接';
  };

  app.ws.onclose = () => {
    updateConnection(false);
    $('ws-status').textContent = '未连接';
    setTimeout(connectWS, 3000);
  };

  app.ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    handleWSMessage(data);
  };
}

function updateConnection(online) {
  const el = $('connection');
  el.classList.toggle('online', online);
  el.textContent = online ? '● 在线' : '● 离线';
}

function handleWSMessage(data) {
  if (data.type === 'hello') {
    addChat('assistant', data.text);
  }
  if (data.type === 'progress') {
    showStatus(data.message || data.stage, true);
  }
  if (data.type === 'response') {
    showStatus('准备就绪');
    renderResponse(data);
  }
  if (data.type === 'scheduler' && data.text) {
    addChat('assistant', `【节律】${data.text}`);
  }
  if (data.type === 'error') {
    showStatus('出错了：' + data.message);
  }
}

function renderResponse(data) {
  try {
    console.log('[renderResponse]', data);
    const say = data.say || 'Claudio 暂时没有想好怎么说…';
    $('dj-text').textContent = say;
    app.currentTTS = data.tts || null;

    // 新响应到来时，先停掉当前播放，避免旧歌和新 DJ 语音冲突
    stopAllAudio();

    if (data.play && data.play.length) {
      const track = data.play.find(t => t.url);
      if (track) {
        setCurrentTrack(track);
        playTTSThenSong();
      }
      const idx = data.play.findIndex(t => t.url);
      app.queue = data.play.slice(idx + 1).filter(t => t.url);
    } else {
      // 没有推荐歌曲，只播放 DJ 语音（如果有）
      if (app.currentTTS) playTTSOnly();
    }

    const meta = data.play?.map(t => `《${t.name}》-${t.artist}`).join(' / ');
    addChat('assistant', say, meta);
  } catch (err) {
    console.error('[renderResponse] error', err);
    showStatus('渲染失败: ' + err.message);
  }
}

function setCurrentTrack(track) {
  app.currentTrack = track;
  $('track-name').textContent = track.name;
  $('track-artist').textContent = track.artist;
  $('feedback-bar').style.display = 'flex';
  updateFeedbackButtons(track.id, track.feedback);
}

function playTTSOnly() {
  if (!app.currentTTS) return;
  app.ttsAudio.src = app.currentTTS;
  app.ttsAudio.play().catch(err => console.error('tts play failed', err));
}

function playTTSThenSong() {
  if (app.currentTTS) {
    showStatus('正在播放 DJ 播报…');
    app.ttsAudio.src = app.currentTTS;
    app.ttsAudio.play().catch(err => {
      console.error('tts play failed', err);
      playSongOnly();
    });
  } else {
    playSongOnly();
  }
}

function playSongOnly() {
  if (!app.currentTrack) return;
  // 切换歌曲时强制重置进度
  app.audio.pause();
  app.audio.removeAttribute('src');
  app.audio.load();
  app.audio.src = app.currentTrack.url;
  app.audio.currentTime = 0;
  app.audio.play().catch(err => {
    console.error('song play failed', err);
    showStatus('点击播放按钮开始');
  });
}

function displayTrack(track, lastSay, lastTTS) {
  app.currentTrack = track;
  $('track-name').textContent = track.name;
  $('track-artist').textContent = track.artist;
  if (lastSay) $('dj-text').textContent = lastSay;
  if (lastTTS) app.currentTTS = lastTTS;
  const proxyUrl = track.id ? `/api/stream?id=${track.id}` : track.url;
  if (!app.audio.src && proxyUrl) {
    app.audio.src = proxyUrl;
  }
  $('feedback-bar').style.display = 'flex';
  updateFeedbackButtons(track.id, track.feedback);
}

async function refreshAndPlay(track) {
  showStatus('正在重新获取音频…', true);
  try {
    const res = await fetch(`/api/stream?id=${track.id}`);
    if (!res.ok) throw new Error('resolve failed');
    track.url = `/api/stream?id=${track.id}`;
    setCurrentTrack(track);
    playSongOnly();
  } catch (err) {
    showStatus('该歌曲暂时无法播放');
  }
}

function showStatus(text, loading = false) {
  const el = $('status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('loading', loading);
}

function addChat(role, text, meta) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  if (meta) {
    const small = document.createElement('small');
    small.textContent = meta;
    div.appendChild(small);
  }
  $('chat-history').appendChild(div);
  $('chat-history').scrollTop = $('chat-history').scrollHeight;
}

function bindTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      $(btn.dataset.view).classList.add('active');
      if (btn.dataset.view === 'history') await loadHistory();
    });
  });
}

function bindChat() {
  $('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    addChat('user', text);
    showStatus('Claudio 正在思考…', true);
    sendChat(text);
    input.value = '';
  });

  $('play-tts').addEventListener('click', async () => {
    if (!app.currentTTS) {
      showStatus('暂无 DJ 语音');
      return;
    }
    try {
      app.ttsAudio.src = app.currentTTS;
      await app.ttsAudio.play();
      showStatus('正在播放 DJ 语音');
    } catch (err) {
      console.error('tts play failed', err);
      showStatus('DJ 语音播放失败，请重试');
    }
  });

  $('clear-cache').addEventListener('click', () => {
    alert('TTS 缓存请手动清理 /cache/tts 目录');
  });
}

function bindFeedback() {
  document.querySelectorAll('#feedback-bar button').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!app.currentTrack) return;
      const feedback = btn.dataset.fb;
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: app.currentTrack.id, feedback }),
        });
        updateFeedbackButtons(app.currentTrack.id, feedback);
        showStatus(`已标记：${FEEDBACK_LABELS[feedback]}`);
      } catch (err) {
        showStatus('反馈提交失败');
      }
    });
  });
}

function updateFeedbackButtons(id, current) {
  document.querySelectorAll('#feedback-bar button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fb === current);
  });
}

function bindQuickActions() {
  document.querySelectorAll('.quick-actions button').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.msg;
      addChat('user', text);
      showStatus('Claudio 正在思考…', true);
      if (text === '下一首') {
        fetchNext();
      } else {
        sendChat(text);
      }
    });
  });
}

function bindTasteAnalysis() {
  $('analyze-taste').addEventListener('click', async () => {
    const raw = $('playlist-input').value.trim();
    if (!raw) {
      $('taste-result').textContent = '请先粘贴歌单歌曲名';
      return;
    }
    const playlist = raw.split('\n').map(line => {
      const [name, artist] = line.split(/[-–—]/).map(s => s.trim());
      return { name, artist: artist || '' };
    }).filter(s => s.name);

    await generateTaste({ playlist });
  });

  $('regenerate-taste').addEventListener('click', async () => {
    await generateTaste({ playlist: [] });
  });
}

async function generateTaste(body) {
  $('taste-result').textContent = '正在分析，请稍候…';
  try {
    const res = await fetch('/api/taste/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) {
      $('taste-result').textContent = '品味语料已更新';
      $('taste-md').textContent = data.taste;
    } else {
      $('taste-result').textContent = '更新失败：' + data.error;
    }
  } catch (err) {
    $('taste-result').textContent = '请求失败，请重试';
  }
}

function sendChat(text) {
  if (app.ws && app.ws.readyState === WebSocket.OPEN) {
    app.ws.send(JSON.stringify({ type: 'chat', text }));
  } else {
    fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
      .then(r => r.json()).then(data => {
        showStatus('准备就绪');
        renderResponse(data);
      }).catch(err => showStatus('请求失败'));
  }
}

function checkAPI() {
  fetch('/health')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(() => $('api-status').textContent = '正常')
    .catch(() => $('api-status').textContent = '异常');
}

async function loadProfile() {
  console.log('[app] loadProfile /api/now once');
  try {
    const [taste, routines, mood, now] = await Promise.all([
      fetch('/api/taste').then(r => r.json()),
      fetch('/api/plan/today').then(r => r.json()),
      fetch('/user/mood-rules.md').then(r => r.text()),
      fetch('/api/now').then(r => r.json()),
    ]);
    $('taste-md').textContent = taste.taste;
    $('routines-md').textContent = routines.routines;
    $('mood-md').textContent = mood;
    if (now.nowPlaying) displayTrack(now.nowPlaying, now.say, now.tts);
  } catch (err) {
    console.error('load profile failed', err);
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history?limit=50');
    const data = await res.json();
    const list = $('history-list');
    list.innerHTML = '';
    if (!data.history || !data.history.length) {
      list.innerHTML = '<p class="hint">暂无播放记录</p>';
      return;
    }
    data.history.forEach(h => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const time = new Date(h.ts).toLocaleString('zh-CN');
      item.innerHTML = `
        <div class="info">
          <div class="name">《${h.name}》 - ${h.artist}</div>
          <div class="meta">${time}</div>
        </div>
        <span class="badge ${h.feedback || 'neutral'}">${FEEDBACK_LABELS[h.feedback] || '还行'}</span>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    console.error('load history failed', err);
  }
}

async function fetchNext() {
  console.log('[fetchNext] start');
  stopAllAudio();
  showStatus('Claudio 正在规划下一首…', true);
  try {
    const r = await fetch('/api/next');
    const data = await r.json();
    console.log('[fetchNext] response', data);
    showStatus('准备就绪');
    renderResponse(data);
  } catch (err) {
    console.error('[fetchNext] error', err);
    showStatus('出错了：' + err.message);
  }
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    // 注销旧 SW，避免旧代码缓存导致异常
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      await reg.unregister();
    }
    await navigator.serviceWorker.register('/sw.js?v=7');
    console.log('sw registered');
  } catch (err) {
    console.error('sw error', err);
  }
}

init();
