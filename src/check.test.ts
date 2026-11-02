import test from 'node:test';
import assert from 'node:assert/strict';
import { box, extrude, merge, validate } from './index.js';

const flip = (m) => ({ ...m, faces: m.faces.map((f) => ({ ...f, v: [...f.v].reverse() })) });

test('a box is a closed, outward, convex solid', () => {
  const r = validate(box({ size: [2, 3, 4] }));
  assert.equal(r.ok, true);
  assert.equal(r.closed, true);
  assert.equal(r.inside_out, false);
  assert.ok(Math.abs(r.volume - 24) < 1e-9);
  assert.deepEqual(r.notes, []);
});

test('a box without its top face is open but otherwise fine', () => {
  const b = box();
  const r = validate({ ...b, faces: b.faces.filter((_, i) => i !== 4) });
  assert.equal(r.closed, false);
  assert.equal(r.openEdges, 4);
  assert.equal(r.ok, true);
});

test('inside-out faces are reported', () => {
  const r = validate(flip(box()));
  assert.equal(r.inside_out, true);
  assert.equal(r.ok, false);
  assert.match(r.notes.join(' '), /point inward/);
});

test('a twisted quad is non-planar, a dart is non-convex, a sliver is degenerate', () => {
  const quad = (pts) => ({ positions: pts, faces: [{ v: [0, 1, 2, 3] }] });
  assert.deepEqual(validate(quad([[0, 0, 0], [1, 0, 0], [1, 1, 0.5], [0, 1, 0]])).nonPlanarFaces, [0]);
  assert.deepEqual(validate(quad([[0, 0, 0], [2, 0, 0], [0.5, 0.5, 0], [0, 2, 0]])).nonConvexFaces, [0]);
  assert.deepEqual(validate(quad([[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]])).degenerateFaces, [0]);
});

test('extrude: a triangle and a hexagon give closed outward prisms, whatever the winding', () => {
  const tri = [[0, 0], [0, 1], [1, 0]];
  const hex = Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)]);
  for (const polygon of [tri, [...tri].reverse(), hex, [...hex].reverse()]) {
    const m = extrude({ polygon: polygon as [number, number][], height: 2, y: 1 });
    const r = validate(m);
    assert.equal(r.ok, true, r.notes.join('; '));
    assert.equal(r.closed, true);
    assert.equal(m.faces.length, polygon.length + 2);
    assert.ok(r.volume > 0);
  }
  assert.ok(Math.abs(validate(extrude({ polygon: tri as [number, number][], height: 2 })).volume! - 1) < 1e-9, 'area 0.5 x height 2');
});

test('extrude rejects bad footprints', () => {
  assert.throws(() => extrude({ polygon: [[0, 0], [1, 1]] }), /at least 3/);
  assert.throws(() => extrude({ polygon: [[0, 0], [1, 1], [2, 2]] }), /no area/);
  assert.throws(() => extrude({ polygon: [[0, 0], [2, 0], [0.5, 0.5], [0, 2]] }), /convex/);
  assert.throws(() => extrude({ polygon: [[0, 0], [1, 0], [0, 1]], height: 0 }), /positive/);
});

test('merged solids stay valid as separate shells', () => {
  assert.equal(validate(merge(box(), box({ at: [3, 0, 0] }))).closed, true);
});
