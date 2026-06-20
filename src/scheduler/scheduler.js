const schedule = require('node-schedule');
const state = require('../state/state');
const TasteAnalyzer = require('../brain/taste');

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

class Scheduler {
  constructor(emitter) {
    this.emitter = emitter;
    this.jobs = [];
    this.tasteAnalyzer = new TasteAnalyzer();
  }

  start() {
    // 07:00 规划：早安唤醒
    this.jobs.push(schedule.scheduleJob('0 7 * * *', () => {
      this.emit('rhythm', { type: 'morning', hour: 7, text: '早上好，该起床了。' });
    }));

    // 09:00 早间：专注开始
    this.jobs.push(schedule.scheduleJob('0 9 * * *', () => {
      this.emit('rhythm', { type: 'focus', hour: 9, text: '上午好，进入专注时间。' });
    }));

    // 12:30 午休
    this.jobs.push(schedule.scheduleJob('30 12 * * *', () => {
      this.emit('rhythm', { type: 'lunch', hour: 12, text: '午休时间，放一首轻松的歌。' });
    }));

    // 18:00 下班
    this.jobs.push(schedule.scheduleJob('0 18 * * *', () => {
      this.emit('rhythm', { type: 'evening', hour: 18, text: '下班了，释放一下。' });
    }));

    // 22:00 夜间
    this.jobs.push(schedule.scheduleJob('0 22 * * *', () => {
      this.emit('rhythm', { type: 'night', hour: 22, text: '晚上好，进入夜间模式。' });
    }));

    // 每小时的"情绪检查"
    this.jobs.push(schedule.scheduleJob('0 * * * *', () => {
      const s = state.load();
      s.lastCheckIn = Date.now();
      state.save(s);
      this.emit('checkin', { ts: Date.now() });
    }));

    // 每天 03:00 检查是否需要更新品味语料（每 2 天一次）
    this.jobs.push(schedule.scheduleJob('0 3 * * *', () => {
      this.checkAndUpdateTaste();
    }));

    console.log('[scheduler] started');
  }

  async checkAndUpdateTaste() {
    const s = state.load();
    const last = s.lastTasteUpdate || 0;
    if (Date.now() - last < TWO_DAYS_MS) {
      console.log('[scheduler] taste update skipped, last:', new Date(last).toISOString());
      return;
    }
    try {
      console.log('[scheduler] updating taste...');
      const newTaste = await this.tasteAnalyzer.generate();
      s.lastTasteUpdate = Date.now();
      state.save(s);
      this.emit('taste_updated', { ts: s.lastTasteUpdate });
      console.log('[scheduler] taste updated');
    } catch (err) {
      console.error('[scheduler] taste update failed:', err.message);
    }
  }

  emit(event, payload) {
    if (this.emitter) this.emitter.emit('scheduler', { event, ...payload });
  }

  stop() {
    this.jobs.forEach(j => j.cancel());
    this.jobs = [];
  }
}

module.exports = Scheduler;
