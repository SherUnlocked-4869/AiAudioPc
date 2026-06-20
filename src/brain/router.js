class IntentRouter {
  constructor(deps) {
    this.deps = deps;
  }

  // 简单意图分流
  async route(input) {
    const text = (input || '').trim();
    if (!text) return { intent: 'auto', target: 'deepseek' };

    const lower = text.toLowerCase();

    // 直链音乐指令
    if (/^(播放|放歌|来首|我想听|给我放)/.test(text)) {
      return { intent: 'music_direct', target: 'netease', keyword: text.replace(/^(播放|放歌|来首|我想听|给我放)/, '').trim() };
    }

    // 天气
    if (/天气|temperature|forecast/.test(lower)) {
      return { intent: 'weather', target: 'weather' };
    }

    // 自然语言 / DJ 交互
    return { intent: 'chat', target: 'deepseek' };
  }
}

module.exports = IntentRouter;
