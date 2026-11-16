// Usage: node scripts/init.mjs "My App" [--id myapp] [--accent emerald|rose|indigo|amber|violet] [--tagline "One sentence."]
// Fills in the {{PLACEHOLDERS}} of a fresh copy of this template. Run it once, then commit.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIcons, faviconSvg } from './icons.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const name = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!name) { console.error('Usage: node scripts/init.mjs "My App" [--id myapp] [--accent rose] [--tagline "One sentence."]'); process.exit(1); }

const id = (flag('id') || name).toLowerCase().replace(/[^a-z0-9]/g, '');
const accent = flag('accent') || 'emerald';
if (!['emerald', 'rose', 'indigo', 'amber', 'violet'].includes(accent)) { console.error('accent must be emerald, rose, indigo, amber or violet'); process.exit(1); }
const tagline = flag('tagline') || `${name}, kept in your own Google Drive.`;
const words = tagline.replace(/\.$/, '').split(' ');
const vals = {
  APP_NAME: name, APP_ID: id, SLUG: id, ACCENT: accent === 'emerald' ? '' : accent,
  TAGLINE: tagline, HEADLINE: words.slice(0, -2).join(' ') || name, HEADLINE_EM: words.slice(-2).join(' '),
  YEAR: String(new Date().getFullYear()), DATE: new Date().toISOString().slice(0, 10)
};

const skip = new Set(['node_modules', '.git', 'nimble']);   // (icons are written below, after the placeholders)
let changed = 0;
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (skip.has(f)) continue;
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(html|js|mjs|json|webmanifest|md|css|svg|example|yml)$/.test(f) && f !== '.env.example') continue;
    if (p === fileURLToPath(import.meta.url)) continue;
    const s = readFileSync(p, 'utf8');
    const t = s.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in vals ? vals[k] : m));
    if (t !== s) { writeFileSync(p, t); changed++; }
  }
})(root);
// icons and favicon in the accent colour
const n = writeIcons(path.join(root, 'public', 'icons'), accent);
writeFileSync(path.join(root, 'public', 'favicon.svg'), faviconSvg(accent));
changed += n + 1;
console.log(`Filled in ${changed} file(s) for "${name}" (id "${id}", accent ${accent}).`);
console.log('Next: copy .env.example to .env, set APP_ID=' + id + ' and the Google values, then npm start.');
console.log('Still to write by hand: the {{...}} sections of public/privacy.html and public/terms.html.');
