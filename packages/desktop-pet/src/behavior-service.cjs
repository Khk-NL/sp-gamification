const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BEHAVIOR_SETTINGS = { dayNightEnabled: true, sleepStartHour: 23, wakeHour: 7, proactiveEnabled: false, proactiveIntervalMinutes: 60, hourlyChimeEnabled: false, systemLoadAwareness: false, randomEventsEnabled: false };
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temp, file); };
const hour = (value, fallback) => Number.isInteger(Number(value)) ? Math.min(23, Math.max(0, Number(value))) : fallback;
const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

class BehaviorService {
  constructor(dataDirectory) { this.file = path.join(dataDirectory, 'behavior-settings.json'); this.lastProactiveAt = 0; this.lastChimeKey = ''; this.lastRandomKey = ''; fs.mkdirSync(dataDirectory, { recursive: true }); }
  settings() { const value = readJson(this.file, {}); return { dayNightEnabled: value.dayNightEnabled !== false, sleepStartHour: hour(value.sleepStartHour, 23), wakeHour: hour(value.wakeHour, 7), proactiveEnabled: value.proactiveEnabled === true, proactiveIntervalMinutes: Math.min(240, Math.max(15, Number(value.proactiveIntervalMinutes) || 60)), hourlyChimeEnabled: value.hourlyChimeEnabled === true, systemLoadAwareness: value.systemLoadAwareness === true, randomEventsEnabled: value.randomEventsEnabled === true, wakeOverrideDay: typeof value.wakeOverrideDay === 'string' ? value.wakeOverrideDay : null }; }
  updateSettings(changes) { const next = { ...this.settings(), ...changes }; writeJsonAtomic(this.file, next); return this.settings(); }
  wake(now = new Date()) { return this.updateSettings({ wakeOverrideDay: dayKey(now) }); }
  asleep(now = new Date()) { const settings = this.settings(); if (!settings.dayNightEnabled || settings.wakeOverrideDay === dayKey(now)) return false; const current = now.getHours(), start = settings.sleepStartHour, end = settings.wakeHour; return start === end ? false : start > end ? current >= start || current < end : current >= start && current < end; }
  tick(now = new Date()) { const settings = this.settings(), events = [], timestamp = now.getTime(); if (settings.hourlyChimeEnabled && now.getMinutes() === 0) { const key = `${dayKey(now)}-${now.getHours()}`; if (this.lastChimeKey !== key) { this.lastChimeKey = key; events.push({ type: 'HOURLY_CHIME', message: `现在是 ${String(now.getHours()).padStart(2, '0')}:00。` }); } } if (settings.proactiveEnabled && timestamp - this.lastProactiveAt >= settings.proactiveIntervalMinutes * 60_000) { this.lastProactiveAt = timestamp; events.push({ type: 'PROACTIVE_BUBBLE', message: '要不要确认一下当前最重要的小目标？' }); } const randomKey = `${dayKey(now)}-${now.getHours()}`; if (settings.randomEventsEnabled && Math.floor(timestamp / 3_600_000) % 17 === 0 && this.lastRandomKey !== randomKey) { this.lastRandomKey = randomKey; events.push({ type: 'RANDOM_EVENT', message: '我找到了一片像素叶子，送给你当作今天的小彩蛋。' }); } return { asleep: this.asleep(now), settings, events }; }
  snapshot(now = new Date()) { return { asleep: this.asleep(now), settings: this.settings() }; }
}

module.exports = { BehaviorService, DEFAULT_BEHAVIOR_SETTINGS };
