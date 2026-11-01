import test from 'node:test';
import assert from 'node:assert/strict';
import { box, merge, makeCamera, orbit, project, bounds } from './index.js';
import { viewProjection, buildVertices } from './gpu.js';

const apply = (m, p) => {
  const c = [0, 1, 2, 3].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
  return { x: c[0] / c[3], y: c[1] / c[3], z: c[2] / c[3], w: c[3] };
};

test('the GPU matrix lands every point on the same pixel as project()', () => {
  const scene = merge(box({ at: [0.3, 0.2, -0.4] }), box({ size: [0.2, 0.6, 0.2], at: [-1, 0.5, 0.7] }));
  const fit = bounds(scene);
  const views = ['front', 'side', 'top', 'persp', orbit({ yaw: 0.9, pitch: 0.5 }), orbit({ yaw: -2, pitch: -0.3 })];
  for (const view of views) {
    for (const size of [400, 733]) {
      const cam = makeCamera(view, scene, size, fit);
      const m = viewProjection(cam);
      for (const p of scene.positions) {
        const want = project(cam, p);
        const got = apply(m, p);
        const px = ((got.x + 1) / 2) * size;
        const py = ((1 - got.y) / 2) * size;
        assert.ok(Math.abs(px - want.x) < 0.05, `${cam.name} x ${px} vs ${want.x}`);
        assert.ok(Math.abs(py - want.y) < 0.05, `${cam.name} y ${py} vs ${want.y}`);
        assert.ok(got.z > 0 && got.z < 1, `${cam.name} depth ${got.z} is inside the clip range`);
      }
    }
  }
});

test('nearer points get a smaller GPU depth', () => {
  for (const view of ['front', 'persp']) {
    const cam = makeCamera(view, box(), 400);
    const a = project(cam, [0, 0, 0.5]);
    const b = project(cam, [0, 0, -0.5]);
    const m = viewProjection(cam);
    const za = apply(m, [0, 0, 0.5]).z;
    const zb = apply(m, [0, 0, -0.5]).z;
    assert.equal(a.depth < b.depth, za < zb);
  }
});

test('buildVertices: triangles with flat outward normals and face colors', () => {
  const m = box({ color: '#ff8000' });
  const v = buildVertices(m);
  assert.equal(v.length, 6 * 2 * 3 * 9, '6 quads = 12 triangles = 36 vertices');
  // first face is +z: normal (0,0,1), color (1, 0.502, 0)
  assert.deepEqual([...v.slice(3, 6)], [0, 0, 1]);
  assert.ok(Math.abs(v[7] - 128 / 255) < 1e-6 && v[6] === 1 && v[8] === 0);
  // every normal points away from the box center
  for (let i = 0; i < v.length; i += 9) {
    const out = v[i] * v[i + 3] + v[i + 1] * v[i + 4] + v[i + 2] * v[i + 5];
    assert.ok(out > 0, 'normal points outwards');
  }
});

test('buildVertices: an empty mesh gives no vertices', () => {
  assert.equal(buildVertices({ positions: [], faces: [] }).length, 0);
});
