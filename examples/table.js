// Usage: node examples/table.js
// Writes the 2x2 sheet and the four single views to examples/out/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { box, merge, renderSheet, renderViews } from '../src/index.js';

const top = box({ size: [2, 0.15, 1.2], at: [0, 0.925, 0], color: '#c8a27a' });
const legs = [-0.85, 0.85].flatMap((x) =>
  [-0.45, 0.45].map((z) => box({ size: [0.15, 0.85, 0.15], at: [x, 0.425, z], color: '#8a6a4a' })),
);
const table = merge(top, ...legs);

const out = new URL('./out/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('table.sheet.svg', out), renderSheet(table));
for (const { name, svg } of renderViews(table)) {
  writeFileSync(new URL(`table.${name}.svg`, out), svg);
}
console.log('written to examples/out/');
