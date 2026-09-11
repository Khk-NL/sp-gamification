const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ProductivityHub } = require('../src/productivity-modules.cjs');

test('optional productivity modules are disabled by default and validate records', (context) => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-productivity-')); context.after(() => fs.rmSync(root, { recursive: true, force: true })); const hub = new ProductivityHub(root); const value = hub.snapshot(); assert.equal(value.courseSchedule.enabled, false); assert.equal(value.journal.aiReadEnabled, false); const result = hub.replace('goals', { enabled: true, entries: [{ id: 'g1', title: '复习', stage: '第一轮', progress: 120, deadline: '2026-12-01' }] }); assert.equal(result.module.entries[0].progress, 100); assert.equal(result.events[0].type, 'GOAL_PROGRESS_UPDATED'); });

test('course and important date reminders fire once per reminder key', (context) => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-reminders-')); context.after(() => fs.rmSync(root, { recursive: true, force: true })); const hub = new ProductivityHub(root), now = new Date('2026-09-12T08:00:00'); hub.replace('courseSchedule', { enabled: true, entries: [{ id: 'c1', title: '数学', startAt: '2026-09-12T08:10:00', reminderMinutes: 10 }] }); hub.replace('importantDates', { enabled: true, entries: [{ id: 'd1', title: '考试', type: 'exam', date: '2026-09-13' }] }); const events = hub.tick(now); assert.deepEqual(events.map((entry) => entry.type).sort(), ['COURSE_STARTING', 'IMPORTANT_DATE_APPROACHING']); assert.equal(hub.tick(now).length, 0); });

test('journal AI access requires both module and explicit permission', (context) => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-journal-')); context.after(() => fs.rmSync(root, { recursive: true, force: true })); const hub = new ProductivityHub(root), now = new Date('2026-09-12T08:00:00Z'); hub.replace('journal', { enabled: true, aiReadEnabled: false, entries: [{ id: 'j1', date: '2026-09-12', text: '今天完成了复习。' }] }); assert.throws(() => hub.todayJournal(now), /AI 读取权限/); hub.replace('journal', { enabled: true, aiReadEnabled: true, entries: [{ id: 'j1', date: '2026-09-12', text: '今天完成了复习。' }] }); assert.equal(hub.todayJournal(now).id, 'j1'); });
