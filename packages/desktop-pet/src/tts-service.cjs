const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TTS_SETTINGS = { provider: 'disabled', endpoint: 'http://127.0.0.1:9880/tts', model: '', voice: 'default' };
const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temp, file); };
const clean = (value, fallback = '', max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : fallback;

class DisabledTTSProvider { async speak() { throw new Error('TTS 当前已关闭'); } }
class HttpTTSProvider {
  constructor(settings, apiKey, request) { this.settings = settings; this.apiKey = apiKey; this.request = request; }
  async speak(input) { const url = new URL(this.settings.endpoint); if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname))) throw new Error('TTS 接口必须使用 HTTPS，或使用本机 localhost HTTP'); const response = await this.request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) }, body: JSON.stringify({ model: this.settings.model, voice: this.settings.voice, input, response_format: 'mp3' }) }); if (!response.ok) throw new Error(`TTS 请求失败：HTTP ${response.status}`); const mime = response.headers.get('content-type') || 'audio/mpeg', buffer = Buffer.from(await response.arrayBuffer()); if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error('TTS 音频为空或超过 20MB'); return `data:${mime};base64,${buffer.toString('base64')}`; }
}

class TTSService {
  constructor(dataDirectory, request = globalThis.fetch) { this.file = path.join(dataDirectory, 'tts-settings.json'); this.request = request; this.sessionApiKey = process.env.SPPET_TTS_API_KEY || ''; fs.mkdirSync(dataDirectory, { recursive: true }); }
  settings() { const value = readJson(this.file, {}), provider = ['disabled', 'local', 'remote'].includes(value.provider) ? value.provider : 'disabled'; return { provider, endpoint: clean(value.endpoint, DEFAULT_TTS_SETTINGS.endpoint), model: clean(value.model, '', 100), voice: clean(value.voice, 'default', 100) }; }
  updateSettings(changes) { const current = this.settings(), next = { ...current, ...changes }; next.provider = ['disabled', 'local', 'remote'].includes(next.provider) ? next.provider : 'disabled'; next.endpoint = clean(next.endpoint, DEFAULT_TTS_SETTINGS.endpoint); next.model = clean(next.model, '', 100); next.voice = clean(next.voice, 'default', 100); writeJsonAtomic(this.file, next); return next; }
  setSessionApiKey(value) { this.sessionApiKey = clean(value, '', 500); return Boolean(this.sessionApiKey); }
  snapshot() { return { settings: this.settings(), hasApiKey: Boolean(this.sessionApiKey) }; }
  provider() { const settings = this.settings(); return settings.provider === 'disabled' ? new DisabledTTSProvider() : new HttpTTSProvider(settings, settings.provider === 'remote' ? this.sessionApiKey : '', this.request); }
  async speak(value) { const input = clean(value, '', 4000); if (!input) throw new Error('没有可朗读的文字'); return this.provider().speak(input); }
}

module.exports = { TTSService, DisabledTTSProvider, HttpTTSProvider, DEFAULT_TTS_SETTINGS };
