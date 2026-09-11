import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  entryPoints: [path.join(root, 'src', 'plugin.ts')],
  outfile: path.join(dist, 'plugin.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'none',
});
await cp(path.join(root, 'static'), dist, { recursive: true });
const indexPath = path.join(dist, 'index.html');
const [html, baseCss, themeCss, uiScript, pixelTiles, pixelBackgrounds, pixelFont] = await Promise.all([
  readFile(indexPath, 'utf8'),
  readFile(path.join(dist, 'index.css'), 'utf8'),
  readFile(path.join(dist, 'archive-theme.css'), 'utf8'),
  readFile(path.join(dist, 'index.js'), 'utf8'),
  readFile(path.join(dist, 'assets', 'kenney-pixel-platformer.png')),
  readFile(path.join(dist, 'assets', 'kenney-pixel-backgrounds.png')),
  readFile(path.join(dist, 'assets', 'silkscreen-bold.woff2')),
]);
const embeddedThemeCss = themeCss
  .replaceAll('./assets/kenney-pixel-platformer.png', `data:image/png;base64,${pixelTiles.toString('base64')}`)
  .replaceAll('./assets/kenney-pixel-backgrounds.png', `data:image/png;base64,${pixelBackgrounds.toString('base64')}`)
  .replaceAll('./assets/silkscreen-bold.woff2', `data:font/woff2;base64,${pixelFont.toString('base64')}`);
const standaloneHtml = html
  .replace('<link rel="stylesheet" href="./index.css">', `<style data-sppet-style="base">${baseCss}</style>`)
  .replace('<link rel="stylesheet" href="./archive-theme.css">', `<style data-sppet-style="theme">${embeddedThemeCss}</style>`)
  .replace('<script src="./index.js"></script>', `<script data-sppet-script="ui">${uiScript.replace(/<\/script/gi, '<\\/script')}</script>`);
const indexBytes = Buffer.byteLength(standaloneHtml, 'utf8');
if (indexBytes > 100 * 1024) throw new Error(`SP index.html exceeds the 100 KB upload limit (${indexBytes} bytes)`);
await writeFile(indexPath, standaloneHtml, 'utf8');
console.log(`SP plugin built at ${dist}`);
