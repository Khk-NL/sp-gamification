const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_FOCUS_SETTINGS = { durationMinutes: 25, workApps: [], entertainmentApps: [], gameApps: [] };
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temp, file); };
const terms = (value) => { const entries = Array.isArray(value) ? value : String(value || '').split(/[\r\n,]+/); return [...new Set(entries.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean))].slice(0, 100); };

class FocusTimer {
  constructor(dataDirectory) { this.settingsFile = path.join(dataDirectory, 'focus-settings.json'); this.sessionFile = path.join(dataDirectory, 'focus-session.json'); fs.mkdirSync(dataDirectory, { recursive: true }); }
  settings() { const value = readJson(this.settingsFile, {}); return { durationMinutes: Math.min(120, Math.max(5, Math.floor(Number(value.durationMinutes) || 25))), workApps: terms(value.workApps), entertainmentApps: terms(value.entertainmentApps), gameApps: terms(value.gameApps) }; }
  updateSettings(changes) { const next = { ...this.settings(), ...changes }; const normalized = { durationMinutes: Math.min(120, Math.max(5, Math.floor(Number(next.durationMinutes) || 25))), workApps: terms(next.workApps), entertainmentApps: terms(next.entertainmentApps), gameApps: terms(next.gameApps) }; writeJsonAtomic(this.settingsFile, normalized); return normalized; }
  session() { const value = readJson(this.sessionFile, null); return value && typeof value.id === 'string' ? value : null; }
  snapshot(now = Date.now()) { const session = this.session(); if (!session) return { settings: this.settings(), session: null }; const remainingSeconds = session.status === 'running' ? Math.max(0, Math.ceil((Number(session.endsAt) - now) / 1000)) : 0; return { settings: this.settings(), session: { ...session, remainingSeconds } }; }
  start(now = Date.now()) { const current = this.session(); if (current?.status === 'running') throw new Error('已有专注计时正在进行'); if (current?.pendingReward) throw new Error('请先连接 Super Productivity 完成上一轮奖励结算'); const durationMinutes = this.settings().durationMinutes; const session = { id: crypto.randomUUID(), status: 'running', startedAt: now, endsAt: now + durationMinutes * 60_000, durationMinutes, pendingReward: false }; writeJsonAtomic(this.sessionFile, session); return this.snapshot(now).session; }
  cancel() { const session = this.session(); if (!session || session.status !== 'running') return false; writeJsonAtomic(this.sessionFile, { ...session, status: 'cancelled', pendingReward: false }); return true; }
  tick(now = Date.now()) { const session = this.session(); if (!session || session.status !== 'running' || now < session.endsAt) return null; const completed = { ...session, status: 'completed', completedAt: now, pendingReward: true }; writeJsonAtomic(this.sessionFile, completed); return completed; }
  pendingReward() { const session = this.session(); return session?.status === 'completed' && session.pendingReward ? session : null; }
  acknowledge(sessionId) { const session = this.session(); if (!session || session.id !== sessionId || !session.pendingReward) return false; writeJsonAtomic(this.sessionFile, { ...session, pendingReward: false, rewardedAt: Date.now() }); return true; }
  classify(windowInfo) { const haystack = `${windowInfo?.process || ''} ${windowInfo?.title || ''}`.toLowerCase(), settings = this.settings(); const matches = (values) => values.some((value) => haystack.includes(value)); if (matches(settings.gameApps)) return 'game'; if (matches(settings.entertainmentApps)) return 'entertainment'; if (matches(settings.workApps)) return 'work'; return 'other'; }
}

module.exports = { FocusTimer, DEFAULT_FOCUS_SETTINGS };
