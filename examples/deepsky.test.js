import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { galaxyPoints } from '../dist/index.js';
import { scene } from './deepsky.js';

test('deep sky: 1000 galaxies as recipes, 400 black holes, 3000 stars, the Milky Way as points', () => {
  const by = (p) => scene.objects.filter(p).length;
  assert.equal(by((o) => o.galaxy), 1000);
  assert.equal(by((o) => o.mats.core === 'bh-core'), 400);
  assert.equal(by((o) => o.proto === 'star'), 3020); // 3000 + the constellation stars the list lacked
  assert.equal(scene.cloud.n, 29650);
  assert.equal(scene.vehicle, 'starship');
  assert.deepEqual(scene.start.eye, [0.25, 0.06, 0.6]); // next to the Sun
  assert.ok(!scene.cloudProtos, 'no stored galaxy point sets');
  for (const o of scene.objects) assert.ok(o.at.every(Number.isFinite) && o.name, o.name);
  for (const o of scene.objects.filter((x) => x.galaxy)) assert.ok(galaxyPoints(o.galaxy).n > 100, o.name);
});

test('the constellation figures: 89 (Serpens in two), every figure star is a star of the scene, Orion has its belt', () => {
  assert.equal(scene.figures.length, 89);
  const stars = new Set(scene.objects.filter((o) => o.proto === 'star').map((o) => o.name));
  let segments = 0;
  for (const f of scene.figures) for (const line of f.lines) {
    for (const s of line) assert.ok(stars.has(s), `${f.name}: ${s}`);
    segments += line.length - 1;
  }
  assert.ok(segments > 700, String(segments));
  const orion = scene.figures.find((f) => f.id === 'Ori');
  assert.ok(orion.lines.some((l) => l.join() === 'Alnitak,Alnilam,Mintaka'));
});

test('the saved scene file matches the builder', () => {
  assert.equal(readFileSync(new URL('./deepsky.scene.json', import.meta.url), 'utf8'), JSON.stringify(scene));
});
