'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('init draws the icons in the chosen accent (valid PNGs, right sizes, accent colour)', async () => {
  const { writeIcons, faviconSvg, ACCENTS } = await import('../scripts/icons.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
  try {
    assert.equal(writeIcons(dir, 'indigo'), 4);
    const want = { 'icon-192': 192, 'icon-512': 512, 'icon-maskable-512': 512, 'apple-touch-icon': 180 };
    for (const [name, size] of Object.entries(want)) {
      const b = fs.readFileSync(path.join(dir, name + '.png'));
      assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], name + ' is a PNG');
      assert.equal(b.readUInt32BE(16), size); assert.equal(b.readUInt32BE(20), size);
    }
    assert.match(faviconSvg('indigo'), new RegExp(ACCENTS.indigo[0].toLowerCase()));
    assert.ok(Object.keys(ACCENTS).every(a => ['emerald', 'rose', 'indigo', 'amber', 'violet'].includes(a)));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
