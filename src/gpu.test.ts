import test from 'node:test';
import assert from 'node:assert/strict';
import { box, merge, makeCamera, orbit, project, bounds } from './index.js';
import type { ViewName } from './index.js';
import { viewProjection, buildVertices, buildInstances, cornerNormals } from './gpu.js';

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
      const cam = makeCamera(view as ViewName, scene, size, fit);
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
    const cam = makeCamera(view as ViewName, box(), 400);
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
  assert.equal(v.length, 6 * 2 * 3 * 14, '6 quads = 12 triangles = 36 vertices');
  // first face is +z: normal (0,0,1), color (1, 0.502, 0)
  assert.deepEqual([...v.slice(3, 6)], [0, 0, 1]);
  assert.ok(Math.abs(v[7] - 128 / 255) < 1e-6 && v[6] === 1 && v[8] === 0);
  // every normal points away from the box center
  for (let i = 0; i < v.length; i += 14) {
    const out = v[i] * v[i + 3] + v[i + 1] * v[i + 4] + v[i + 2] * v[i + 5];
    assert.ok(out > 0, 'normal points outwards');
  }
});

test('buildVertices: an empty mesh gives no vertices', () => {
  assert.equal(buildVertices({ positions: [], faces: [] }).length, 0);
});

test('buildInstances: 15 floats per copy, position, frame, color', () => {
  const d = buildInstances([{ at: [1, 2, 3], axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], color: '#ff0000' }, { at: [0, 0, 0], axes: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], color: '#00ff00' }]);
  assert.equal(d.length, 30);
  assert.deepEqual([...d.slice(0, 12)], [1, 2, 3, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.deepEqual([...d.slice(12, 15)], [1, 0, 0]);
  assert.deepEqual([...d.slice(24, 27)], [-1, 0, 0]);
});

test('an eye distance override moves the perspective eye (first person)', () => {
  const m = box();
  const near = makeCamera(orbit({ yaw: 0.3, pitch: 0.2 }), m, 400, { center: [0, 0, 0], radius: 1, dist: 0.05 });
  const far = makeCamera(orbit({ yaw: 0.3, pitch: 0.2 }), m, 400, { center: [0, 0, 0], radius: 1 });
  assert.ok(Math.hypot(...near.eye) - 0.05 < 1e-9);
  assert.ok(Math.hypot(...far.eye) > 1);
});

test('smooth shading: shallow folds share normals, sharp corners stay sharp', () => {
  // a box: every edge is 90 degrees, nothing is smoothed at 40 degrees
  const cube = box({ size: [1, 1, 1] });
  const flat = cornerNormals(cube, 40);
  cube.faces.forEach((f, i) => {
    const n = buildVertices({ ...cube, faces: [f] }).slice(3, 6);
    flat[i].forEach((c) => c.forEach((v, k) => assert.ok(Math.abs(v - n[k]) < 1e-6)));
  });
  // two quads folded by 30 degrees (a flat gable): the ridge vertices get the average, the outer ones keep their face normal
  const a = Math.PI / 12; // each side tilts 15 degrees: 30 between them
  const mesh = {
    positions: [[-1, 0, -1], [0, Math.tan(a), -1], [0, Math.tan(a), 1], [-1, 0, 1], [1, 0, -1], [1, 0, 1]],
    faces: [{ v: [0, 3, 2, 1] }, { v: [1, 2, 5, 4] }],
  };
  const smooth = cornerNormals(mesh as never, 40);
  assert.ok(Math.abs(smooth[0][2][0]) < 1e-6 && smooth[0][2][1] > 0.99, 'the ridge point: straight up');
  assert.ok(Math.abs(smooth[0][0][0] + Math.sin(a)) < 1e-6, 'the outer point keeps its own tilt');
  const sharp = cornerNormals(mesh as never, 20);
  assert.ok(Math.abs(sharp[0][2][0] + Math.sin(a)) < 1e-6, 'under the crease angle: flat again');
  // a material with soft 0 keeps its edges hard even when smoothing is on; soft 0.5 smooths them
  const hard = buildVertices({ ...mesh, faces: mesh.faces.map((f) => ({ ...f, mat: 'wood' })) } as never, { wood: { color: '#aa7744' } } as never, { smooth: 40 });
  const softer = buildVertices({ ...mesh, faces: mesh.faces.map((f) => ({ ...f, mat: 'skin' })) } as never, { skin: { color: '#e0a080', soft: 0.5 } } as never, { smooth: 40 });
  const ridgeY = (v: Float32Array) => v[2 * 14 + 4]; // the ridge point of the first triangle: its normal's y
  assert.ok(Math.abs(ridgeY(hard) - Math.cos(a)) < 1e-5, 'soft 0: the ridge stays a hard edge');
  assert.ok(ridgeY(softer) > 0.999, 'soft 0.5: the ridge is smoothed');
  // and buildVertices carries it: 14 floats per vertex, the normal at 3..5
  const v = buildVertices(mesh as never, undefined, { smooth: 40 });
  assert.equal(v.length % 14, 0);
});

