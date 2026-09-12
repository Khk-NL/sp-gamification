import packager from '@electron/packager';
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const release = path.join(root, 'release');

await mkdir(release, { recursive: true });
const staging = await mkdtemp(path.join(os.tmpdir(), 'sppet-package-'));

try {
  const [appDirectory] = await packager({
    dir: root,
    name: 'SPPet',
    platform: 'win32',
    arch: 'x64',
    electronVersion: '38.8.6',
    out: staging,
    overwrite: true,
    asar: true,
    prune: false,
    ignore: [/^\/node_modules(?:\/|$)/, /^\/release(?:\/|$)/],
  });

  const zipPath = path.join(release, 'SPPet-v0.14.0-win-x64.zip');
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(appDirectory, false);
    archive.finalize();
  });

  console.log(`Desktop pet ZIP: ${zipPath}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
