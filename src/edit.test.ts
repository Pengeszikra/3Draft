import test from 'node:test';
import assert from 'node:assert/strict';
import { box, extrude, extrudeFace, moveVertices, validate, faceNormal } from './index.js';

const TOP = 4; // box face order: +z, -z, +x, -x, +y, -y
const vol = (m) => validate(m).volume;
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('extrude a face outwards: a taller prism, still a closed outward solid', () => {
  const { mesh, cap, sides } = extrudeFace(box({ size: [2, 1, 3] }), TOP, { distance: 2 });
  const r = validate(mesh);
  assert.equal(r.ok, true, r.notes.join('; '));
  assert.equal(r.closed, true);
  assert.ok(near(r.volume, 2 * 1 * 3 + 2 * 3 * 2), 'old volume + area x distance');
  assert.equal(cap, TOP);
  assert.equal(sides.length, 4);
  assert.equal(mesh.faces.length, 6 + 4);
});

test('taper: a frustum, volume matches the formula', () => {
  const { mesh } = extrudeFace(box({ size: [2, 1, 2] }), TOP, { distance: 1.5, scale: 0.5 });
  const r = validate(mesh);
  assert.equal(r.ok, true, r.notes.join('; '));
  const a = 4; // base area
  const frustum = (1.5 / 3) * (a + a * 0.25 + Math.sqrt(a * a * 0.25));
  assert.ok(near(r.volume, 2 * 1 * 2 + frustum));
});

test('inset keeps the volume, a negative distance digs a dent', () => {
  const b = box({ size: [2, 1, 2] });
  const inset = extrudeFace(b, TOP, { scale: 0.5 }).mesh;
  assert.ok(validate(inset).ok);
  assert.ok(near(vol(inset), 4));
  const dent = extrudeFace(inset, TOP, { distance: -0.4 }).mesh;
  const r = validate(dent);
  assert.equal(r.ok, true, r.notes.join('; '));
  assert.ok(near(r.volume, 4 - 1 * 0.4), 'the 1x1 inset square is dug 0.4 deep');
});

test('the cap keeps the face normal, the side quads face away from the axis', () => {
  const b = box();
  const { mesh, cap, sides } = extrudeFace(b, TOP, { distance: 1 });
  const n = (i) => faceNormal(mesh.faces[i].v.map((k) => mesh.positions[k]));
  assert.ok(n(cap)[1] > 0, 'cap points up');
  for (const s of sides) assert.ok(Math.abs(n(s)[1]) < 1e-9, 'side quads are vertical');
});

test('extrusions chain on the cap, colors follow the face or the argument', () => {
  const b = box({ color: '#112233' });
  const a = extrudeFace(b, TOP, { distance: 1, scale: 0.6 });
  const c = extrudeFace(a.mesh, a.cap, { distance: 0.5, scale: 0.5, color: '#ff0000' });
  assert.ok(validate(c.mesh).ok);
  assert.equal(c.mesh.faces[c.cap].color, '#ff0000');
  assert.equal(a.mesh.faces[a.sides[0]].color, '#112233');
});

test('works on a roof: a prism face and a triangle face', () => {
  const prism = extrude({ polygon: [[0, 0], [2, 0], [1, 1.5]], height: 1 });
  assert.ok(validate(extrudeFace(prism, 0, { distance: 1, scale: 0.3 }).mesh).ok, 'top triangle');
  assert.ok(validate(extrudeFace(prism, 2, { distance: 0.5 }).mesh).ok, 'a side quad');
});

test('bad edits are refused with a reason', () => {
  const b = box();
  assert.throws(() => extrudeFace(b, 9, { distance: 1 }), /no face 9/);
  assert.throws(() => extrudeFace(b, 0, { scale: 0 }), /positive/);
  assert.throws(() => extrudeFace(b, 0, {}), /nothing to do/);
});

test('moveVertices: shear the top of a box, planarity is reported by validate', () => {
  const b = box();
  const top = [...new Set(b.faces[TOP].v)];
  const sheared = moveVertices(b, top, [0.5, 0, 0]);
  assert.ok(validate(sheared).ok, 'moving a whole face together stays planar');
  assert.deepEqual(b.positions[top[0]], box().positions[top[0]], 'the input is not modified');
  const warped = moveVertices(b, [top[0]], [0, 0.5, 0]);
  assert.ok(validate(warped).nonPlanarFaces.length > 0);
  assert.throws(() => moveVertices(b, [99], [0, 0, 0]), /vertex 99/);
});
