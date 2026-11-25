// npm run release: the dry run only shows the next version; a real release refuses a dirty tree (and so never publishes
// a version that git does not have)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { nextVersion } from './bump.js';

const root = new URL('../', import.meta.url);
const pkg = () => JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

test('release --dry-run prints the next version and writes nothing', () => {
  const before = readFileSync(new URL('package.json', root), 'utf8');
  const r = spawnSync(process.execPath, ['scripts/release.mjs', '--dry-run'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.includes(`${pkg().version} -> ${nextVersion(pkg().version)}`), r.stdout);
  assert.equal(readFileSync(new URL('package.json', root), 'utf8'), before);
});

test('package.json runs it as npm run release', () => {
  assert.equal(pkg().scripts.release, 'node scripts/release.mjs');
});
