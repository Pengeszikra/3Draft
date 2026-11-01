import test from 'node:test';
import assert from 'node:assert/strict';
import { box, merge, rotate, bounds, faceNormal, makeCamera, pick, standOn } from './index.js';
import { dot, norm, sub, len } from './vec.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const nearV = (a, b, eps = 1e-9) => a.every((v, i) => near(v, b[i], eps));
const range = (mesh, axis) => {
  const v = mesh.positions.map((p) => p[axis]);
  return [Math.min(...v), Math.max(...v)];
};

const cube = box();
const topHit = () => pick(cube, makeCamera('top', cube, 400), 200, 200);

test('box with axes: a turned box keeps its shape and outward normals', () => {
  const s = Math.SQRT1_2;
  const b = box({ size: [2, 1, 3], at: [1, 2, 3], axes: [[s, 0, -s], [0, 1, 0], [s, 0, s]] });
  const { center } = bounds(b);
  assert.ok(nearV(center, [1, 2, 3]));
  for (const f of b.faces) {
    const pts = f.v.map((i) => b.positions[i]);
    const c = pts.reduce((a, p) => a.map((v, k) => v + p[k] / pts.length), [0, 0, 0]);
    assert.ok(dot(faceNormal(pts), sub(c, center)) > 0, 'normal points inward');
  }
  assert.ok(near(len(sub(b.positions[1], b.positions[0])), 2), 'x extent kept');
});

test('standOn: a prism on top of a cube, height is three times the base', () => {
  const hit = topHit();
  assert.equal(hit.face, 4);
  const p = standOn(cube, hit, { base: 0.15 });
  assert.equal(p.positions.length, 8);
  assert.equal(p.faces.length, 6);
  const [y0, y1] = range(p, 1);
  assert.ok(near(y0, 0.5) && near(y1, 0.95), 'rises from the surface');
  assert.ok(near(y1 - y0, 3 * 0.15));
  const [x0, x1] = range(p, 0);
  const [z0, z1] = range(p, 2);
  assert.ok(near(x1 - x0, 0.15) && near(z1 - z0, 0.15), 'square base');
  assert.ok(near((x0 + x1) / 2, 0) && near((z0 + z1) / 2, 0), 'centered on the hit point');
});

test('standOn: default base is 0.15 (the table leg), height follows the base', () => {
  const p = standOn(cube, topHit());
  assert.ok(near(range(p, 0)[1] - range(p, 0)[0], 0.15));
  assert.ok(near(range(p, 1)[1] - range(p, 1)[0], 0.45));
  const q = standOn(cube, topHit(), { base: 0.2 });
  assert.ok(near(range(q, 1)[1] - range(q, 1)[0], 0.6));
  const r = standOn(cube, topHit(), { base: 0.2, height: 1 });
  assert.ok(near(range(r, 1)[1] - range(r, 1)[0], 1));
});

test('standOn: on a vertical face the prism sticks out along the normal', () => {
  const hit = pick(cube, makeCamera('front', cube, 400), 200, 200);
  assert.equal(hit.face, 0); // +z
  const p = standOn(cube, hit);
  const [z0, z1] = range(p, 2);
  assert.ok(near(z0, 0.5) && near(z1, 0.95));
});

test('standOn: the prism is outward-facing and its base lies in the surface plane', () => {
  const hit = topHit();
  const p = standOn(cube, hit);
  const { center } = bounds(p);
  for (const f of p.faces) {
    const pts = f.v.map((i) => p.positions[i]);
    const c = pts.reduce((a, q) => a.map((v, k) => v + q[k] / pts.length), [0, 0, 0]);
    assert.ok(dot(faceNormal(pts), sub(c, center)) > 0);
  }
  const onPlane = p.positions.filter((q) => near(dot(hit.normal, sub(q, hit.point)), 0));
  assert.equal(onPlane.length, 4, 'four base points on the surface');
});

test('standOn: the sides line up with the face edge of a turned object', () => {
  const turned = rotate(cube, { yaw: 0.3 }, bounds(cube).center);
  const hit = pick(turned, makeCamera('top', turned, 400, bounds(cube)), 200, 200);
  const [a, b] = turned.faces[hit.face].v;
  const edge = norm(sub(turned.positions[b], turned.positions[a]));
  const p = standOn(turned, hit);
  const side = norm(sub(p.positions[1], p.positions[0]));
  assert.ok(near(Math.abs(dot(edge, side)), 1, 1e-9));
});

test('merge keeps a placed prism pickable: the next ray hits its top', () => {
  const hit = topHit();
  const scene = merge(cube, standOn(cube, hit));
  const again = pick(scene, makeCamera('top', scene, 400), 200, 200);
  assert.equal(again.face, 6 + 4, 'the prism top face (local +y), not the cube');
  assert.ok(near(again.point[1], 0.95));
});
