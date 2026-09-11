import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dataDir = process.env.SPPET_DATA_DIR ? path.resolve(process.env.SPPET_DATA_DIR) : path.join(root, 'data');
const leaderboardFile = path.join(dataDir, 'leaderboard.json');
const contentFile = path.join(dataDir, 'content.json');
const defaultContentFile = path.join(root, 'default-content.json');
const releaseManifestFile = path.join(root, 'release-manifest.json');
const eventsFile = path.join(root, 'online-events.json');
const databaseFile = path.join(dataDir, 'sppet.db');
const port = Number(process.env.PORT || 47822);
const adminKey = process.env.SPPET_ADMIN_KEY || '';
const allowRegistration = process.env.SPPET_ALLOW_REGISTER === '1';
await mkdir(dataDir, { recursive: true });

const database = new DatabaseSync(databaseFile);
database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS device_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    device_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leaderboard_submissions (
    nonce TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    submitted_at INTEGER NOT NULL,
    level INTEGER NOT NULL,
    xp INTEGER NOT NULL,
    streak INTEGER NOT NULL,
    focus_minutes INTEGER NOT NULL,
    commission_score INTEGER NOT NULL,
    battle_score INTEGER NOT NULL
  );
`);

const readJson = async (file, fallback) => { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; } };
const atomicJson = async (file, value) => { const temp = `${file}.${process.pid}.tmp`; await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); await rename(temp, file); };
const sendJson = (response, status, value, extraHeaders = {}) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': 'https://sppet.scsldr.cn', 'access-control-allow-headers': 'authorization,content-type,x-admin-key', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS', 'cache-control': 'no-store', ...extraHeaders }); response.end(JSON.stringify(value)); };
const readBody = (request) => new Promise((resolve, reject) => { let raw = ''; request.setEncoding('utf8'); request.on('data', (chunk) => { raw += chunk; if (raw.length > 1_000_000) reject(new Error('body too large')); }); request.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('invalid json')); } }); request.on('error', reject); });
const number = (value, max) => Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));
const score = (entry) => entry.level * 100000 + entry.totalBattlesWon * 1000 + entry.totalTasksCompleted * 100 + entry.totalFocusMinutes + entry.streak * 50 + entry.xp;
const publicEntry = (entry) => ({ nickname: entry.nickname, level: entry.level, xp: entry.xp, streak: entry.streak, totalTasksCompleted: entry.totalTasksCompleted, totalFocusMinutes: entry.totalFocusMinutes, totalBattlesWon: entry.totalBattlesWon, updatedAt: entry.updatedAt });
const validContent = (value) => value && typeof value === 'object' && Array.isArray(value.skills) && Array.isArray(value.items) && Array.isArray(value.chapters) && value.chapters.length > 0;
const usernameValid = (value) => /^[\p{L}\p{N}_-]{2,20}$/u.test(value);
const passwordValid = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 100;
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const passwordHash = (password, salt) => scryptSync(password, salt, 64).toString('hex');
const cookies = (request) => Object.fromEntries(String(request.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => { const index = part.indexOf('='); return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]; }));
const currentUser = (request) => {
  const token = cookies(request).sppet_session;
  if (!token) return null;
  return database.prepare('SELECT users.id, users.username, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?').get(tokenHash(token), Date.now()) || null;
};
const registrationOpen = () => allowRegistration || database.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0;
const issueSession = (request, response, user, status = 200) => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(tokenHash(token), user.id, expiresAt);
  const secure = String(request.headers['x-forwarded-proto'] || '').toLowerCase() === 'https' ? '; Secure' : '';
  sendJson(response, status, { ok: true, user: { id: user.id, username: user.username, role: user.role } }, { 'set-cookie': `sppet_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure}` });
};
const legacyKeyAuthorized = (request) => {
  if (!adminKey) return false;
  const supplied = String(request.headers['x-admin-key'] || '');
  const expectedBuffer = Buffer.from(adminKey), suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
};
const contentAuthorized = (request) => currentUser(request)?.role === 'admin' || legacyKeyAuthorized(request);
const bearerToken = (request) => { const match = /^Bearer\s+(.+)$/i.exec(String(request.headers.authorization || '')); return match?.[1] || ''; };
const currentDevice = (request) => { const token = bearerToken(request); return token ? database.prepare('SELECT user_id AS userId, device_id AS deviceId, display_name AS displayName FROM device_tokens WHERE token_hash = ?').get(tokenHash(token)) || null : null; };
const registrationAttempts = new Map();
const registrationAllowed = (request) => { const key = String(request.headers['x-real-ip'] || request.socket.remoteAddress || 'unknown'), day = new Date().toISOString().slice(0, 10), previous = registrationAttempts.get(key); const count = previous?.day === day ? previous.count + 1 : 1; registrationAttempts.set(key, { day, count }); return count <= 5; };
const leaderboardScore = (entry) => entry.level * 1000 + entry.focusMinutes + entry.commissionScore * 100 + entry.battleScore * 200 + entry.streak * 10 + entry.xp;
const v1Leaderboard = (period) => { const duration = period === 'daily' ? 86_400_000 : period === 'weekly' ? 7 * 86_400_000 : Number.MAX_SAFE_INTEGER, since = Date.now() - duration; const rows = database.prepare(`SELECT s.user_id AS userId, d.display_name AS displayName, s.level, s.xp, s.streak, s.focus_minutes AS focusMinutes, s.commission_score AS commissionScore, s.battle_score AS battleScore, s.submitted_at AS submittedAt FROM leaderboard_submissions s JOIN device_tokens d ON d.user_id = s.user_id WHERE s.submitted_at >= ? ORDER BY s.submitted_at DESC`).all(since); const latest = new Map(); for (const row of rows) if (!latest.has(row.userId)) latest.set(row.userId, row); return [...latest.values()].sort((a, b) => leaderboardScore(b) - leaderboardScore(a)).slice(0, 100).map((entry, index) => ({ rank: index + 1, ...entry, score: leaderboardScore(entry) })); };

const configuredAdminUser = String(process.env.SPPET_ADMIN_USER || '').trim();
const configuredAdminPassword = String(process.env.SPPET_ADMIN_PASSWORD || '');
if (configuredAdminUser && configuredAdminPassword && usernameValid(configuredAdminUser) && passwordValid(configuredAdminPassword)) {
  const existing = database.prepare('SELECT id FROM users WHERE username = ?').get(configuredAdminUser);
  if (!existing) {
    const salt = randomBytes(16).toString('hex');
    database.prepare('INSERT INTO users (username, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?)').run(configuredAdminUser, passwordHash(configuredAdminPassword, salt), salt, 'admin', new Date().toISOString());
  }
}

const staticFiles = new Map([
  ['/', 'index.html'], ['/index.html', 'index.html'], ['/tools.html', 'tools.html'], ['/developer.html', 'developer.html'], ['/login.html', 'login.html'],
  ['/site.css', 'site.css'], ['/tools.js', 'tools.js'], ['/developer.js', 'developer.js'], ['/login.js', 'login.js'],
]);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    if (request.method === 'OPTIONS') { response.writeHead(204, { 'access-control-allow-origin': 'https://sppet.scsldr.cn', 'access-control-allow-headers': 'authorization,content-type,x-admin-key', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' }); response.end(); return; }
    if (request.method === 'GET' && staticFiles.has(url.pathname)) { const file = staticFiles.get(url.pathname); const type = file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html'; response.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'x-content-type-options': 'nosniff' }); response.end(await readFile(path.join(publicDir, file))); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/status') { sendJson(response, 200, { ok: true, apiVersion: 1, serverTime: new Date().toISOString() }); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/config') { sendJson(response, 200, { leaderboardEnabled: true, catalogEnabled: true, releasesEnabled: true, maxSubmitIntervalSeconds: 60 }); return; }
    if (request.method === 'POST' && url.pathname === '/api/v1/profile/register-device') { if (!registrationAllowed(request)) { sendJson(response, 429, { ok: false, error: 'registration rate limit exceeded' }); return; } const input = await readBody(request), deviceId = String(input.deviceId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80), displayName = String(input.displayName || '').replace(/[<>\r\n]/g, '').trim().slice(0, 20); if (!deviceId || !displayName) { sendJson(response, 400, { ok: false, error: 'deviceId and displayName are required' }); return; } if (database.prepare('SELECT 1 FROM device_tokens WHERE device_id = ?').get(deviceId)) { sendJson(response, 409, { ok: false, error: 'device already registered' }); return; } const token = randomBytes(32).toString('hex'), userId = randomUUID(); database.prepare('INSERT INTO device_tokens (token_hash, user_id, device_id, display_name, created_at) VALUES (?, ?, ?, ?, ?)').run(tokenHash(token), userId, deviceId, displayName, Date.now()); sendJson(response, 201, { userId, token }); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/profile') { const device = currentDevice(request); if (!device) { sendJson(response, 401, { ok: false, error: 'valid bearer token required' }); return; } sendJson(response, 200, device); return; }
    if (request.method === 'PUT' && url.pathname === '/api/v1/profile') { const device = currentDevice(request); if (!device) { sendJson(response, 401, { ok: false, error: 'valid bearer token required' }); return; } const input = await readBody(request), displayName = String(input.displayName || '').replace(/[<>\r\n]/g, '').trim().slice(0, 20); if (!displayName) { sendJson(response, 400, { ok: false, error: 'displayName is required' }); return; } database.prepare('UPDATE device_tokens SET display_name = ? WHERE user_id = ?').run(displayName, device.userId); sendJson(response, 200, { ok: true, userId: device.userId, displayName }); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/leaderboard') { const period = ['daily', 'weekly', 'all'].includes(url.searchParams.get('period')) ? url.searchParams.get('period') : 'all'; sendJson(response, 200, { period, entries: v1Leaderboard(period), generatedAt: new Date().toISOString() }); return; }
    if (request.method === 'POST' && url.pathname === '/api/v1/leaderboard/submit') { const device = currentDevice(request); if (!device) { sendJson(response, 401, { ok: false, error: 'valid bearer token required' }); return; } const input = await readBody(request), nonce = String(input.nonce || ''); if (input.userId !== device.userId || !/^[a-zA-Z0-9_-]{8,100}$/.test(nonce)) { sendJson(response, 400, { ok: false, error: 'userId or nonce is invalid' }); return; } const fields = { level: Number(input.level), xp: Number(input.xp), streak: Number(input.streak), focusMinutes: Number(input.focusMinutes), commissionScore: Number(input.commissionScore), battleScore: Number(input.battleScore) }; if (!Number.isInteger(fields.level) || fields.level < 1 || fields.level > 10000 || !Number.isInteger(fields.xp) || fields.xp < 0 || fields.xp > 1_000_000 || !Number.isInteger(fields.streak) || fields.streak < 0 || fields.streak > 3650 || !Number.isInteger(fields.focusMinutes) || fields.focusMinutes < 0 || fields.focusMinutes > 10_000_000 || !Number.isInteger(fields.commissionScore) || fields.commissionScore < 0 || fields.commissionScore > 4 || !Number.isInteger(fields.battleScore) || fields.battleScore < 0 || fields.battleScore > 1_000_000) { sendJson(response, 400, { ok: false, error: 'leaderboard values are out of range' }); return; } const now = Date.now(), previous = database.prepare('SELECT level, focus_minutes AS focusMinutes, battle_score AS battleScore, submitted_at AS submittedAt FROM leaderboard_submissions WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 1').get(device.userId), elapsedDays = previous ? Math.max(1, Math.ceil((now - previous.submittedAt) / 86_400_000)) : 1; if (previous && (fields.level < previous.level || fields.level - previous.level > 20 * elapsedDays || fields.focusMinutes < previous.focusMinutes || fields.focusMinutes - previous.focusMinutes > 1440 * elapsedDays || fields.battleScore < previous.battleScore || fields.battleScore - previous.battleScore > 100 * elapsedDays)) { sendJson(response, 409, { ok: false, error: 'daily growth limit or monotonicity check failed' }); return; } try { database.prepare('INSERT INTO leaderboard_submissions (nonce, user_id, submitted_at, level, xp, streak, focus_minutes, commission_score, battle_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(nonce, device.userId, now, fields.level, fields.xp, fields.streak, fields.focusMinutes, fields.commissionScore, fields.battleScore); } catch (error) { if (String(error).includes('UNIQUE')) { sendJson(response, 409, { ok: false, error: 'replayed nonce' }); return; } throw error; } sendJson(response, 200, { ok: true, score: leaderboardScore(fields) }); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/store/catalog') { const fallback = await readJson(defaultContentFile, null), gameContent = await readJson(contentFile, fallback); if (!validContent(gameContent)) { sendJson(response, 500, { ok: false, error: 'content unavailable' }); return; } sendJson(response, 200, gameContent); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/items/catalog') { const fallback = await readJson(defaultContentFile, null), gameContent = await readJson(contentFile, fallback); sendJson(response, 200, { version: gameContent?.version || 1, items: gameContent?.items || [] }); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/equipment/catalog') { const fallback = await readJson(defaultContentFile, null), gameContent = await readJson(contentFile, fallback); sendJson(response, 200, { version: gameContent?.version || 1, equipment: (gameContent?.items || []).filter((item) => ['weapon', 'armor', 'accessory'].includes(item.kind)) }); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/skills/catalog') { const fallback = await readJson(defaultContentFile, null), gameContent = await readJson(contentFile, fallback); sendJson(response, 200, { version: gameContent?.version || 1, skills: gameContent?.skills || [] }); return; }
    if (request.method === 'GET' && (url.pathname === '/api/v1/releases/latest' || url.pathname === '/api/v1/releases/manifest')) { const manifest = await readJson(releaseManifestFile, null); if (!manifest || typeof manifest.version !== 'string' || typeof manifest.downloadUrl !== 'string' || typeof manifest.changelog !== 'string' || typeof manifest.sha256 !== 'string' || typeof manifest.minCompatibleVersion !== 'string') { sendJson(response, 500, { ok: false, error: 'release manifest unavailable' }); return; } sendJson(response, 200, manifest); return; }
    if (request.method === 'GET' && url.pathname === '/api/v1/events') { const document = await readJson(eventsFile, { version: 1, events: [] }); sendJson(response, 200, { version: number(document.version, 100000), events: Array.isArray(document.events) ? document.events : [] }); return; }
    if (request.method === 'GET' && url.pathname === '/api/health') { sendJson(response, 200, { ok: true, auth: 'sqlite', registrationOpen: registrationOpen(), contentEditing: Boolean(adminKey) || currentUser(request)?.role === 'admin' }); return; }
    if (request.method === 'GET' && url.pathname === '/api/auth/me') { const user = currentUser(request); sendJson(response, 200, { authenticated: Boolean(user), user, registrationOpen: registrationOpen() }); return; }
    if (request.method === 'POST' && url.pathname === '/api/auth/register') {
      if (!registrationOpen()) { sendJson(response, 403, { ok: false, error: 'registration is closed' }); return; }
      const input = await readBody(request); const username = String(input.username || '').trim(); const password = String(input.password || '');
      if (!usernameValid(username)) { sendJson(response, 400, { ok: false, error: '用户名需为 2-20 个中英文、数字、下划线或连字符' }); return; }
      if (!passwordValid(password)) { sendJson(response, 400, { ok: false, error: '密码长度需为 8-100 位' }); return; }
      const role = database.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0 ? 'admin' : 'user'; const salt = randomBytes(16).toString('hex');
      try { const result = database.prepare('INSERT INTO users (username, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?)').run(username, passwordHash(password, salt), salt, role, new Date().toISOString()); issueSession(request, response, { id: Number(result.lastInsertRowid), username, role }, 201); } catch (error) { if (String(error).includes('UNIQUE')) sendJson(response, 409, { ok: false, error: '用户名已存在' }); else throw error; }
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const input = await readBody(request); const username = String(input.username || '').trim(); const password = String(input.password || ''); const user = database.prepare('SELECT id, username, role, password_hash, salt FROM users WHERE username = ?').get(username);
      if (!user || !passwordValid(password)) { sendJson(response, 401, { ok: false, error: '用户名或密码错误' }); return; }
      const expected = Buffer.from(user.password_hash, 'hex'), actual = Buffer.from(passwordHash(password, user.salt), 'hex');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) { sendJson(response, 401, { ok: false, error: '用户名或密码错误' }); return; }
      issueSession(request, response, user); return;
    }
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') { const token = cookies(request).sppet_session; if (token) database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token)); sendJson(response, 200, { ok: true }, { 'set-cookie': 'sppet_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); return; }
    if (request.method === 'GET' && url.pathname === '/api/leaderboard') { const document = await readJson(leaderboardFile, { entries: [] }); const entries = (Array.isArray(document.entries) ? document.entries : []).sort((a, b) => score(b) - score(a)).slice(0, 100).map(publicEntry); sendJson(response, 200, { entries, generatedAt: new Date().toISOString() }); return; }
    if (request.method === 'POST' && url.pathname === '/api/leaderboard/submit') { sendJson(response, 410, { ok: false, error: 'use authenticated /api/v1/leaderboard/submit' }); return; }
    if (request.method === 'GET' && url.pathname === '/api/content') { const fallback = await readJson(defaultContentFile, null); const gameContent = await readJson(contentFile, fallback); if (!validContent(gameContent)) { sendJson(response, 500, { ok: false, error: 'content unavailable' }); return; } sendJson(response, 200, gameContent); return; }
    if (request.method === 'PUT' && url.pathname === '/api/content') { if (!contentAuthorized(request)) { sendJson(response, 401, { ok: false, error: '请先使用管理员账号登录' }); return; } const gameContent = await readBody(request); if (!validContent(gameContent)) { sendJson(response, 400, { ok: false, error: 'skills, items and chapters are required' }); return; } gameContent.version = number(gameContent.version, 100000) + 1; await atomicJson(contentFile, gameContent); sendJson(response, 200, { ok: true, version: gameContent.version }); return; }
    sendJson(response, 404, { ok: false, error: 'not found' });
  } catch (error) { sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : 'server error' }); }
}).listen(port, '127.0.0.1', () => {
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  console.log(`SPPet website listening on http://127.0.0.1:${port}`);
  if (registrationOpen()) console.log('The first registered account becomes administrator.');
});
