import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { galaxyPoints } from '../dist/index.js';
import { scene } from './deepsky.js';

test('deep sky: 1000 galaxies as recipes, 400 black holes, 3000 stars, the Milky Way as points', () => {
  const by = (p) => scene.objects.filter(p).length;
  assert.equal(by((o) => o.galaxy), 1000);
  assert.equal(by((o) => o.mats.core === 'bh-core'), 400);
  assert.equal(by((o) => o.proto === 'star'), 3000);
  assert.equal(scene.cloud.n, 29650);
  assert.ok(!scene.cloudProtos, 'no stored galaxy point sets');
  for (const o of scene.objects) assert.ok(o.at.every(Number.isFinite) && o.name, o.name);
  for (const o of scene.objects.filter((x) => x.galaxy)) assert.ok(galaxyPoints(o.galaxy).n > 100, o.name);
});

test('the saved scene file matches the builder', () => {
  assert.equal(readFileSync(new URL('./deepsky.scene.json', import.meta.url), 'utf8'), JSON.stringify(scene));
});
