// Génère les icônes PNG de l'appli (haltère marine sur dégradé coucher de soleil), sans dépendance.
// Usage (Git Bash ou PowerShell) : node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x / size, y / size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
// Dégradé vertical #ffd166 -> #ff8a3d -> #ff5fa2, haltère #1b1f3a (piste « Sunset Drive »).
const STOPS = [[0, [255, 209, 102]], [0.45, [255, 138, 61]], [1, [255, 95, 162]]];
function bg(y) {
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i], [p0, c0] = STOPS[i - 1];
    if (y <= p1) { const t = (y - p0) / (p1 - p0); return c0.map((v, k) => Math.round(v + (c1[k] - v) * t)); }
  }
  return STOPS[STOPS.length - 1][1];
}
const FG = [27, 31, 58];
const rect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
// Haltère horizontal centré (zone sûre "maskable" : 80 % central).
function pixel(x, y) {
  const bar = rect(x, y, 0.22, 0.47, 0.78, 0.53);
  const plates = rect(x, y, 0.25, 0.33, 0.33, 0.67) || rect(x, y, 0.67, 0.33, 0.75, 0.67)
    || rect(x, y, 0.35, 0.38, 0.40, 0.62) || rect(x, y, 0.60, 0.38, 0.65, 0.62);
  return bar || plates ? FG : bg(y);
}
for (const s of [180, 192, 512]) writeFileSync(`img/icons/icon-${s}.png`, png(s, pixel));
console.log('Icônes générées');
