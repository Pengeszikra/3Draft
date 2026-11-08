// Builds examples/data/stars<N>.js from the HYG database v4 (astronexus, CC BY-SA 4.0): the N nearest stars incl. the Sun.
//   git clone https://github.com/astronexus/HYG-Database  &&  node examples/data/build-stars.mjs HYG-Database/hyg/CURRENT/hygdata_v40.csv.gz 5000
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const [file, count = '5000'] = process.argv.slice(2);
const N = Number(count);
const text = (file.endsWith('.gz') ? gunzipSync(readFileSync(file)) : readFileSync(file)).toString('utf8');
const rows = text.trim().split('\n');
const head = rows[0].split(',').map((h) => h.replace(/"/g, ''));
const col = Object.fromEntries(head.map((h, i) => [h, i]));
const split = (line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''));
const stars = rows
  .slice(1)
  .map(split)
  .map((r) => ({ r, dist: Number(r[col.dist]) }))
  .filter((s) => s.dist > 0 && s.dist < 1e5)
  .sort((a, b) => a.dist - b.dist)
  .slice(0, N - 1)
  .map(({ r }) => r);
const sol = rows.slice(1).map(split).find((r) => r[col.proper] === 'Sol');
const num = (v) => (v === '' || v == null ? null : Number(v));
const fmt = (v, d = 6) => (v == null ? 'null' : String(Math.round(v * 10 ** d) / 10 ** d));
const label = (r) => r[col.proper] || (r[col.bf] && r[col.bf].trim()) || (r[col.gl] && (/^(Gl|GJ|NN|Wo|Wolf)/i.test(r[col.gl]) ? r[col.gl] : `Gl ${r[col.gl]}`)) || (r[col.hd] && `HD ${r[col.hd]}`) || (r[col.hip] && `HIP ${r[col.hip]}`) || `HYG ${r[col.id]}`;
const line = (r) => `  [${JSON.stringify(label(r))},${fmt(num(r[col.x]))},${fmt(num(r[col.y]))},${fmt(num(r[col.z]))},${fmt(num(r[col.absmag]), 3)},${JSON.stringify(r[col.spect] ?? '')},${fmt(num(r[col.ci]), 3)},${fmt(num(r[col.lum]), 6)}],`;
const out = [`// nearest ${N} stars from the HYG database v4 (astronexus, CC BY-SA 4.0), equatorial x y z in parsec`, '// [name, x, y, z, absMag, spect, ci, lum(Lsun)]', 'export const STARS = [', line(sol), ...stars.map(line), '];', ''].join('\n');
writeFileSync(new URL(`./stars${N}.js`, import.meta.url), out);
console.log(N, 'stars, farthest', Math.max(...stars.map((r) => Number(r[col.dist]))).toFixed(1), 'pc,', (out.length / 1e3).toFixed(0), 'KB');
