const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ObservationJournal } = require('../src/observation-journal.cjs');

test('observation journal keeps six structured categories and deduplicates event ids', (context) => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-observation-')); const journal = new ObservationJournal(root), day = '2026-09-12'; context.after(() => { journal.close(); fs.rmSync(root, { recursive: true, force: true }); }); const events = ['FOCUS_TIMER_COMPLETED', 'BATTLE_WON', 'ITEM_USED', 'PET_CONDITION_CHANGED', 'TASK_COMPLETED', 'PET_TOUCHED'].map((type, index) => ({ id: `e${index}`, type, timestamp: `${day}T10:00:00.000Z`, payload: {} })); journal.recordMany(events); journal.recordMany(events); const summary = journal.summary(day); assert.equal(summary.events.length, 6); assert.deepEqual(Object.values(summary.counts), [1, 1, 1, 1, 1, 1]); journal.clear(); assert.equal(journal.summary(day).events.length, 0); });
