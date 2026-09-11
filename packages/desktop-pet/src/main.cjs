const { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, dialog } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const appData = process.env.APPDATA || os.homedir();
const DATA_DIRECTORY = process.env.SPPET_DATA_DIR || process.env.SP_GAMIFICATION_DATA_DIR || path.join(appData, 'SPPet');
const LEGACY_DIRECTORY = path.join(appData, 'sp-gamification');
const STATE_FILE = path.join(DATA_DIRECTORY, 'state.json');
const EVENTS_FILE = path.join(DATA_DIRECTORY, 'events.json');
const CURSOR_FILE = path.join(DATA_DIRECTORY, 'pet-cursor.json');
const PET_SETTINGS_FILE = path.join(DATA_DIRECTORY, 'pet-settings.json');
const PET_PROFILE_FILE = path.join(DATA_DIRECTORY, 'pet-profile.json');
const BRIDGE_PORT = 47821;

let windowRef, tray, watcher, readTimer, bridgeServer;
let bridgeConnected = false, bridgeLastSync = null, lastEventId = null, initialized = false;

const readJson = (file, fallback) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } };
const writeJsonAtomic = (file, value) => { const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temp, file); };
const updatePetSettings = (changes) => { const next = { ...readJson(PET_SETTINGS_FILE, {}), ...changes, updatedAt: new Date().toISOString() }; writeJsonAtomic(PET_SETTINGS_FILE, next); return next; };
const migrateLegacyData = () => { if (process.env.SPPET_DATA_DIR || process.env.SP_GAMIFICATION_DATA_DIR || !fs.existsSync(LEGACY_DIRECTORY)) return; for (const name of ['state.json', 'events.json', 'pet-cursor.json', 'pet-settings.json']) { const from = path.join(LEGACY_DIRECTORY, name), to = path.join(DATA_DIRECTORY, name); if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to); } };
const readSnapshot = () => { const state = readJson(STATE_FILE, null); const document = readJson(EVENTS_FILE, { events: [] }); return { state, events: Array.isArray(document.events) ? document.events : [] }; };

const loadSkin = (jsonPath) => {
  if (!jsonPath || !fs.existsSync(jsonPath)) return null; const meta = readJson(jsonPath, null);
  if (!meta || typeof meta.id !== 'string' || typeof meta.displayName !== 'string' || typeof meta.spritesheetPath !== 'string') throw new Error('皮肤配置缺少 id、displayName 或 spritesheetPath');
  const imagePath = path.resolve(path.dirname(jsonPath), meta.spritesheetPath); const stat = fs.statSync(imagePath); if (!stat.isFile() || stat.size > 15 * 1024 * 1024) throw new Error('皮肤图片不存在或超过 15MB');
  const extension = path.extname(imagePath).toLowerCase(); const mime = extension === '.webp' ? 'image/webp' : extension === '.png' ? 'image/png' : extension === '.gif' ? 'image/gif' : null; if (!mime) throw new Error('仅支持 PNG、WebP 或 GIF 皮肤');
  return { meta: { id: meta.id, displayName: meta.displayName, description: String(meta.description || ''), spriteVersionNumber: Number(meta.spriteVersionNumber || 1) }, imageDataUrl: `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`, jsonPath };
};
const currentSkin = () => { try { return loadSkin(readJson(PET_SETTINGS_FILE, {}).skinJsonPath); } catch { return null; } };

