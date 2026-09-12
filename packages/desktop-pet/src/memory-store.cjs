const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const VECTOR_SIZE = 64;
const embed = (value) => {
  const vector = Array(VECTOR_SIZE).fill(0), normalized = String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  for (let index = 0; index < normalized.length; index += 1) { const token = normalized.slice(index, index + 2); let hash = 2166136261; for (const char of token) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); } vector[Math.abs(hash) % VECTOR_SIZE] += 1; }
  const magnitude = Math.sqrt(vector.reduce((sum, entry) => sum + entry * entry, 0)) || 1;
  return vector.map((entry) => entry / magnitude);
};
const similarity = (a, b) => a.reduce((sum, entry, index) => sum + entry * (b[index] || 0), 0);

class MemoryStore {
  constructor(dataDirectory) {
    fs.mkdirSync(dataDirectory, { recursive: true });
    this.database = new DatabaseSync(path.join(dataDirectory, 'memories.db'));
    this.database.exec(`PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, source_history_id TEXT UNIQUE, created_at TEXT NOT NULL, summary TEXT NOT NULL, content TEXT NOT NULL, embedding TEXT NOT NULL);`);
  }
  list(limit = 100) { return this.database.prepare('SELECT id, source_history_id AS sourceHistoryId, created_at AS createdAt, summary, content FROM memories ORDER BY created_at DESC LIMIT ?').all(Math.max(1, Math.min(500, Number(limit) || 100))); }
  add(entry) { const content = String(entry.content || '').slice(0, 12000), summary = String(entry.summary || content).slice(0, 240); this.database.prepare('INSERT OR REPLACE INTO memories (id, source_history_id, created_at, summary, content, embedding) VALUES (?, ?, ?, ?, ?, ?)').run(String(entry.id), String(entry.sourceHistoryId), String(entry.createdAt), summary, content, JSON.stringify(embed(content))); return entry; }
  search(query, limit = 3) { const target = embed(query); return this.database.prepare('SELECT id, source_history_id AS sourceHistoryId, created_at AS createdAt, summary, content, embedding FROM memories').all().map((entry) => ({ ...entry, score: similarity(target, JSON.parse(entry.embedding)) })).sort((a, b) => b.score - a.score).slice(0, Math.max(0, Math.min(10, Number(limit) || 3))).map(({ embedding: _embedding, ...entry }) => entry); }
  delete(id) { return this.database.prepare('DELETE FROM memories WHERE id = ?').run(String(id)).changes > 0; }
  deleteByHistoryId(id) { return this.database.prepare('DELETE FROM memories WHERE source_history_id = ?').run(String(id)).changes > 0; }
  clear() { this.database.exec('DELETE FROM memories'); }
  close() { this.database.close(); }
}

module.exports = { MemoryStore, embed };
