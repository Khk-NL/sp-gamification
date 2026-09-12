const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { TTSService } = require('../src/tts-service.cjs');

test('TTS is disabled by default and local provider returns bounded audio without persisting a key', async (context) => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-tts-')); context.after(() => fs.rmSync(root, { recursive: true, force: true })); const requests = []; const service = new TTSService(root, async (url, options) => { requests.push({ url: String(url), options }); return { ok: true, headers: new Map([['content-type', 'audio/mpeg']]), arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer }; }); await assert.rejects(() => service.speak('你好'), /关闭/); service.updateSettings({ provider: 'local', endpoint: 'http://127.0.0.1:9880/tts', model: 'local', voice: 'pet' }); service.setSessionApiKey('not-persisted'); assert.match(await service.speak('你好'), /^data:audio\/mpeg;base64,/); assert.equal(requests.length, 1); assert.equal(fs.readFileSync(path.join(root, 'tts-settings.json'), 'utf8').includes('not-persisted'), false); });
