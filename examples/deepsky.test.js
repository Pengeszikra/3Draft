import test from 'node:test';
import { EXO_HOSTS } from './data/exoplanets.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { galaxyPoints } from '../dist/index.js';
import { scene } from './deepsky.js';

test('deep sky: 1000 galaxies as recipes, 400 black holes, 3000 stars, the Milky Way as points', () => {
  const by = (p) => scene.objects.filter(p).length;
  assert.equal(by((o) => o.galaxy), 1000);
  assert.equal(by((o) => o.mats.core === 'bh-core'), 400);
  assert.equal(by((o) => o.proto === 'star'), 3000 + 20 + EXO_HOSTS.length); // + the constellation stars and the exoplanet hosts the list lacked
  assert.equal(scene.cloud.n, 29650);
  assert.equal(scene.vehicle, 'starship');
  const AU = 1.58125074e-5;
  assert.ok(Math.abs(Math.hypot(...scene.start.eye) / AU - 60) < 0.01); // 60 AU from the Sun, over the planets' orbits
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

test('the cosmic dawn: the five farthest confirmed galaxies, at ~32-34 billion light years, drawn with the H recipe', () => {
  const dawn = scene.objects.filter((o) => o.galaxy?.kind === 'H');
  assert.equal(dawn.length, 5);
  for (const g of dawn) {
    const d = Math.hypot(...g.at);
    assert.ok(d > 31e9 && d < 35e9, `${g.name} ${d}`);
  }
  assert.ok(dawn.find((g) => g.name.startsWith('GN-z11')).galaxy.agn);
});

test('the Solar System at its true scale: the Sun 696 000 km, the planets at their distances on 2026-11-14, Saturn with its rings, the orbits', () => {
  const AU = 1.58125074e-5, KM = 1 / 9.4607304725808e12;
  const at = (n) => scene.objects.find((o) => o.name === n);
  assert.ok(Math.abs(at('Sun').scale / KM / 696340 - 1) < 0.02);
  const dist = { Mercury: [0.3, 0.47], Venus: [0.71, 0.73], Earth: [0.98, 1.02], Mars: [1.38, 1.67], Jupiter: [4.95, 5.46], Saturn: [9.0, 10.1], Uranus: [18.2, 20.1], Neptune: [29.8, 30.4], Pluto: [29.6, 49.4] };
  for (const [n, [lo, hi]] of Object.entries(dist)) {
    const d = Math.hypot(...at(n).at) / AU;
    assert.ok(d > lo && d < hi, `${n} ${d}`);
  }
  assert.ok(Math.abs(at('Earth').scale / KM - 6371) < 1);
  const moon = Math.hypot(...at('Moon').at.map((v, i) => v - at('Earth').at[i])) / KM;
  assert.ok(Math.abs(moon - 384400) < 2000, String(moon));
  assert.equal(at('Saturn').planet.kind, 'gas');
  assert.ok(at('Saturn').planet.ring.outer > 2.2 && at('Earth').planet.atmosphere);
  assert.equal(scene.paths.length, 10);
  assert.ok(scene.prototypes.planet);
});

test('500 exoplanets round their stars, each with one of the 30 recipes, lit by its star', () => {
  const exo = scene.objects.filter((o) => o.exo);
  assert.equal(exo.length, 500);
  const recipes = new Set(exo.map((o) => JSON.stringify({ ...o.planet, seed: 0, pole: 0, light: 0 })));
  assert.ok(recipes.size <= 30 && recipes.size >= 15, String(recipes.size));
  const b = exo.find((o) => o.name === 'Proxima Centauri b');
  const star = scene.objects.find((o) => o.name === 'Proxima Centauri');
  const AU = 1.58125074e-5;
  assert.ok(Math.abs(Math.hypot(...b.at.map((v, i) => v - star.at[i])) / AU - 0.0486) < 0.002);
  assert.deepEqual(b.planet.light, star.at);
  assert.ok(exo.some((o) => o.planet.kind === 'lava') && exo.some((o) => o.planet.ring));
});

test('the saved scene file matches the builder', () => {
  assert.equal(readFileSync(new URL('./deepsky.scene.json', import.meta.url), 'utf8'), JSON.stringify(scene));
});
