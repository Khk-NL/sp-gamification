const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { MemoryStore } = require('./memory-store.cjs');

const DEFAULT_AI_SETTINGS = {
  enabled: false,
  endpoint: 'https://api.openai.com/v1/chat/completions',
  model: '',
  personality: '温和、可靠，愿意陪伴用户完成学习计划。',
  speakingStyle: '使用简短、自然的中文，不说教。',
  worldview: '你是生活在 SPPet 世界中的学习伙伴。',
  relationship: '互相信任的学习伙伴。',
  longTermMemoryEnabled: false,
};
const DEFAULT_PROFILE = { nickname: '', birthday: '', petName: 'SPPet', userCallPet: '伙伴', petCallUser: '御主', relationship: '学习伙伴', customFields: {} };

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temp, file); };
const text = (value, fallback = '', max = 2000) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;

class AiService {
  constructor(dataDirectory, request = globalThis.fetch) {
    this.settingsFile = path.join(dataDirectory, 'ai-settings.json');
    this.profileFile = path.join(dataDirectory, 'profile.json');
    this.historyFile = path.join(dataDirectory, 'chat-history.json');
    this.memoryStore = new MemoryStore(dataDirectory);
    this.request = request;
    this.shortContext = [];
    this.sessionApiKey = process.env.SPPET_AI_API_KEY || '';
    fs.mkdirSync(dataDirectory, { recursive: true });
  }

  settings() { const value = readJson(this.settingsFile, {}); return { ...DEFAULT_AI_SETTINGS, ...value, enabled: value.enabled === true, longTermMemoryEnabled: value.longTermMemoryEnabled === true, endpoint: text(value.endpoint, DEFAULT_AI_SETTINGS.endpoint, 500), model: text(value.model, '', 100), personality: text(value.personality, DEFAULT_AI_SETTINGS.personality), speakingStyle: text(value.speakingStyle, DEFAULT_AI_SETTINGS.speakingStyle), worldview: text(value.worldview, DEFAULT_AI_SETTINGS.worldview), relationship: text(value.relationship, DEFAULT_AI_SETTINGS.relationship) }; }
  profile() { const value = readJson(this.profileFile, {}); return { ...DEFAULT_PROFILE, ...value, nickname: text(value.nickname, '', 80), birthday: text(value.birthday, '', 20), petName: text(value.petName, DEFAULT_PROFILE.petName, 80), userCallPet: text(value.userCallPet, DEFAULT_PROFILE.userCallPet, 80), petCallUser: text(value.petCallUser, DEFAULT_PROFILE.petCallUser, 80), relationship: text(value.relationship, DEFAULT_PROFILE.relationship, 200), customFields: value.customFields && typeof value.customFields === 'object' && !Array.isArray(value.customFields) ? value.customFields : {} }; }
  history() { const value = readJson(this.historyFile, { version: 1, entries: [] }); return Array.isArray(value.entries) ? value.entries.filter((entry) => entry && typeof entry.id === 'string') : []; }
  snapshot() { return { settings: this.settings(), profile: this.profile(), history: this.history(), memories: this.memoryStore.list(), hasApiKey: Boolean(this.sessionApiKey) }; }

  updateSettings(changes) {
    const before = this.settings(), next = this.settingsFrom({ ...before, ...changes });
    const promptKeys = ['personality', 'speakingStyle', 'worldview', 'relationship'];
    if (promptKeys.some((key) => before[key] !== next[key])) this.shortContext = [];
    writeJsonAtomic(this.settingsFile, next); return next;
  }
  settingsFrom(value) { return { enabled: value.enabled === true, longTermMemoryEnabled: value.longTermMemoryEnabled === true, endpoint: text(value.endpoint, DEFAULT_AI_SETTINGS.endpoint, 500), model: text(value.model, '', 100), personality: text(value.personality, DEFAULT_AI_SETTINGS.personality), speakingStyle: text(value.speakingStyle, DEFAULT_AI_SETTINGS.speakingStyle), worldview: text(value.worldview, DEFAULT_AI_SETTINGS.worldview), relationship: text(value.relationship, DEFAULT_AI_SETTINGS.relationship) }; }
  updateProfile(changes) { const current = this.profile(), customFields = typeof changes.customFields === 'string' ? JSON.parse(changes.customFields || '{}') : changes.customFields; const next = { ...current, ...changes, customFields: customFields && typeof customFields === 'object' && !Array.isArray(customFields) ? customFields : {} }; const normalized = { nickname: text(next.nickname, '', 80), birthday: text(next.birthday, '', 20), petName: text(next.petName, DEFAULT_PROFILE.petName, 80), userCallPet: text(next.userCallPet, DEFAULT_PROFILE.userCallPet, 80), petCallUser: text(next.petCallUser, DEFAULT_PROFILE.petCallUser, 80), relationship: text(next.relationship, DEFAULT_PROFILE.relationship, 200), customFields: next.customFields }; writeJsonAtomic(this.profileFile, normalized); this.shortContext = []; return normalized; }
  setSessionApiKey(value) { this.sessionApiKey = text(value, '', 500); return Boolean(this.sessionApiKey); }

