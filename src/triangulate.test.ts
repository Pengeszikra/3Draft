import test from 'node:test';
import assert from 'node:assert/strict';
import { box, triangulate, buildVertices, pick, makeCamera, project, faceNormal } from './index.js';
import type { Vec3, Mesh } from './index.js';

const area = (p: Vec3[], t: number[]) => {
  const n = faceNormal([p[t[0]], p[t[1]], p[t[2]]]);
  return Math.hypot(...n) / 2;
};
const signed = (p: Vec3[], t: number[], axis = 1) => {
  const [a, b, c] = t.map((i) => p[i]);
  const n = faceNormal([a, b, c]);
  return n[axis] / 2;
};
// a V seen from above (x, z), counter-clockwise from +y: the notch is between the arms
const V: Vec3[] = [[0, 0, 0], [1, 0, 0], [2, 0, 3], [3, 0, 3], [2, 0, 0], [1, 0, 3]].map(([x, y, z]) => [x, y, z] as Vec3);
const L: Vec3[] = [[0, 0, 0], [3, 0, 0], [3, 0, 1], [1, 0, 1], [1, 0, 3], [0, 0, 3]];

test('a convex polygon is a plain fan', () => {
  const sq: Vec3[] = [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]];
  assert.deepEqual(triangulate(sq), [[0, 1, 2], [0, 2, 3]]);
});

test('an L is cut into triangles that cover exactly its area, none outside', () => {
  const tris = triangulate(L);
  assert.equal(tris.length, L.length - 2);
  const total = tris.reduce((t, tri) => t + signed(L, tri), 0);
  const whole = faceNormal(L)[1] / 2;
  assert.ok(Math.abs(total - whole) < 1e-9, 'the pieces add up to the polygon');
  assert.ok(tris.every((t) => signed(L, t) * whole > 0), 'every triangle has the polygon winding (a fan from corner 0 would flip some)');
  assert.ok(Math.abs(whole) - 5 < 1e-9, 'L is 3 + 2 square units');
});

test('a reflex corner: no triangle covers the notch of the V', () => {
  const ring: Vec3[] = [[0, 0, 0], [1, 0, 0], [1.5, 0, 2], [2, 0, 0], [3, 0, 0], [1.5, 0, 4]]; // a thin crown with a notch
  const tris = triangulate(ring);
  const whole = faceNormal(ring)[1] / 2;
  const total = tris.reduce((t, tri) => t + signed(ring, tri), 0);
  assert.ok(Math.abs(total - whole) < 1e-9);
  assert.ok(tris.every((t) => signed(ring, t) * whole > 0));
});

test('buildVertices and pick use the clipped triangles of a concave face', () => {
  const mesh = { positions: L, faces: [{ v: [5, 4, 3, 2, 1, 0], color: '#aaaaaa' }] } as Mesh; // facing up
  const verts = buildVertices(mesh);
  assert.equal(verts.length / 14, (L.length - 2) * 3);
  const cam = makeCamera('top', mesh, 400);
  const at = (p: Vec3) => {
    const s = project(cam, p);
    return pick(mesh, cam, s.x, s.y, { cull: false });
  };
  assert.equal(at([2.5, 0, 2.5]), null, 'the empty corner of the L bounding box is not part of the face');
  assert.ok(at([0.5, 0, 2.5]), 'a point inside the arm is');
  assert.ok(at([2.5, 0, 0.5]), 'a point inside the foot is');
});

test('outlineOf follows the lines round an L (angle order would knot it) and through a junction', async () => {
  const { outlineOf } = await import('./index.js');
  const ring = L; // 6 points, the lines are the outline
  const lines = ring.map((_, i) => [i, (i + 1) % ring.length] as [number, number]);
  // shuffled order of the selection: the walk does not depend on it
  const out = outlineOf(ring, lines, [3, 0, 5, 1, 4, 2])!;
  assert.equal(out.length, 6);
  const cyc = out.join();
  assert.ok(cyc === '0,1,2,3,4,5' || cyc === '0,5,4,3,2,1' || [...out, ...out].join().includes('0,1,2,3,4,5') || [...out, ...out].join().includes('5,4,3,2,1,0'), `a walk round the outline, got ${cyc}`);
  // a bridge line across the L's corner (a junction): the walk must stay on the outline, the straightest way on
  const withBridge = [...lines, [2, 5] as [number, number]];
  const out2 = outlineOf(ring, withBridge, [0, 1, 2, 3, 4, 5])!;
  assert.ok(out2 && out2.length >= 3);
  assert.equal(outlineOf(ring, [[0, 1], [1, 2]], [0, 1, 2]), null, 'an open chain is no outline');
});

test('buildEdges lists every edge of the faces once', async () => {
  const { buildEdges } = await import('./index.js');
  const cube = box({ size: [1, 1, 1] });
  assert.equal(buildEdges(cube).length / 6, 12, 'a cube has 12 edges');
});

test('buildMarks: one instance per segment, a lone point is a zero-length segment, colour and opacity become rgba', async () => {
  const { buildMarks, MARK_FLOATS } = await import('./gpu.js');
  const out = buildMarks([
    { color: '#ff0000', width: 4, opacity: 0.5, lines: [[[0, 0, 0], [1, 0, 0], [1, 1, 0]], [[2, 2, 2], [2, 2, 2]]] },
    { lines: [[[3, 3, 3]]] },
  ]);
  assert.equal(out.length, 4 * MARK_FLOATS);
  assert.deepEqual([...out.subarray(0, 11)], [0, 0, 0, 1, 0, 0, 1, 0, 0, 0.5, 4]);
  assert.deepEqual([...out.subarray(MARK_FLOATS, MARK_FLOATS + 6)], [1, 0, 0, 1, 1, 0]);
  const last = out.subarray(3 * MARK_FLOATS);
  assert.deepEqual([...last.subarray(0, 6)], [3, 3, 3, 3, 3, 3]);
  assert.equal(last[10], 2);
});
