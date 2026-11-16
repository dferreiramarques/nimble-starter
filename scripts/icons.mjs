// Draws the app icons (the check mark on the accent colour) as PNG files, with no dependencies.
// Used by init.mjs so the icons follow --accent. Variants: any (rounded), maskable (full bleed, glyph in the safe zone), apple-touch (full bleed).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const ACCENTS = {            // [background, glyph] — the light-theme accent of the nimbleUI kit
  emerald: ['#10b981', '#052e22'], rose: ['#E52B50', '#ffffff'], indigo: ['#3347d4', '#ffffff'],
  amber: ['#d9a21b', '#2a1d00'], violet: ['#6a57f0', '#ffffff']
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const CHECK = [[9, 16.5], [14, 21.5], [23, 11.5]];   // the glyph, in a 32×32 box (same as favicon.svg)
const STROKE = 3;

function segDist(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
function inRoundRect(x, y, r) { const cx = Math.min(Math.max(x, r), 32 - r), cy = Math.min(Math.max(y, r), 32 - r); return Math.hypot(x - cx, y - cy) <= r; }

function render(size, bg, fg, { rounded, scale }) {
  const SS = 3, px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let cov = 0, glyph = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const x = ((i + (sx + .5) / SS) / size) * 32, y = ((j + (sy + .5) / SS) / size) * 32;
      if (rounded && !inRoundRect(x, y, 8)) continue;
      cov++;
      const gx = 16 + (x - 16) / scale, gy = 16 + (y - 16) / scale;       // glyph scaled about the centre
      if (Math.min(segDist(gx, gy, CHECK[0], CHECK[1]), segDist(gx, gy, CHECK[1], CHECK[2])) <= STROKE / 2) glyph++;
    }
    const n = SS * SS, o = (j * size + i) * 4, g = cov ? glyph / cov : 0;
    for (let c = 0; c < 3; c++) px[o + c] = Math.round(bg[c] * (1 - g) + fg[c] * g);
    px[o + 3] = Math.round((cov / n) * 255);
  }
  return px;
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function writeIcons(dir, accent) {
  const [bg, fg] = ACCENTS[accent].map(hex);
  mkdirSync(dir, { recursive: true });
  const out = { 'icon-192': [192, true, 1], 'icon-512': [512, true, 1], 'icon-maskable-512': [512, false, .72], 'apple-touch-icon': [180, false, .86] };
  for (const [name, [size, rounded, scale]] of Object.entries(out)) writeFileSync(path.join(dir, name + '.png'), png(size, render(size, bg, fg, { rounded, scale })));
  return Object.keys(out).length;
}
export const faviconSvg = accent => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${ACCENTS[accent][0].toLowerCase()}"/><path d="M9 16.5l5 5 9-10" fill="none" stroke="${ACCENTS[accent][1].toLowerCase()}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>\n`;
