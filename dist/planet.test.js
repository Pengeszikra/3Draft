import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planetInstances, inv4, PLANET_FLOATS } from './planet.js';
import { viewProjection } from './gpu.js';
import { makeCamera, orbit } from './camera.js';
const nothing = { positions: [], faces: [] };
const cam = makeCamera(orbit({ yaw: 0, pitch: 0 }), nothing, 100, { center: [0, 0, 0], radius: 1, dist: 10 }); // the eye on +z, looking at -z
const vpRot = viewProjection({ ...cam, eye: [0, 0, 0] }, 0.01);
test('inv4 inverts a view-projection', () => {
    const inv = inv4(vpRot);
    // (vp · inv) = identity: check one column through a point
    const x = [0.3, -0.2, 0.5, 1];
    const y = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].reduce((s, c) => s + vpRot[c * 4 + r] * x[c], 0));
    const z = [0, 1, 2, 3].map((r) => [0, 1, 2, 3].reduce((s, c) => s + inv[c * 4 + r] * y[c], 0));
    z.forEach((v, k) => assert.ok(Math.abs(v - x[k]) < 1e-4, `${v} vs ${x[k]}`));
});
test('a planet in view: relative to the eye in its radii, a small screen rectangle round the middle; one behind or off screen is left out', () => {
    const planets = [
        { center: [0, 0, 0], radius: 1e-10, kind: 'earth', atmosphere: { color: '#88aaff' } },
        { center: [0, 0, 20], radius: 1e-10, kind: 'rock' }, // behind the eye
        { center: [50, 0, 0], radius: 1e-10, kind: 'gas' }, // far off to the side
    ];
    const { data, count } = planetInstances(planets, cam.eye, vpRot);
    assert.equal(count, 1);
    assert.equal(data.length, PLANET_FLOATS);
    assert.ok(Math.abs(data[2] - -10 / 1e-10) / (10 / 1e-10) < 1e-6); // z: 10 units ahead, in radii
    assert.ok(Math.abs(data[3] - 1e-10) / 1e-10 < 1e-6);
    const [x0, y0, x1, y1] = [data[4], data[5], data[6], data[7]];
    assert.ok(x0 < 0 && x1 > 0 && y0 < 0 && y1 > 0 && x1 - x0 < 1e-6, `${x0} ${x1}`);
    assert.equal(data[11], 2); // kind earth
});
test('close by (inside the reach of its rings or atmosphere) a planet covers the whole screen', () => {
    const { data } = planetInstances([{ center: [0, 0, 9.5], radius: 0.4, kind: 'gas', ring: { inner: 1.3, outer: 2.3, color: '#ddccaa' } }], cam.eye, vpRot);
    assert.deepEqual(Array.from(data.slice(4, 8)), [-1, -1, 1, 1]);
    assert.ok(Math.abs(data[23] - 2.3) < 1e-6 && Math.abs(data[19] - 1.3) < 1e-6); // the ring's radii
});
