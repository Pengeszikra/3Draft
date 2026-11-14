import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orbit, makeCamera, project } from './camera.js';
import type { Mesh } from './types.js';

const nothing: Mesh = { positions: [], faces: [] };
const fit = { center: [0, 0, 0] as [number, number, number], radius: 1, dist: 5 };

test('roll turns the picture round the view axis; the eye and the view direction stay', () => {
  const a = makeCamera(orbit({ yaw: 0.4, pitch: 0.2 }), nothing, 100, fit);
  const b = makeCamera(orbit({ yaw: 0.4, pitch: 0.2, roll: Math.PI / 2 }), nothing, 100, fit);
  assert.deepEqual(a.eye.map((v) => v.toFixed(9)), b.eye.map((v) => v.toFixed(9)));
  assert.deepEqual(a.f.map((v) => v.toFixed(9)), b.f.map((v) => v.toFixed(9)));
  // a point up on the screen without roll is on the left with a right bank of 90°
  const p: [number, number, number] = [a.u[0], a.u[1], a.u[2]];
  const qa = project(a, p), qb = project(b, p);
  assert.ok(qa.y < 50 && Math.abs(qa.x - 50) < 1e-6);
  assert.ok(qb.x < 50 && Math.abs(qb.y - 50) < 1e-6, JSON.stringify(qb));
});
