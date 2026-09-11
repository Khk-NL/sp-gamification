const fs = require('node:fs');
const path = require('node:path');

const IMAGE_MIME = { '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.apng': 'image/apng' };
const AUDIO_MIME = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
const REQUIRED_STATES = ['idle', 'walk', 'sleep', 'happy', 'sad', 'angry', 'tired', 'eat', 'touch', 'drag', 'fall', 'edge', 'battle', 'victory', 'defeat', 'talk'];
const MAX_RESOURCE_BYTES = 15 * 1024 * 1024;

class AssetManager {
  constructor(builtInRoot, customRoot) { this.builtInRoot = builtInRoot; this.customRoot = customRoot; this.cache = new Map(); fs.mkdirSync(customRoot, { recursive: true }); }

  readManifest(directory) {
    const file = path.join(directory, 'manifest.json');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || value.manifestVersion !== 1 || typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(value.id) || typeof value.name !== 'string' || !['emoji', 'sprite'].includes(value.type) || !value.states || typeof value.states.idle !== 'string') throw new Error('角色 manifest 缺少有效的 manifestVersion、id、name、type 或 idle 状态');
    const animations = {};
    for (const [state, animation] of Object.entries(value.animations || {})) {
      if (!REQUIRED_STATES.includes(state) || animation?.type !== 'frames' || !Array.isArray(animation.frames) || !animation.frames.length || animation.frames.some((frame) => typeof frame !== 'string')) throw new Error(`角色动画 ${state} 配置无效`);
      animations[state] = { type: 'frames', frames: animation.frames, fps: Math.min(30, Math.max(1, Number(animation.fps) || 8)), loop: animation.loop !== false };
    }
    return { ...value, states: Object.fromEntries(REQUIRED_STATES.map((state) => [state, typeof value.states[state] === 'string' ? value.states[state] : value.states.idle])), animations, outfits: Array.isArray(value.outfits) ? value.outfits : [], accessories: Array.isArray(value.accessories) ? value.accessories : [], effects: value.effects && typeof value.effects === 'object' ? value.effects : {}, sounds: value.sounds && typeof value.sounds === 'object' ? value.sounds : {} };
  }

  directories() { const scan = (root, custom) => fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => ({ directory: path.join(root, entry.name), custom })) : []; return [...scan(this.builtInRoot, false), ...scan(this.customRoot, true)]; }
  list() { return this.directories().flatMap(({ directory, custom }) => { try { const manifest = this.readManifest(directory); return [{ id: manifest.id, name: manifest.name, author: String(manifest.author || ''), version: String(manifest.version || '1.0.0'), type: manifest.type, custom }]; } catch { return []; } }); }
  find(id) { return this.directories().find(({ directory }) => { try { return this.readManifest(directory).id === id; } catch { return false; } }); }
  resource(directory, value, type) {
    if (type === 'emoji') return { kind: 'emoji', value };
    const file = path.resolve(directory, value), root = `${path.resolve(directory)}${path.sep}`;
    if (!file.startsWith(root) || !fs.statSync(file).isFile() || fs.statSync(file).size > MAX_RESOURCE_BYTES) throw new Error('角色资源路径无效或超过 15MB');
    const mime = IMAGE_MIME[path.extname(file).toLowerCase()];
    if (!mime) throw new Error('角色图片仅支持 PNG、WebP、GIF 或 APNG');
    return { kind: 'image', value: `data:${mime};base64,${fs.readFileSync(file).toString('base64')}` };
  }
  sound(directory, value) {
    const file = path.resolve(directory, value), root = `${path.resolve(directory)}${path.sep}`;
    if (!file.startsWith(root) || !fs.statSync(file).isFile() || fs.statSync(file).size > MAX_RESOURCE_BYTES) throw new Error('角色音效路径无效或超过 15MB');
    const mime = AUDIO_MIME[path.extname(file).toLowerCase()];
    if (!mime) throw new Error('角色音效仅支持 MP3、Ogg 或 WAV');
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
  }
  load(id) {
    const key = id || 'default_pet';
    if (this.cache.has(key)) return this.cache.get(key);
    const found = this.find(key) || this.find('default_pet');
    if (!found) return null;
    const manifest = this.readManifest(found.directory);
    const idle = this.resource(found.directory, manifest.states.idle, manifest.type);
    const states = Object.fromEntries(Object.entries(manifest.states).map(([state, value]) => { try { return [state, this.resource(found.directory, value, manifest.type)]; } catch { return [state, idle]; } }));
    const animations = {};
    for (const [state, animation] of Object.entries(manifest.animations)) {
      try { animations[state] = { ...animation, frames: animation.frames.map((value) => this.resource(found.directory, value, 'sprite')) }; } catch { /* A broken optional animation falls back to the static state. */ }
    }
    const sounds = Object.fromEntries(Object.entries(manifest.sounds).flatMap(([state, value]) => { try { return typeof value === 'string' ? [[state, this.sound(found.directory, value)]] : []; } catch { return []; } }));
    const result = { manifest, states, animations, sounds, layers: { outfits: manifest.outfits, accessories: manifest.accessories, effects: manifest.effects }, custom: found.custom };
    this.cache.set(key, result);
    return result;
  }
  importFolder(source) {
    const manifest = this.readManifest(source);
    this.resource(source, manifest.states.idle, manifest.type);
    for (const animation of Object.values(manifest.animations)) for (const frame of animation.frames) this.resource(source, frame, 'sprite');
    for (const value of Object.values(manifest.sounds)) if (typeof value === 'string') this.sound(source, value);
    const target = path.join(this.customRoot, manifest.id), root = `${path.resolve(this.customRoot)}${path.sep}`;
    if (!path.resolve(target).startsWith(root)) throw new Error('角色 id 不安全');
    if (fs.existsSync(target)) throw new Error('同名角色已存在，请先删除旧版本');
    fs.cpSync(source, target, { recursive: true, errorOnExist: true }); this.cache.clear();
    return this.load(manifest.id);
  }
  remove(id) { const found = this.find(id); if (!found?.custom) throw new Error('只能删除用户导入的角色'); const root = `${path.resolve(this.customRoot)}${path.sep}`, target = path.resolve(found.directory); if (!target.startsWith(root)) throw new Error('角色目录不安全'); fs.rmSync(target, { recursive: true, force: false }); this.cache.clear(); }
  clearCache() { this.cache.clear(); }
}

module.exports = { AssetManager, REQUIRED_STATES };
