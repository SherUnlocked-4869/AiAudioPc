const fs = require('fs');
const path = require('path');
const config = require('../../config');
const state = require('../state/state');

class ContextBuilder {
  constructor() {
    this.userDir = config.paths.user;
    this.promptsDir = config.paths.prompts;
  }

  read(file) {
    try {
      return fs.readFileSync(file, 'utf-8');
    } catch (err) {
      return '';
    }
  }

  // 第 3 层：6 片组装 prompt
  build(userInput = '', toolResults = []) {
    const now = new Date();
    const hour = now.getHours();
    const timeLabel = this.timeLabel(hour);

    const fragments = [
      { role: 'system', name: '① 系统提示词', content: this.read(path.join(this.promptsDir, 'dj-persona.md')) },
      { role: 'system', name: '② 用户语料', content: this.buildUserCorpus() },
      { role: 'system', name: '③ 环境注入', content: this.buildEnvironment() },
      { role: 'system', name: '④ 已检索记忆', content: this.buildMemory() },
      { role: 'user', name: '⑤ 用户输入 / 工具结果', content: this.buildUserInput(userInput, toolResults) },
      { role: 'system', name: '⑥ 执行轨迹', content: this.buildTrajectory() },
    ];

    const messages = [];
    let contextWindow = '';

    for (const f of fragments) {
      contextWindow += `\n--- ${f.name} ---\n${f.content}`;
      messages.push({ role: f.role, content: `[${f.name}]\n${f.content}` });
    }

    return { messages, contextWindow, timeLabel };
  }

  buildUserCorpus() {
    const taste = this.read(path.join(this.userDir, 'taste.md'));
    const routines = this.read(path.join(this.userDir, 'routines.md'));
    const mood = this.read(path.join(this.userDir, 'mood-rules.md'));
    const playlists = this.read(path.join(this.userDir, 'playlists.json'));
    return `## 品味\n${taste}\n\n## 日常\n${routines}\n\n## 情绪规则\n${mood}\n\n## 歌单\n${playlists}`;
  }

  buildEnvironment() {
    const now = new Date();
    return `当前时间：${now.toLocaleString('zh-CN')}\n时段：${this.timeLabel(now.getHours())}\n天气：未知（可在设置中配置）`;
  }

  buildMemory() {
    const recentPlays = state.getRecentPlays(15);
    const feedbackMap = { like: '喜欢', dislike: '讨厌', neutral: '还行' };
    const playsText = recentPlays.length
      ? recentPlays.map(p => {
          const fb = feedbackMap[p.feedback] || '';
          return `- ${new Date(p.ts).toLocaleTimeString('zh-CN')} 播放了《${p.name}》-${p.artist}${fb ? ' [' + fb + ']' : ''}`;
        }).join('\n')
      : '暂无最近播放记录';
    const avoidList = recentPlays.slice(0, 10).map(p => `《${p.name}》-${p.artist}`).join('、');
    return `最近播放（含评价）：\n${playsText}\n\n请避免推荐以下最近播放过的歌曲：${avoidList || '（无）'}`;
  }

  buildUserInput(input, toolResults) {
    const styles = [
      '用一个生活小场景开场',
      '提到一个细节或感官感受',
      '用一句歌词/台词引入',
      '从当前时间或天气切入',
      '像老朋友随口闲聊',
      '讲一个和歌曲有关的小故事',
    ];
    const styleHint = styles[Math.floor(Math.random() * styles.length)];

    let text = input || '（用户没有说话，请根据当前时段和习惯主动推荐音乐）';
    text += `\n\n【本次播报风格要求】${styleHint}，避免和上次使用相同的核心比喻或句子。`;

    if (toolResults && toolResults.length) {
      text += '\n\n工具结果：\n' + toolResults.map(t => `- ${t.tool}: ${JSON.stringify(t.result)}`).join('\n');
    }
    return text;
  }

  buildTrajectory() {
    const messages = state.getMessages(10);
    if (!messages.length) return '（无历史轨迹）';
    return messages.map(m => `- ${m.role}: ${m.content?.slice(0, 120)}...`).join('\n');
  }

  timeLabel(hour) {
    if (hour >= 6 && hour < 10) return '早晨';
    if (hour >= 10 && hour < 14) return '上午/午间';
    if (hour >= 14 && hour < 18) return '下午';
    if (hour >= 18 && hour < 23) return '晚间';
    return '深夜';
  }
}

module.exports = ContextBuilder;
