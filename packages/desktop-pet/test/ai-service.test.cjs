const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { AiService } = require('../src/ai-service.cjs');

test('profile and prompt settings persist without storing the session API key', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-ai-profile-'));
  const service = new AiService(root, async () => { throw new Error('not called'); });
  context.after(() => { service.close(); fs.rmSync(root, { recursive: true, force: true }); });
  service.updateProfile({ nickname: '小明', petName: '小猫', userCallPet: '猫猫', petCallUser: '同学', customFields: '{"goal":"复习"}' });
  service.updateSettings({ personality: '认真', speakingStyle: '简短' }); service.setSessionApiKey('secret-value');
  assert.match(service.systemPrompt(), /小猫/); assert.match(service.systemPrompt(), /认真/); assert.equal(service.profile().customFields.goal, '复习');
  assert.equal(fs.readFileSync(path.join(root, 'ai-settings.json'), 'utf8').includes('secret-value'), false);
});

test('chat uses short context, prompt edits reset it, and deletion changes the stored history', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-ai-chat-'));
  const requests = [];
  const service = new AiService(root, async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ choices: [{ message: { content: `回答${requests.length}` } }] }) }; });
  context.after(() => { service.close(); fs.rmSync(root, { recursive: true, force: true }); });
  service.updateSettings({ enabled: true, endpoint: 'http://127.0.0.1:11434/v1/chat/completions', model: 'test-model' }); service.setSessionApiKey('session-only');
  const first = await service.chat('第一问'); await service.chat('第二问');
  assert.equal(requests[1].messages.length, 4);
  service.updateSettings({ personality: '新的性格' }); await service.chat('第三问');
  assert.equal(requests[2].messages.length, 2);
  assert.equal(service.history().length, 3); assert.equal(service.deleteHistory(first.id), true); assert.equal(service.history().length, 2);
  service.clearHistory(); assert.equal(service.history().length, 0);
});

test('remote plain HTTP endpoints are rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-ai-url-'));
  const service = new AiService(root); try { assert.throws(() => service.validateEndpoint('http://example.com/v1/chat/completions'), /HTTPS/); } finally { service.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('vision only stores the text result and not the screenshot', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-ai-vision-'));
  let requestBody;
  const service = new AiService(root, async (_url, options) => { requestBody = JSON.parse(options.body); return { ok: true, json: async () => ({ choices: [{ message: { content: '请回到复习窗口。' } }] }) }; });
  context.after(() => { service.close(); fs.rmSync(root, { recursive: true, force: true }); });
  service.updateSettings({ enabled: true, endpoint: 'https://example.com/v1/chat/completions', model: 'vision-model' }); service.setSessionApiKey('session-only');
  await service.vision('data:image/jpeg;base64,YQ==');
  assert.equal(requestBody.messages[1].content[1].type, 'image_url');
  assert.equal(fs.readFileSync(path.join(root, 'chat-history.json'), 'utf8').includes('data:image'), false);
});

test('long-term memory is opt-in, injected locally, and deleted with its history source', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-ai-memory-')), requests = [];
  const service = new AiService(root, async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ choices: [{ message: { content: requests.length === 1 ? '记住你在复习矩阵。' : '继续做矩阵练习。' } }] }) }; });
  context.after(() => { service.close(); fs.rmSync(root, { recursive: true, force: true }); });
  service.updateSettings({ enabled: true, longTermMemoryEnabled: true, endpoint: 'http://127.0.0.1:11434/v1/chat/completions', model: 'test-model' }); service.setSessionApiKey('session-only');
  const first = await service.chat('我在复习数学矩阵'); service.shortContext = []; await service.chat('矩阵怎么继续？');
  assert.equal(service.snapshot().memories.length, 2); assert.match(requests[1].messages[0].content, /相关长期记忆/);
  service.deleteHistory(first.id); assert.equal(service.snapshot().memories.some((entry) => entry.sourceHistoryId === first.id), false);
  service.updateSettings({ longTermMemoryEnabled: false }); assert.equal(service.snapshot().memories.length, 1);
});
