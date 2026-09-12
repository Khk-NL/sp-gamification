const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const EOCD = 0x06054b50, CENTRAL = 0x02014b50, LOCAL = 0x04034b50, MAX_TOTAL = 50 * 1024 * 1024, MAX_FILE = 15 * 1024 * 1024;
const safeRelative = (value) => { const normalized = String(value).replace(/\\/g, '/'); if (!normalized || normalized.startsWith('/') || normalized.includes(':') || normalized.split('/').includes('..')) throw new Error('资源包包含不安全路径'); return normalized; };

const extractSafeZip = (archive, destination) => {
  const source = fs.readFileSync(archive); if (source.length > MAX_TOTAL) throw new Error('资源包超过 50MB'); let eocd = -1;
  for (let index = source.length - 22; index >= Math.max(0, source.length - 65_557); index -= 1) if (source.readUInt32LE(index) === EOCD) { eocd = index; break; }
  if (eocd < 0) throw new Error('无效的 .sppetpack ZIP'); const count = source.readUInt16LE(eocd + 10), centralOffset = source.readUInt32LE(eocd + 16), entries = []; let offset = centralOffset, total = 0;
  for (let index = 0; index < count; index += 1) { if (source.readUInt32LE(offset) !== CENTRAL) throw new Error('资源包目录损坏'); const method = source.readUInt16LE(offset + 10), compressedSize = source.readUInt32LE(offset + 20), size = source.readUInt32LE(offset + 24), nameLength = source.readUInt16LE(offset + 28), extraLength = source.readUInt16LE(offset + 30), commentLength = source.readUInt16LE(offset + 32), external = source.readUInt32LE(offset + 38), localOffset = source.readUInt32LE(offset + 42), name = safeRelative(source.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')); if (((external >>> 16) & 0o170000) === 0o120000) throw new Error('资源包不允许符号链接'); if (![0, 8].includes(method) || size > MAX_FILE || (total += size) > MAX_TOTAL) throw new Error('资源包包含不支持或过大的文件'); entries.push({ name, method, compressedSize, size, localOffset }); offset += 46 + nameLength + extraLength + commentLength; }
  fs.mkdirSync(destination, { recursive: true }); const root = `${path.resolve(destination)}${path.sep}`;
  for (const entry of entries) { const target = path.resolve(destination, entry.name); if (!target.startsWith(root)) throw new Error('资源包路径越界'); if (entry.name.endsWith('/')) { fs.mkdirSync(target, { recursive: true }); continue; } if (source.readUInt32LE(entry.localOffset) !== LOCAL) throw new Error('资源包文件头损坏'); const nameLength = source.readUInt16LE(entry.localOffset + 26), extraLength = source.readUInt16LE(entry.localOffset + 28), start = entry.localOffset + 30 + nameLength + extraLength, compressed = source.subarray(start, start + entry.compressedSize), output = entry.method === 0 ? compressed : zlib.inflateRawSync(compressed); if (output.length !== entry.size) throw new Error('资源包文件尺寸校验失败'); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, output); }
};

module.exports = { extractSafeZip };
