const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { SystemAwareness } = require('../src/system-awareness.cjs');

test('window awareness is disabled by default and only reads after authorization', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-awareness-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let calls = 0; const awareness = new SystemAwareness(root, async () => { calls += 1; return { process: 'Code', title: 'Roadmap', capturedAt: '2026-09-12T00:00:00.000Z' }; });
  await assert.rejects(() => awareness.readCurrentWindow(), /明确启用/); assert.equal(calls, 0);
  awareness.updateSettings({ currentWindowEnabled: true }); const value = await awareness.readCurrentWindow();
  assert.equal(value.process, 'Code'); assert.equal(calls, 1); assert.equal(awareness.snapshot().currentWindow.title, 'Roadmap');
  awareness.updateSettings({ currentWindowEnabled: false }); assert.equal(awareness.snapshot().currentWindow, null);
});

test('vision permission is independently disabled by default', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-awareness-settings-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const awareness = new SystemAwareness(root);
  assert.deepEqual(awareness.settings(), { currentWindowEnabled: false, visionEnabled: false });
  assert.deepEqual(awareness.updateSettings({ visionEnabled: true }), { currentWindowEnabled: false, visionEnabled: true });
});
