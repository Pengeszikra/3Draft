import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { box, merge, makeCamera, orbit, pick, bounds, initKernel, rotate } from './index.js';
import type { Vec3, ViewName, ViewSpec } from './index.js';
// @ts-ignore: a plain .mjs script outside src/
import { assembleKernel, findCore, render } from '../scripts/build-kernel.mjs';
import { KERNEL_BYTES } from './kernel-bytes.js';

// a small deterministic random generator
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const scene = (n, r) => {
  const parts = [];
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28;
    parts.push(
      box({
        size: [0.1 + r() * 0.4, 0.1 + r() * 0.6, 0.1 + r() * 0.4],
        at: [(r() - 0.5) * 4, r() * 2, (r() - 0.5) * 4],
        axes: [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]],
        color: '#' + Math.floor(r() * 0xffffff).toString(16).padStart(6, '0'),
      }),
    );
  }
  return merge(...parts);
};

test('the kernel picks exactly what pick() picks', async () => {
  const kernel = await initKernel();
  const r = rng(7);
  const mesh = scene(40, r);
  const fit = bounds(mesh);
  let hits = 0;
  for (const view of [orbit({ yaw: 0.4, pitch: 0.5 }), orbit({ yaw: -2, pitch: -0.2 }), 'persp', 'top'] as (ViewName | ViewSpec)[]) {
    const cam = makeCamera(view, mesh, 400, fit);
    for (let k = 0; k < 150; k++) {
      const x = r() * 400;
      const y = r() * 400;
      for (const cull of [true, false]) {
        const want = pick(mesh, cam, x, y, { cull });
        const got = kernel.pick(mesh, cam, x, y, { cull });
        if (!want) {
          assert.equal(got, null, `miss at ${x},${y}`);
          continue;
        }
        hits++;
        assert.ok(got, `hit at ${x},${y}`);
        assert.equal(got.face, want.face);
        assert.equal(got.front, want.front);
        assert.equal(got.color, want.color);
        assert.ok(Math.abs(got.distance - want.distance) < 1e-9, `${got.distance} vs ${want.distance}`);
        for (let i = 0; i < 3; i++) {
          assert.ok(Math.abs(got.point[i] - want.point[i]) < 1e-9);
          assert.ok(Math.abs(got.normal[i] - want.normal[i]) < 1e-12);
        }
      }
    }
  }
  assert.ok(hits > 60, `enough rays hit something (${hits})`);
});

test('the kernel follows a mesh that changes and grows its memory', async () => {
  const kernel = await initKernel();
  const small = box();
  const cam = makeCamera(orbit({ yaw: 0.3, pitch: 0.3 }), small, 300);
  assert.ok(kernel.pick(small, cam, 150, 150));
  const big = scene(400, rng(3)); // far more than the single starting page
  const cam2 = makeCamera(orbit({ yaw: 0.3, pitch: 0.3 }), big, 300, bounds(big));
  const a = pick(big, cam2, 150, 150);
  const b = kernel.pick(big, cam2, 150, 150);
  assert.equal(b.face, a.face);
  assert.equal(kernel.pick({ positions: [], faces: [] }, cam2, 10, 10), null);
});

test('polygons with more than three corners are fanned like pick() does', async () => {
  const kernel = await initKernel();
  const hex = {
    positions: Array.from({ length: 6 }, (_, i): Vec3 => [Math.cos((i * Math.PI) / 3), 0, Math.sin((i * Math.PI) / 3)]),
    faces: [{ v: [0, 1, 2, 3, 4, 5], color: '#ff0000' }],
  };
  const cam = makeCamera(orbit({ yaw: 0, pitch: 1.2 }), hex, 300, { center: [0, 0, 0], radius: 1 });
  for (const [x, y] of [[150, 150], [120, 160], [190, 140], [20, 20]]) {
    const want = pick(hex, cam, x, y, { cull: false });
    const got = kernel.pick(hex, cam, x, y, { cull: false });
    assert.equal(got?.face, want?.face);
  }
});

test('the kernel bytes are what the HEXAW source assembles to', { skip: findCore() ? false : 'hexaw-core.js not found' }, async () => {
  const text = render(await assembleKernel());
  assert.equal(text.includes(KERNEL_BYTES), true, 'run `node scripts/build-kernel.mjs`');
});