const publishSnapshot = () => {
  if (!windowRef || windowRef.isDestroyed() || windowRef.webContents.isLoading()) return; const { state, events } = readSnapshot();
  if (!initialized) { const cursor = readJson(CURSOR_FILE, { lastEventId: null }); lastEventId = typeof cursor.lastEventId === 'string' ? cursor.lastEventId : events.at(-1)?.id ?? null; initialized = true; }
  let cursorIndex = lastEventId ? events.findIndex((entry) => entry.id === lastEventId) : -1; if (lastEventId && cursorIndex < 0) cursorIndex = events.length - 1; const unseen = cursorIndex >= 0 ? events.slice(cursorIndex + 1) : lastEventId ? [] : events;
  if (unseen.length) { lastEventId = unseen.at(-1).id; writeJsonAtomic(CURSOR_FILE, { lastEventId, updatedAt: new Date().toISOString() }); }
  windowRef.webContents.send('sppet-snapshot', { state, events: unseen, dataDirectory: DATA_DIRECTORY, bridge: { connected: bridgeConnected, port: BRIDGE_PORT, lastSync: bridgeLastSync }, skin: currentSkin(), petSettings: readJson(PET_SETTINGS_FILE, { size: 1, alwaysOnTop: true }), petProfile: readJson(PET_PROFILE_FILE, { idleLines: [], clickLines: [] }) });
};
const scheduleRead = () => { clearTimeout(readTimer); readTimer = setTimeout(publishSnapshot, 90); };

const mergeSync = (message) => {
  if (!message?.state || !Array.isArray(message.events)) return []; const stored = readJson(EVENTS_FILE, { events: [] }); const byId = new Map((Array.isArray(stored.events) ? stored.events : []).map((entry) => [entry.id, entry])); for (const entry of message.events) if (entry && typeof entry.id === 'string') byId.set(entry.id, entry);
  const events = [...byId.values()].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))).slice(-100); writeJsonAtomic(STATE_FILE, message.state); writeJsonAtomic(EVENTS_FILE, { version: 1, events }); if (message.petSettings && typeof message.petSettings === 'object') writeJsonAtomic(PET_PROFILE_FILE, message.petSettings); bridgeLastSync = new Date().toISOString(); scheduleRead(); return message.events.map((entry) => entry.id).filter(Boolean);
};
const encodeFrame = (value) => { const payload = Buffer.from(value), length = payload.length; if (length < 126) return Buffer.concat([Buffer.from([0x81, length]), payload]); if (length < 65536) { const header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(length, 2); return Buffer.concat([header, payload]); } const header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(length), 2); return Buffer.concat([header, payload]); };
const attachSocket = (socket) => {
  bridgeConnected = true; publishSnapshot(); let buffer = Buffer.alloc(0);
  socket.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); while (buffer.length >= 2) { const first = buffer[0], second = buffer[1], opcode = first & 0x0f, masked = Boolean(second & 0x80); let length = second & 0x7f, offset = 2; if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; } else if (length === 127) { if (buffer.length < 10) return; const big = buffer.readBigUInt64BE(2); if (big > BigInt(Number.MAX_SAFE_INTEGER)) { socket.destroy(); return; } length = Number(big); offset = 10; } const maskBytes = masked ? 4 : 0; if (buffer.length < offset + maskBytes + length) return; const mask = masked ? buffer.subarray(offset, offset + 4) : null; offset += maskBytes; const payload = Buffer.from(buffer.subarray(offset, offset + length)); buffer = buffer.subarray(offset + length); if (mask) for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4]; if (opcode === 8) { socket.end(); return; } if (opcode !== 1) continue; try { const message = JSON.parse(payload.toString('utf8')); if (message.type === 'SYNC') { const eventIds = mergeSync(message); socket.write(encodeFrame(JSON.stringify({ type: 'ACK', eventIds, receivedAt: bridgeLastSync }))); } } catch { /* Invalid frames never modify state. */ } } });
  const disconnected = () => { bridgeConnected = false; publishSnapshot(); }; socket.on('close', disconnected); socket.on('error', disconnected);
};
const startBridgeServer = () => { bridgeServer = http.createServer((request, response) => { if (request.url === '/health') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ ok: true, connected: bridgeConnected })); return; } response.writeHead(404); response.end(); }); bridgeServer.on('upgrade', (request, socket) => { const key = request.headers['sec-websocket-key'], remote = request.socket.remoteAddress; if (!key || (remote && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote))) { socket.destroy(); return; } const accept = crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64'); socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`); attachSocket(socket); }); bridgeServer.on('error', (error) => { if (error.code === 'EADDRINUSE') dialog.showErrorBox('SPPet 连接端口被占用', `本地端口 ${BRIDGE_PORT} 已被占用，请退出旧桌宠。`); }); bridgeServer.listen(BRIDGE_PORT, '127.0.0.1'); };

const createTrayIcon = () => { const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path d="M4 5h24v20l-6 6H4z" fill="#142431"/><path d="M8 9h16v12H8z" fill="#f7fbfd"/><path d="M19 9h5v5z" fill="#77e4ff"/></svg>`; return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`); };
const showWindow = () => { if (!windowRef) return; windowRef.show(); windowRef.focus(); publishSnapshot(); };
const resizeForSettings = (open) => { if (!windowRef) return; const bounds = windowRef.getBounds(); const width = open ? 340 : 250, height = open ? 460 : 300; windowRef.setBounds({ x: bounds.x, y: bounds.y + bounds.height - height, width, height }, true); };
const createWindow = () => { const prefs = readJson(PET_SETTINGS_FILE, { alwaysOnTop: true }); windowRef = new BrowserWindow({ width: 250, height: 300, transparent: true, frame: false, resizable: false, alwaysOnTop: prefs.alwaysOnTop !== false, skipTaskbar: true, show: false, hasShadow: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false } }); windowRef.loadFile(path.join(__dirname, 'index.html')); windowRef.once('ready-to-show', showWindow); };
const createTray = () => { tray = new Tray(createTrayIcon()); tray.setToolTip('SPPet'); tray.setContextMenu(Menu.buildFromTemplate([{ label: '显示 SPPet', click: showWindow }, { label: '桌宠设置', click: () => { showWindow(); resizeForSettings(true); windowRef?.webContents.send('open-pet-settings'); } }, { type: 'separator' }, { label: '退出', click: () => app.quit() }])); tray.on('double-click', showWindow); };