  systemPrompt() {
    const settings = this.settings(), profile = this.profile();
    return [`你是 ${profile.petName}，${settings.worldview}`, `性格：${settings.personality}`, `说话方式：${settings.speakingStyle}`, `你称呼用户为“${profile.petCallUser}”，用户称呼你为“${profile.userCallPet}”。`, `关系：${settings.relationship}；档案关系：${profile.relationship}`, `用户昵称：${profile.nickname || '未填写'}；生日：${profile.birthday || '未填写'}`, `自定义档案：${JSON.stringify(profile.customFields)}`, '尊重隐私，不声称看到了未提供的屏幕、文件或个人数据。'].join('\n');
  }
  validateEndpoint(value) { const url = new URL(value); if (url.protocol === 'https:') return url; if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) return url; throw new Error('AI 接口必须使用 HTTPS，或使用本机 localhost HTTP'); }

  async completion(settings, messages) {
    const endpoint = this.validateEndpoint(settings.endpoint);
    const response = await this.request(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.sessionApiKey}` }, body: JSON.stringify({ model: settings.model, messages }) });
    if (!response.ok) throw new Error(`AI 请求失败：HTTP ${response.status}`);
    const body = await response.json(), answer = text(body?.choices?.[0]?.message?.content, '', 8000);
    if (!answer) throw new Error('AI 返回内容为空');
    return answer;
  }
  record(user, assistant, source = 'chat') { const entry = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), summary: assistant.slice(0, 80), user, assistant, source }; writeJsonAtomic(this.historyFile, { version: 1, entries: [...this.history(), entry].slice(-500) }); if (this.settings().longTermMemoryEnabled) this.memoryStore.add({ id: `memory-${entry.id}`, sourceHistoryId: entry.id, createdAt: entry.timestamp, summary: entry.summary, content: `用户：${user}\n${this.profile().petName}：${assistant}` }); return entry; }

  async chat(userText, source = 'chat') {
    const settings = this.settings(), prompt = text(userText, '', 4000);
    if (!settings.enabled) throw new Error('请先在桌宠设置中启用 AI');
    if (!prompt) throw new Error('消息不能为空');
    if (!settings.model) throw new Error('请填写 AI 模型名称');
    if (!this.sessionApiKey) throw new Error('请填写本次运行使用的 API Key');
    const memories = settings.longTermMemoryEnabled ? this.memoryStore.search(prompt, 3) : [];
    const memoryContext = memories.length ? `\n以下是本地检索到的相关长期记忆，仅在确实相关时参考：\n${memories.map((entry) => `- ${entry.summary}`).join('\n')}` : '';
    const messages = [{ role: 'system', content: `${this.systemPrompt()}${memoryContext}` }, ...this.shortContext.slice(-12), { role: 'user', content: prompt }];
    const answer = await this.completion(settings, messages);
    this.shortContext.push({ role: 'user', content: prompt }, { role: 'assistant', content: answer }); this.shortContext = this.shortContext.slice(-12);
    return this.record(prompt, answer, source);
  }
  async vision(imageDataUrl, userText = '看看我的屏幕，给出简短建议。') {
    const settings = this.settings(), prompt = text(userText, '看看我的屏幕，给出简短建议。', 1000);
    if (!settings.enabled) throw new Error('请先启用 AI');
    if (!settings.model) throw new Error('请填写支持 Vision 的模型名称');
    if (!this.sessionApiKey) throw new Error('请填写本次运行使用的 API Key');
    if (!/^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(imageDataUrl) || imageDataUrl.length > 3_000_000) throw new Error('屏幕截图格式无效或超过 3MB');
    const messages = [{ role: 'system', content: `${this.systemPrompt()}\n用户主动授权了本次屏幕截图分析。只描述当前截图，不推断截图之外的隐私信息。` }, { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] }];
    const answer = await this.completion(settings, messages);
    this.shortContext.push({ role: 'user', content: '[用户主动分享了一次屏幕截图]' }, { role: 'assistant', content: answer }); this.shortContext = this.shortContext.slice(-12);
    return this.record(prompt, answer, 'vision');
  }
  deleteHistory(id) { const before = this.history(), entries = before.filter((entry) => entry.id !== id); if (entries.length === before.length) return false; writeJsonAtomic(this.historyFile, { version: 1, entries }); this.memoryStore.deleteByHistoryId(id); return true; }
  clearHistory() { writeJsonAtomic(this.historyFile, { version: 1, entries: [] }); this.memoryStore.clear(); this.shortContext = []; }
  deleteMemory(id) { return this.memoryStore.delete(id); }
  clearMemories() { this.memoryStore.clear(); }
  close() { this.memoryStore.close(); }
}

module.exports = { AiService, DEFAULT_AI_SETTINGS, DEFAULT_PROFILE };
