const fs = require('fs');
const path = require('path');
const config = require('../../config');
const state = require('../state/state');
const DeepSeekAdapter = require('./deepseek');

class TasteAnalyzer {
  constructor() {
    this.deepseek = new DeepSeekAdapter();
    this.userDir = config.paths.user;
  }

  readTaste() {
    try {
      return fs.readFileSync(path.join(this.userDir, 'taste.md'), 'utf-8');
    } catch (err) {
      return '';
    }
  }

  saveTaste(content) {
    fs.writeFileSync(path.join(this.userDir, 'taste.md'), content, 'utf-8');
  }

  formatHistory(history) {
    if (!history.length) return '暂无播放记录';
    return history.map(h => {
      const feedbackMap = {
        like: '喜欢',
        dislike: '讨厌',
        neutral: '还行',
      };
      return `- ${h.name} - ${h.artist}（${feedbackMap[h.feedback] || '还行'}）`;
    }).join('\n');
  }

  formatPlaylist(songs) {
    if (!songs || !songs.length) return '未导入歌单';
    return songs.map(s => `- ${s.name}${s.artist ? ' - ' + s.artist : ''}`).join('\n');
  }

  async generate(playlistSongs = []) {
    const taste = this.readTaste();
    const history = state.getPlayHistory(100);

    const messages = [
      {
        role: 'system',
        content: '你是一位音乐品味分析助手。请根据用户提供的现有品味语料、播放历史（含喜欢/讨厌/还行评价）和导入歌单，生成一份更新后的「用户品味语料」。保持 markdown 格式，结构清晰，语言自然。不要编造未提及的歌曲。',
      },
      {
        role: 'user',
        content: `## 现有品味语料\n${taste || '（空）'}\n\n## 最近播放历史（含评价）\n${this.formatHistory(history)}\n\n## 导入歌单\n${this.formatPlaylist(playlistSongs)}\n\n请生成新的 taste.md 内容，直接返回 markdown 文本，不要加任何解释。`,
      },
    ];

    const newTaste = await this.deepseek.text(messages, { max_tokens: 2048 });
    if (!newTaste) throw new Error('生成品味语料失败');

    this.saveTaste(newTaste);
    return newTaste;
  }
}

module.exports = TasteAnalyzer;