if (!app.requestSingleInstanceLock()) app.quit(); else { app.on('second-instance', showWindow); app.whenReady().then(() => { fs.mkdirSync(DATA_DIRECTORY, { recursive: true }); migrateLegacyData(); createWindow(); createTray(); startBridgeServer(); watcher = fs.watch(DATA_DIRECTORY, (_event, filename) => { if (['state.json','events.json','pet-settings.json','pet-profile.json'].includes(String(filename))) scheduleRead(); }); }); }
ipcMain.on('pet-hide', () => windowRef?.hide()); ipcMain.on('pet-close', () => app.quit()); ipcMain.on('pet-settings-open', (_event, open) => resizeForSettings(Boolean(open)));
ipcMain.handle('pet-select-skin', async () => { const result = await dialog.showOpenDialog(windowRef, { title: '选择桌宠 pet.json', properties: ['openFile'], filters: [{ name: 'Pet skin', extensions: ['json'] }] }); if (result.canceled || !result.filePaths[0]) return null; const skin = loadSkin(result.filePaths[0]); updatePetSettings({ skinJsonPath: result.filePaths[0] }); publishSnapshot(); return skin; });
ipcMain.handle('pet-clear-skin', async () => { updatePetSettings({ skinJsonPath: null }); publishSnapshot(); return true; });
ipcMain.handle('pet-set-top', async (_event, enabled) => { windowRef?.setAlwaysOnTop(Boolean(enabled)); updatePetSettings({ alwaysOnTop: Boolean(enabled) }); return Boolean(enabled); });
ipcMain.handle('pet-set-size', async (_event, size) => { const safe = Math.min(1.6, Math.max(.65, Number(size) || 1)); updatePetSettings({ size: safe }); publishSnapshot(); return safe; });
app.on('before-quit', () => { watcher?.close(); bridgeServer?.close(); clearTimeout(readTimer); }); app.on('window-all-closed', () => {});
