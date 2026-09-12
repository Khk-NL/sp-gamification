const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = ['focus', 'battle', 'feeding', 'mood', 'task', 'interaction'];
const localDay = (value = new Date()) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const category = (type) => { const value = String(type || '').toUpperCase(); if (value.includes('FOCUS')) return 'focus'; if (value.includes('BATTLE')) return 'battle'; if (value.includes('ITEM_USED') || value.includes('FEED')) return 'feeding'; if (value.includes('MOOD') || value.includes('CONDITION')) return 'mood'; if (value.includes('TASK') || value.includes('COMMISSION')) return 'task'; if (value.includes('TOUCH') || value.includes('INTERACTION')) return 'interaction'; return null; };

class ObservationJournal {
  constructor(dataDirectory) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    this.database = new DatabaseSync(path.join(dataDirectory, 'memories.db'));
    this.database.exec(`PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, occurred_at TEXT NOT NULL, day TEXT NOT NULL, category TEXT NOT NULL, event_type TEXT NOT NULL, payload TEXT NOT NULL);`);
  }
  record(event) { const type = category(event?.type); if (!type) return false; const sourceDate = new Date(event.timestamp || event.occurredAt || Date.now()), occurredAt = sourceDate.toISOString(), id = String(event.id || crypto.randomUUID()); this.database.prepare('INSERT OR IGNORE INTO observations (id, occurred_at, day, category, event_type, payload) VALUES (?, ?, ?, ?, ?, ?)').run(id, occurredAt, localDay(sourceDate), type, String(event.type), JSON.stringify(event.payload || {})); this.database.prepare("DELETE FROM observations WHERE day < date('now', '-30 day')").run(); return true; }
  recordMany(events) { return (Array.isArray(events) ? events : []).reduce((count, entry) => count + Number(this.record(entry)), 0); }
  today(day = localDay()) { return this.database.prepare('SELECT id, occurred_at AS occurredAt, category, event_type AS eventType, payload FROM observations WHERE day = ? ORDER BY occurred_at').all(day).map((entry) => ({ ...entry, payload: JSON.parse(entry.payload) })); }
  summary(day = localDay()) { const events = this.today(day), counts = Object.fromEntries(TYPES.map((type) => [type, events.filter((entry) => entry.category === type).length])); return { day, counts, events }; }
  clear() { this.database.exec('DELETE FROM observations'); }
  close() { this.database.close(); }
}

module.exports = { ObservationJournal, OBSERVATION_TYPES: TYPES };
