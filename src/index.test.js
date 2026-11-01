import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  name,
  version,
  info,
  box,
  merge,
  rotate,
  makeCamera,
  bounds,
  faceNormal,
  faceCenter,
  VIEW_ORDER,
  renderView,
  renderViews,
  renderSheet,
} from './index.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const count = (s, re) => (s.match(re) ?? []).length;

test('exported name and version match package.json', () => {
  assert.equal(name, pkg.name);
  assert.equal(version, pkg.version);
});

test('info() describes the package', () => {
  const i = info();
  assert.equal(i.name, '3draft');
  assert.equal(i.stage, 'pre-alpha');
  assert.ok(i.goals.length > 0);
});

test('box: 8 points, 6 faces, all normals point outward', () => {
  const b = box({ size: [2, 1, 3], at: [1, 2, 3] });
  assert.equal(b.positions.length, 8);
  assert.equal(b.faces.length, 6);
  const { center } = bounds(b);
  for (const f of b.faces) {
    const pts = f.v.map((i) => b.positions[i]);
    const n = faceNormal(pts);
    const c = faceCenter(pts);
    const out = n[0] * (c[0] - center[0]) + n[1] * (c[1] - center[1]) + n[2] * (c[2] - center[2]);
    assert.ok(out > 0, `face ${f.v} points inward`);
  }
});

test('merge re-indexes faces', () => {
  const m = merge(box(), box({ at: [2, 0, 0] }));
  assert.equal(m.positions.length, 16);
  assert.equal(m.faces.length, 12);
  assert.ok(m.faces.slice(6).every((f) => f.v.every((i) => i >= 8 && i < 16)));
});

test('orthographic views of a cube show exactly one face and four points', () => {
  for (const view of ['front', 'side', 'top']) {
    const svg = renderView(box(), view);
    assert.equal(count(svg, /<polygon/g), 1, `${view} faces`);
    assert.equal(count(svg, /<circle/g), 4, `${view} points`);
  }
});

test('perspective view of a cube shows three faces and seven points', () => {
  const svg = renderView(box(), 'persp');
  assert.equal(count(svg, /<polygon/g), 3);
  assert.equal(count(svg, /<circle/g), 7);
});

test('cull: false draws every face', () => {
  assert.equal(count(renderView(box(), 'front', { cull: false }), /<polygon/g), 6);
});

test('renderViews returns the four views in order', () => {
  const views = renderViews(box());
  assert.deepEqual(views.map((v) => v.name), [...VIEW_ORDER]);
  assert.ok(views.every((v) => v.svg.startsWith('<svg')));
});

test('renderSheet has four panels and is deterministic', () => {
  const mesh = merge(box(), box({ size: [0.5, 0.5, 0.5], at: [1.2, 0.2, 0.3] }));
  const a = renderSheet(mesh);
  const b = renderSheet(mesh);
  assert.equal(a, b);
  const order = [...a.matchAll(/data-view="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(order, [...VIEW_ORDER]);
  assert.ok(!/NaN|Infinity/.test(a));
});

test('points of a hidden face are drawn before the face that covers them', () => {
  const far = box({ at: [0, 0, -2] }); // faces 0-5, points 0-7
  const near = box({ at: [0, 0, 2] }); // faces 6-11, points 8-15
  const svg = renderView(merge(far, near), 'front');
  const at = (s) => svg.indexOf(s);
  assert.ok(at('data-v="4"') < at('data-face="6"'), 'far point must be under the near face');
  assert.ok(at('data-v="12"') > at('data-face="6"'), 'near point must be over its own face');
});

test('rotate keeps the mesh intact: same radius, outward normals, identity at 0', () => {
  const b = box({ size: [2, 1, 3], at: [1, 2, 3] });
  const { center, radius } = bounds(b);
  const r = rotate(b, { yaw: 0.7, pitch: -0.4 }, center);
  const d = (p) => Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2]);
  assert.ok(r.positions.every((p, i) => Math.abs(d(p) - d(b.positions[i])) < 1e-9));
  assert.ok(Math.abs(radius - Math.max(...r.positions.map(d))) < 1e-9);
  for (const f of r.faces) {
    const pts = f.v.map((i) => r.positions[i]);
    const n = faceNormal(pts);
    const c = faceCenter(pts);
    assert.ok(n[0] * (c[0] - center[0]) + n[1] * (c[1] - center[1]) + n[2] * (c[2] - center[2]) > 0);
  }
  const same = rotate(b, {}, center);
  assert.ok(same.positions.every((p, i) => p.every((v, a) => Math.abs(v - b.positions[i][a]) < 1e-12)));
});

test('yaw of 90 degrees turns +z towards +x', () => {
  const m = { positions: [[0, 0, 1]], faces: [] };
  const [p] = rotate(m, { yaw: Math.PI / 2 }, [0, 0, 0]).positions;
  assert.ok(Math.abs(p[0] - 1) < 1e-9 && Math.abs(p[2]) < 1e-9);
});

test('custom view spec renders, and fit keeps the framing while the mesh rotates', () => {
  const b = box();
  const fit = bounds(b);
  const spec = { name: 'orbit', dir: [0, 0, 1], up: [0, 1, 0], ortho: false };
  const svg = renderView(rotate(b, { yaw: 0.5, pitch: 0.3 }, fit.center), spec, { fit });
  assert.ok(svg.includes('data-view="orbit"'));
  assert.ok(!/NaN|Infinity/.test(svg));
  const a = makeCamera(spec, b, 400, fit);
  const c = makeCamera(spec, rotate(b, { yaw: 1 }, fit.center), 400, fit);
  assert.deepEqual(a, c);
});

test('unknown view name throws', () => {
  assert.throws(() => renderView(box(), 'nope'), /unknown view/);
});

test('painter order: farther faces are drawn first', () => {
  const near = box({ at: [0, 0, 2] });
  const far = box({ at: [0, 0, -2] });
  const svg = renderView(merge(far, near), 'front');
  const depths = [...svg.matchAll(/data-depth="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(depths, [...depths].sort((x, y) => y - x));
});
