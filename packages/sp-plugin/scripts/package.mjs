import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outputDir = path.join(root, 'release');
const outputPath = path.join(outputDir, 'SPPet-SP-v0.3.1.zip');
await mkdir(outputDir, { recursive: true });

await new Promise((resolve, reject) => {
  const output = createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  output.on('close', resolve);
  output.on('error', reject);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory(path.join(root, 'dist'), false);
  archive.finalize();
});
console.log(`Plugin ZIP created at ${outputPath}`);
