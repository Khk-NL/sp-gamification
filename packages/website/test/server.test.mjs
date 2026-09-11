import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('local registration, login session and admin content publishing work', async (context) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'sppet-auth-'));
  const port = 48000 + Math.floor(Math.random() * 1000);
  const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), SPPET_DATA_DIR: dataDir, SPPET_ALLOW_REGISTER: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  context.after(async () => { server.kill(); await new Promise((resolve) => server.once('close', resolve)); await rm(dataDir, { recursive: true, force: true }); });

  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const registration = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'local_admin', password: 'correct-horse-123' }) });
  assert.equal(registration.status, 201);
  const registrationBody = await registration.json();
  assert.equal(registrationBody.user.role, 'admin');
  const cookie = registration.headers.get('set-cookie').split(';', 1)[0];

  const me = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
  assert.deepEqual((await me.json()).user, { id: 1, username: 'local_admin', role: 'admin' });

  const wrongLogin = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'local_admin', password: 'wrong-password' }) });
  assert.equal(wrongLogin.status, 401);

  const content = JSON.parse(await readFile(path.join(root, 'default-content.json'), 'utf8'));
  const publish = await fetch(`${base}/api/content`, { method: 'PUT', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(content) });
  assert.equal(publish.status, 200);
  assert.equal((await publish.json()).ok, true);

  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie } });
  assert.equal(logout.status, 200);
  const afterLogout = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
  assert.equal((await afterLogout.json()).authenticated, false);
});