test('buildSkinVertices: the 14 floats of buildVertices, then the four strongest joints with weights adding to 1', async () => {
  const { buildSkinVertices, buildVertices, SKIN_FLOATS, splitGlass } = await import('./gpu.js');
  const { box } = await import('./mesh.js');
  const m = box();
  const weights = m.positions.map((_, i): [number, number][] => [[1, 0.1], [2, 0.5], [3, 0.2], [4, 0.1], [5, 0.1 + i * 0.001]]);
  const s = buildSkinVertices([m], [weights]);
  const v = buildVertices(m);
  assert.equal(s.length / SKIN_FLOATS, v.length / 14);
  for (let k = 0; k < v.length / 14; k++) {
    for (let f = 0; f < 14; f++) assert.equal(s[k * SKIN_FLOATS + f], v[k * 14 + f]);
    const w = s.subarray(k * SKIN_FLOATS + 18, k * SKIN_FLOATS + 22);
    assert.ok(Math.abs(w[0]! + w[1]! + w[2]! + w[3]! - 1) < 1e-6);
    assert.equal(s[k * SKIN_FLOATS + 14], 2); // the strongest joint first
  }
  assert.throws(() => buildSkinVertices([m], [weights.slice(1)]), /weights know/);
  assert.equal(splitGlass(s, SKIN_FLOATS).solid.length, s.length);
});

test('nearPlane of an empty scene is the usual one, not infinity (a scene that is only a skin)', async () => {
  const { nearPlane } = await import('./gpu.js');
  const { makeCamera } = await import('./camera.js');
  const cam = makeCamera('persp', { positions: [[0, 0, 0]], faces: [] }, 100);
  assert.equal(nearPlane(cam, { positions: [] }), 0.03);
});

test('buildScreenQuads: two triangles per screen, corners TL TR BR BL with their part of the picture', async () => {
  const { buildScreenQuads, SCREEN_FLOATS } = await import('./gpu.js');
  const corners: [number, number, number][] = [[-1, 1, 0], [1, 1, 0], [1, -1, 0], [-1, -1, 0]];
  const q = buildScreenQuads([{ corners: corners as any, source: null }, { corners: corners as any, source: null, uv: [0, 0.25, 1, 0.75] }]);
  assert.equal(q.length, 2 * 6 * SCREEN_FLOATS);
  const vert = (i: number) => Array.from(q.subarray(i * SCREEN_FLOATS, (i + 1) * SCREEN_FLOATS));
  assert.deepEqual(vert(0), [-1, 1, 0, 0, 0]); // top left, top of the picture
  assert.deepEqual(vert(2), [1, -1, 0, 1, 1]); // bottom right
  assert.deepEqual(vert(6), [-1, 1, 0, 0, 0.25]); // the second screen shows the middle band
  assert.deepEqual(vert(8), [1, -1, 0, 1, 0.75]);
});
