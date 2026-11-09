import test from 'node:test';
import assert from 'node:assert/strict';
import { box, validate, reshape, extrudeFace, faceNormal } from './index.js';
import type { Vec3 } from './index.js';

const top = (m: ReturnType<typeof box>) => m.faces[4].v; // +y face of a box

test('a whole face moved along any direction stays one polygon, the mesh stays closed', () => {
  const b = box({ size: [2, 1, 1] });
  const moves = top(b).map((i) => [i, [b.positions[i][0] + 0.3, b.positions[i][1] + 0.5, b.positions[i][2]] as Vec3] as [number, Vec3]);
  const m = reshape(b, moves);
  assert.equal(m.faces.length, 6, 'no triangles: every face is still flat');
  assert.ok(validate(m).closed);
});

test('scaling a whole face keeps the side quads flat (a taper)', () => {
  const b = box({ size: [2, 2, 2] });
  const ids = top(b);
  const c: Vec3 = [0, 1, 0];
  const moves = ids.map((i) => [i, [c[0] + (b.positions[i][0] - c[0]) * 0.5, 1, c[2] + (b.positions[i][2] - c[2]) * 0.5] as Vec3] as [number, Vec3]);
  const m = reshape(b, moves);
  assert.equal(m.faces.length, 6);
  assert.ok(validate(m).closed && validate(m).ok, validate(m).notes.join('; '));
});

test('moving one corner bends the faces that use it: they become triangles', () => {
  const b = box({ size: [1, 1, 1] });
  const i = top(b)[0];
  const m = reshape(b, [[i, [b.positions[i][0], b.positions[i][1] + 0.4, b.positions[i][2]]]]);
  assert.ok(m.faces.length > 6);
  assert.ok(validate(m).closed);
});

test('extrude a face a hair and then drag its cap along the normal: the sides stay quads', () => {
  const b = box({ size: [2, 1, 1] });
  const e = extrudeFace(b, 4, { distance: 1e-4 }).mesh;
  const cap = e.faces[4].v;
  const n = faceNormal(cap.map((v) => e.positions[v]));
  const l = Math.hypot(...n);
  const moves = cap.map((v) => [v, [e.positions[v][0] + (n[0] / l) * 0.7, e.positions[v][1] + (n[1] / l) * 0.7, e.positions[v][2] + (n[2] / l) * 0.7] as Vec3] as [number, Vec3]);
  const m = reshape(e, moves);
  assert.equal(m.faces.length, 6 + 4, 'cap + 4 side quads + the 5 untouched faces: no triangles');
  assert.ok(validate(m).closed && validate(m).ok, validate(m).notes.join('; '));
  assert.ok(Math.abs((validate(m).volume ?? 0) - 3.4) < 1e-3, `volume ${validate(m).volume}`); // 2 + (2 x 0.7)
});
