// Sky catalogues (src/sky.ts): the prototypes are the deep sky's, and a small catalogue becomes the scene it should.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skyScene, skyPrototypes, LY_PER_AU } from '../dist/index.js';
import { PLAIN, GALAXY_PROTOS } from './stars.js';

test('sky prototypes are the deep sky ones', () => {
  const p = skyPrototypes();
  const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b)); // (stars.js faces carry color: undefined)
  same(p.star, PLAIN.star);
  same(p.ghost, GALAXY_PROTOS.ghost);
  same(p.hole, GALAXY_PROTOS.hole);
});

test('a catalogue: a star by parallax, a planet and its moon, a black hole, a galaxy', () => {
  const { scene, warnings, counts } = skyScene({
    format: '3draft-sky',
    objects: [
      { type: 'star', name: 'Proxima Centauri', ra: '14 29 42.9', dec: '-62 40 46', parallax: 768.07, spect: 'M5.5Ve', vmag: 11.13 },
      { type: 'planet', name: 'Proxima b', around: 'Proxima Centauri', a: 0.0485, radius_earth: 1.07 },
      { type: 'moon', name: 'Proxima b I', around: 'proxima b', a_km: 50000, radius_km: 900 },
      { type: 'black hole', name: 'Gaia BH1', ra: 262.17, dec: -0.58, dist: 1560, mass: 9.6 },
      { type: 'galaxy', name: 'Andromeda', ra_h: 0.712, dec: 41.27, dist: 2.5, unit: 'Mly', kind: 'spiral', diameter_kly: 152, bar: 0.3 },
      { type: 'star', name: 'Nowhere' },
      { type: 'planet', name: 'Lost', around: 'Nobody', a: 1 },
    ],
  });
  assert.deepEqual(counts, { star: 1, 'black hole': 1, galaxy: 1, planet: 1, moon: 1 });
  assert.equal(warnings.length, 2);
  const by = Object.fromEntries(scene.objects.map((o) => [o.name, o]));
  const prox = by['Proxima Centauri'];
  assert.ok(Math.abs(Math.hypot(...prox.at) - 4.246) < 0.01, 'Proxima is 4.25 ly away');
  assert.equal(prox.mats.core, 'star-M');
  const b = by['Proxima b'];
  assert.ok(Math.abs(Math.hypot(...b.at.map((v, i) => v - prox.at[i])) / LY_PER_AU - 0.0485) < 1e-4);
  assert.deepEqual(b.planet.light, prox.at);
  assert.match(b.category, /rocky exoplanet/);
  const moon = by['Proxima b I'];
  assert.equal(moon.category, 'moon');
  assert.deepEqual(moon.planet.light, prox.at, 'a moon is lit by its planet\'s star');
  assert.equal(by['Gaia BH1'].mats.core, 'bh-core');
  assert.equal(by.Andromeda.galaxy.kind, 'S');
  assert.equal(by.Andromeda.galaxy.bar, 0.3);
  assert.ok(Math.abs(Math.hypot(...by.Andromeda.at) - 2.5e6) < 1);
  assert.ok(scene.start.eye.every(Number.isFinite));
});

test('the TRAPPIST-1 example catalogue', () => {
  const sky = JSON.parse(readFileSync(new URL('./trappist-1.sky.json', import.meta.url)));
  const { scene, warnings } = skyScene(sky);
  assert.deepEqual(warnings, []);
  assert.equal(scene.objects.length, 8);
  assert.equal(scene.paths.length, 7);
  assert.ok(Math.abs(Math.hypot(...scene.objects[0].at) - 40.67) < 0.05);
  assert.equal(scene.objects.find((o) => o.name === 'TRAPPIST-1 e').planet.kind, 'earth');
});
