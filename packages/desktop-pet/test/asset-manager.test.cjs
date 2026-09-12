const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const archiver = require('archiver');
const { AssetManager, REQUIRED_STATES } = require('../src/asset-manager.cjs');

const makeManifest = (id, extra = {}) => ({ manifestVersion: 1, id, name: id, type: 'emoji', version: '1.0.0', states: { idle: '🐱' }, ...extra });

test('missing character states fall back to idle', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-assets-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const builtIn = path.join(root, 'built-in'), custom = path.join(root, 'custom'), character = path.join(builtIn, 'default');
  fs.mkdirSync(character, { recursive: true });
  fs.writeFileSync(path.join(character, 'manifest.json'), JSON.stringify(makeManifest('default_pet')));
  const loaded = new AssetManager(builtIn, custom).load('default_pet');
  assert.deepEqual(Object.keys(loaded.states), REQUIRED_STATES);
  assert.equal(loaded.states.sleep.value, '🐱');
});

test('imports, switches and deletes a custom character', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-import-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const builtIn = path.join(root, 'built-in'), custom = path.join(root, 'custom'), source = path.join(root, 'source');
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify(makeManifest('study_cat', { states: { idle: '🐈', happy: '😸' } })));
  const manager = new AssetManager(builtIn, custom);
  assert.equal(manager.importFolder(source).manifest.id, 'study_cat');
  assert.equal(manager.load('study_cat').states.happy.value, '😸');
  manager.remove('study_cat');
  assert.equal(manager.list().length, 0);
});

test('loads frame animations and rejects unsafe frame paths', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-frames-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const builtIn = path.join(root, 'built-in'), custom = path.join(root, 'custom'), character = path.join(builtIn, 'pixel');
  fs.mkdirSync(path.join(character, 'animations'), { recursive: true });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(path.join(character, 'idle.png'), png); fs.writeFileSync(path.join(character, 'animations', '1.png'), png); fs.writeFileSync(path.join(character, 'animations', '2.png'), png);
  fs.writeFileSync(path.join(character, 'manifest.json'), JSON.stringify({ manifestVersion: 1, id: 'pixel', name: 'Pixel', type: 'sprite', states: { idle: 'idle.png' }, animations: { walk: { type: 'frames', frames: ['animations/1.png', 'animations/2.png'], fps: 8, loop: true }, battle: { type: 'frames', frames: ['../outside.png'], fps: 8 } }, outfits: [{ id: 'coat', name: '外套', resource: 'idle.png' }] }));
  const loaded = new AssetManager(builtIn, custom).load('pixel');
  assert.equal(loaded.animations.walk.frames.length, 2);
  assert.equal(loaded.animations.battle, undefined);
  assert.equal(loaded.layers.outfits[0].id, 'coat');
});

test('imports a validated .sppetpack ZIP into the separate character directory', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sppet-pack-')); context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const builtIn = path.join(root, 'built-in'), custom = path.join(root, 'custom'), pack = path.join(root, 'pet.sppetpack'); fs.mkdirSync(custom, { recursive: true });
  await new Promise((resolve, reject) => { const output = fs.createWriteStream(pack), archive = archiver('zip'); output.on('close', resolve); archive.on('error', reject); archive.pipe(output); archive.append(JSON.stringify(makeManifest('packed_pet')), { name: 'manifest.json' }); archive.finalize(); });
  const manager = new AssetManager(builtIn, custom), loaded = manager.importPack(pack); assert.equal(loaded.manifest.id, 'packed_pet'); assert.equal(fs.existsSync(path.join(custom, 'packed_pet', 'manifest.json')), true);
});
