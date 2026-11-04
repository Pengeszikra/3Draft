import test from 'node:test';
import assert from 'node:assert/strict';
import { box, validate, insertVertex, cutFace, moveVertex, fillLoop, addLine, findLoop, nearestSurface, wireFromSegments } from './index.js';

const cube = () => box({ size: [2, 2, 2], at: [0, 0, 0], color: '#ff0000' });
const topFace = (m: ReturnType<typeof cube>) => m.faces.findIndex((f) => f.v.every((v) => m.positions[v][1] > 0.99));

test('a vertex inside a face splits it into triangles and the cube stays closed', () => {
  const m = cube();
  const f = topFace(m);
  const r = insertVertex(m, f, [0.2, 1, 0.3]);
  assert.equal(r.index, m.positions.length);
  assert.equal(r.mesh.faces.length, m.faces.length - 1 + 4);
  const v = validate(r.mesh);
  assert.ok(v.closed && v.ok, v.notes.join('; '));
  assert.ok(Math.abs((v.volume ?? 0) - 8) < 1e-9, 'volume unchanged');
});

test('a vertex on an edge goes into both faces, no crack', () => {
  const m = cube();
  const f = topFace(m);
  const [a, b] = [m.faces[f].v[0], m.faces[f].v[1]];
  const mid = m.positions[a].map((c, i) => (c + m.positions[b][i]) / 2) as [number, number, number];
  const r = insertVertex(m, f, mid);
  const v = validate(r.mesh);
  assert.ok(v.closed, v.notes.join('; '));
  assert.equal(r.mesh.faces.filter((g) => g.v.includes(r.index)).length, 2);
  assert.equal(insertVertex(r.mesh, f, mid).index, r.index, 'a second time finds the same vertex');
});

test('a cut splits a face along the line between two vertices', () => {
  const m = cube();
  const f = topFace(m);
  const [a, , c] = m.faces[f].v;
  const r = cutFace(m, a, c);
  assert.ok(r.cut);
  assert.equal(r.mesh.faces.length, m.faces.length + 1);
  const v = validate(r.mesh);
  assert.ok(v.closed && v.ok, v.notes.join('; '));
  assert.equal(cutFace(m, m.faces[f].v[0], m.faces[f].v[1]).cut, false, 'neighbours are already an edge');
});

test('moving a vertex keeps every face planar', () => {
  const m = cube();
  const v0 = m.faces[topFace(m)].v[0];
  const moved = moveVertex(m, v0, [m.positions[v0][0], 1.8, m.positions[v0][2]]);
  assert.ok(validate(moved).nonPlanarFaces.length === 0);
  assert.ok(validate(moved).closed);
});

test('lines close into a face, wound away from the middle of the mesh', () => {
  const m = cube();
  const n = m.positions.length;
  const mesh = { ...m, positions: [...m.positions, [3, 0, 0], [3, 1, 0], [3, 0, 1]] as typeof m.positions };
  let wire = addLine([], n, n + 1);
  wire = addLine(wire, n + 1, n + 2);
  wire = addLine(wire, n + 2, n);
  assert.deepEqual(addLine(wire, n, n + 1), wire, 'no duplicate lines');
  const loop = findLoop(wire, [n, n + 1]);
  assert.equal(loop?.length, 3);
  const filled = fillLoop(mesh, loop as number[], { color: '#00ff00' });
  assert.equal(filled.faces.length, mesh.faces.length + 1);
  const last = filled.faces.at(-1) as { v: number[]; color?: string };
  assert.equal(last.color, '#00ff00');
  const p = last.v.map((v) => filled.positions[v]);
  const normal = [(p[1][1] - p[0][1]) * (p[2][2] - p[0][2]) - (p[1][2] - p[0][2]) * (p[2][1] - p[0][1])];
  assert.ok(normal[0] > 0, 'faces +x, away from the cube');
  assert.equal(findLoop([[0, 1], [1, 2]], [0, 1]), null, 'an open chain has no loop');
});

test('segments drawn near a surface become wire on it, ends in the air stay free', () => {
  const m = cube();
  assert.ok(nearestSurface(m, [0.3, 1.02, 0.1], 0.05), 'near the top');
  assert.equal(nearestSurface(m, [0.3, 1.5, 0.1], 0.05), null, 'too far');
  const r = wireFromSegments(m, [], [[[0.3, 1.01, 0.2], [-0.4, 1.0, 0.3]], [[-0.4, 1.0, 0.3], [-0.4, 2, 0.3]]], 0.05);
  assert.equal(r.wire.length, 2);
  assert.equal(r.mesh.positions.length, m.positions.length + 3, 'two on the surface, one in the air');
  const onTop = r.mesh.positions[m.positions.length];
  assert.ok(Math.abs(onTop[1] - 1) < 1e-9, 'the end was put on the surface');
  // the vertex shared by both segments is one vertex
  assert.equal(new Set(r.wire.flat()).size, 3);
});
