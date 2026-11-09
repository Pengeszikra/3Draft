import test from 'node:test';
import assert from 'node:assert/strict';
import { box, validate, saw, planeThroughLine, planeThroughTriangle, sectionSegments, union } from './index.js';
import type { Mesh } from './index.js';

const vol = (m: Mesh) => validate(m).volume ?? 0;
const plank = () => box({ size: [4, 1, 1], at: [0, 0, 0], color: '#a06a3c' });

test('a square cut across a plank gives two closed solids that add up to the plank', () => {
  const p = planeThroughLine([1, 0.5, 0.5], [1, 0.5, -0.5], [0, 1, 0]); // drawn across the top face, square to it
  const { front, back } = saw(plank(), p, { color: '#ffffff', mat: 'cut' });
  assert.equal(front.length, 1);
  assert.equal(back.length, 1);
  for (const m of [...front, ...back]) assert.ok(validate(m).closed && validate(m).ok, validate(m).notes.join('; '));
  const [a, b] = [Math.abs(vol(front[0])), Math.abs(vol(back[0]))].sort((x, y) => x - y);
  assert.ok(Math.abs(a - 1) < 1e-6 && Math.abs(b - 3) < 1e-6, `volumes ${a} ${b}`);
  assert.ok(front[0].faces.some((f) => f.mat === 'cut') && back[0].faces.some((f) => f.mat === 'cut'), 'the cut faces carry the saw material');
});

test('a slanted cut (a triangle on two faces) still gives two closed solids', () => {
  const p = planeThroughTriangle([1.5, 0.5, 0.5], [1.5, 0.5, -0.5], [0.5, -0.5, 0.5]);
  const { front, back } = saw(plank(), p);
  const total = [...front, ...back].reduce((t, m) => t + Math.abs(vol(m)), 0);
  assert.ok(Math.abs(total - 4) < 1e-6, `total ${total}`);
  for (const m of [...front, ...back]) assert.ok(validate(m).closed && validate(m).ok);
});

test('a cut through existing vertices (a mitre from corner to corner) works', () => {
  const p = planeThroughTriangle([-2, 0.5, 0.5], [-2, -0.5, -0.5], [2, 0.5, 0.5]); // diagonal plane through corner points
  const { front, back } = saw(plank(), p);
  const total = [...front, ...back].reduce((t, m) => t + Math.abs(vol(m)), 0);
  assert.ok(Math.abs(total - 4) < 1e-3, `total ${total}`);
  for (const m of [...front, ...back]) assert.ok(validate(m).closed);
});

test('a plane that misses the object throws', () => {
  assert.throws(() => saw(plank(), { point: [10, 0, 0], n: [1, 0, 0] }), /does not go through/);
});

test('an open mesh cannot be sawn', () => {
  const open = { positions: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] as [number, number, number][], faces: [{ v: [0, 1, 2] }] };
  assert.throws(() => saw(open, { point: [0.2, 0, 0], n: [1, 0, 0] }), /closed solid/);
});

test('a U shape cut across its arms gives two pieces on the arm side and one on the base side', () => {
  const base = box({ size: [5, 1, 1], at: [0, 0, 0] });
  const arm = (x: number) => box({ size: [1, 2, 1], at: [x, 1, 0] });
  const u = union(union(base, arm(-2)), arm(2));
  const { front, back } = saw(u, { point: [0, 1.2, 0], n: [0, 1, 0] }); // above the base: only the two arm tops
  assert.equal(front.length, 2);
  assert.equal(back.length, 1);
  for (const m of [...front, ...back]) assert.ok(validate(m).closed && validate(m).ok, validate(m).notes.join('; '));
});

test('planes from degenerate input throw', () => {
  assert.throws(() => planeThroughLine([0, 0, 0], [0, 1, 0], [0, 1, 0]), /cannot give a plane/);
  assert.throws(() => planeThroughTriangle([0, 0, 0], [1, 0, 0], [2, 0, 0]), /one line/);
});

test('sectionSegments outlines the cut: four segments for a square cut of a plank', () => {
  const segs = sectionSegments(plank(), { point: [1, 0, 0], n: [1, 0, 0] });
  assert.equal(segs.length, 4);
});
