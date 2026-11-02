// Usage: node examples/table.js
// Writes the 2x2 sheet and the four single views to examples/out/.

import { mkdirSync, writeFileSync } from 'node:fs';
import { renderSheet, renderViews } from '../dist/index.js';
import { table } from './table-model.js';

const out = new URL('./out/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('table.sheet.svg', out), renderSheet(table));
for (const { name, svg } of renderViews(table)) {
  writeFileSync(new URL(`table.${name}.svg`, out), svg);
}
console.log('written to examples/out/');
