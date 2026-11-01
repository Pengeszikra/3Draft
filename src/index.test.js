import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { name, version, info } from './index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('exported name and version match package.json', () => {
  assert.equal(name, pkg.name);
  assert.equal(version, pkg.version);
});

test('info() describes the package', () => {
  const i = info();
  assert.equal(i.name, '3draft');
  assert.equal(i.stage, 'pre-alpha');
  assert.ok(i.goals.length > 0);
});
