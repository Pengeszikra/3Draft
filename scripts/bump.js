// Date based versions, in the form npm (semver) accepts: YY.M.DNNN
//
//   26.11.01.001  ->  26.11.1001   (2026-11-01, build 001)
//   26.11.15.012  ->  26.11.15012  (2026-11-15, build 012)
//
// semver allows exactly three numbers and no leading zeros, so day and build
// share the last number: day * 1000 + build.
//
// Usage: npm run bump        (next version for today's local date)
//        node scripts/bump.js --dry   (only print it)

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Next version for `date` given the current version. */
export const nextVersion = (current, date = new Date()) => {
  const yy = date.getFullYear() % 100;
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const [cy, cm, cp] = current.split('.').map(Number);
  const sameDay = cy === yy && cm === mm && Math.floor(cp / 1000) === dd;
  const build = sameDay ? (cp % 1000) + 1 : 1;
  if (build > 999) throw new Error('more than 999 builds in one day');
  return `${yy}.${mm}.${dd * 1000 + build}`;
};

/** '26.11.1001' -> '26.11.01.001' (the readable form). */
export const display = (version) => {
  const [yy, mm, p] = version.split('.').map(Number);
  const pad = (n, w) => String(n).padStart(w, '0');
  return `${pad(yy, 2)}.${pad(mm, 2)}.${pad(Math.floor(p / 1000), 2)}.${pad(p % 1000, 3)}`;
};

const run = () => {
  const pkgUrl = new URL('../package.json', import.meta.url);
  const srcUrl = new URL('../src/index.js', import.meta.url);
  const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'));
  const next = nextVersion(pkg.version);
  console.log(`${pkg.version} -> ${next}  (${display(next)})`);
  if (process.argv.includes('--dry')) return;

  pkg.version = next;
  writeFileSync(pkgUrl, `${JSON.stringify(pkg, null, 2)}\n`);

  const src = readFileSync(srcUrl, 'utf8');
  const updated = src.replace(/export const version = '[^']*';/, `export const version = '${next}';`);
  if (updated === src && !src.includes(`'${next}'`)) throw new Error('version constant not found in src/index.js');
  writeFileSync(srcUrl, updated);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
