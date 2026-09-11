const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { FocusTimer } = require('../src/focus-timer.cjs');

test('focus timer completes once and keeps reward pending until acknowledged', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-focus-')); context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const timer = new FocusTimer(root); timer.updateSettings({ durationMinutes: 5 }); const session = timer.start(1_000);
  assert.equal(timer.tick(300_999), null); assert.equal(timer.tick(301_000).id, session.id); assert.equal(timer.tick(302_000), null); assert.equal(timer.pendingReward().id, session.id);
  assert.equal(timer.acknowledge(session.id), true); assert.equal(timer.pendingReward(), null);
});

test('window categories only use user-provided rules', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-focus-rules-')); context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const timer = new FocusTimer(root); assert.equal(timer.classify({ process: 'game', title: 'video' }), 'other');
  timer.updateSettings({ workApps: 'code\nword', entertainmentApps: 'video', gameApps: 'mygame' });
  assert.equal(timer.classify({ process: 'Code', title: 'project' }), 'work'); assert.equal(timer.classify({ process: 'browser', title: 'Video site' }), 'entertainment'); assert.equal(timer.classify({ process: 'MyGame', title: '' }), 'game');
});
