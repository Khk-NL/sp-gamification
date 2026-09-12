const fs = require('node:fs');
const path = require('node:path');

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temp, file); };
const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));
const affinityStage = (points) => points >= 300 ? 'best_friend' : points >= 180 ? 'trusted' : points >= 90 ? 'close' : points >= 30 ? 'familiar' : 'stranger';
const freshProfile = (id) => ({ id, condition: 100, affinity: { points: 0, stage: 'stranger' }, mood: 'Normal', moodUntil: null, lastInteractionAt: null });

class CharacterRoster {
  constructor(dataDirectory) { this.file = path.join(dataDirectory, 'character-roster.json'); fs.mkdirSync(dataDirectory, { recursive: true }); }
  document() { const value = readJson(this.file, {}); return { version: 1, activeId: typeof value.activeId === 'string' ? value.activeId : 'default_pet', baseline: value.baseline && typeof value.baseline === 'object' ? value.baseline : null, profiles: value.profiles && typeof value.profiles === 'object' ? value.profiles : {} }; }
  save(value) { writeJsonAtomic(this.file, value); }
  ensure(document, id) { if (!document.profiles[id]) document.profiles[id] = freshProfile(id); return document.profiles[id]; }
  syncFromGame(state, systemLoad = 0) { const document = this.document(), profile = this.ensure(document, document.activeId), current = { condition: clamp(state?.pet?.condition ?? 100, 0, 100), affinity: clamp(state?.pet?.affinity?.points ?? 0, 0, 500) }; if (document.baseline) { profile.condition = clamp(profile.condition + current.condition - clamp(document.baseline.condition, 0, 100), 0, 100); profile.affinity.points = clamp(profile.affinity.points + current.affinity - clamp(document.baseline.affinity, 0, 500), 0, 500); profile.affinity.stage = affinityStage(profile.affinity.points); } document.baseline = current; this.evaluateMood(profile, systemLoad); this.save(document); return profile; }
  select(id, state) { this.syncFromGame(state); const document = this.document(); document.activeId = String(id || 'default_pet'); document.baseline = { condition: clamp(state?.pet?.condition ?? 100, 0, 100), affinity: clamp(state?.pet?.affinity?.points ?? 0, 0, 500) }; const profile = this.ensure(document, document.activeId); this.save(document); return profile; }
  recordEvents(events) { const document = this.document(), profile = this.ensure(document, document.activeId), now = Date.now(); for (const entry of Array.isArray(events) ? events : []) { if (entry.type === 'PET_TOUCHED') { profile.lastInteractionAt = entry.timestamp || new Date().toISOString(); profile.mood = 'Happy'; profile.moodUntil = new Date(now + 10 * 60_000).toISOString(); } else if (entry.type === 'BATTLE_WON') { profile.mood = 'Excited'; profile.moodUntil = new Date(now + 15 * 60_000).toISOString(); } else if (entry.type === 'BATTLE_LOST') { profile.mood = 'Sad'; profile.moodUntil = new Date(now + 10 * 60_000).toISOString(); } } this.evaluateMood(profile); this.save(document); return profile; }
  evaluateMood(profile, systemLoad = 0) { if (profile.moodUntil && Date.parse(profile.moodUntil) > Date.now()) return profile.mood; profile.moodUntil = null; profile.mood = profile.condition <= 25 || systemLoad >= 90 ? 'Tired' : profile.condition <= 50 ? 'Sad' : 'Normal'; return profile.mood; }
  snapshot() { const document = this.document(), profile = this.ensure(document, document.activeId); this.evaluateMood(profile); this.save(document); return { activeId: document.activeId, profile, profiles: Object.values(document.profiles) }; }
}

module.exports = { CharacterRoster };
