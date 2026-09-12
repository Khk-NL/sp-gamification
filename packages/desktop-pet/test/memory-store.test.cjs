const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { MemoryStore } = require('../src/memory-store.cjs');

test('local memory can add, retrieve, delete and clear real SQLite rows', (context) => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-memory-')); const store = new MemoryStore(root); context.after(() => { store.close(); fs.rmSync(root, { recursive: true, force: true }); }); store.add({ id: 'm1', sourceHistoryId: 'h1', createdAt: new Date().toISOString(), summary: '数学复习', content: '用户正在复习数学矩阵' }); store.add({ id: 'm2', sourceHistoryId: 'h2', createdAt: new Date().toISOString(), summary: '英语复习', content: '用户正在背英语单词' }); assert.equal(store.search('数学矩阵', 1)[0].id, 'm1'); assert.equal(store.deleteByHistoryId('h1'), true); assert.equal(store.list().length, 1); store.clear(); assert.equal(store.list().length, 0); });
