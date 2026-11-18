import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createScene } from './scene.js';

const json = (r) => JSON.parse(r.text);
const ok = (scene, tool, args) => {
  const r = scene.call(tool, args);
  assert.equal(r.isError, false, `${tool}: ${r.text}`);
  return r;
};

const table = (scene) => {
  ok(scene, 'add_box', { name: 'top', size: [2, 0.15, 1.2], at: [0, 0.925, 0], color: '#c8a27a' });
  for (const [n, x, z] of [['leg_a', -0.85, -0.45], ['leg_b', 0.85, -0.45], ['leg_c', -0.85, 0.45], ['leg_d', 0.85, 0.45]]) {
    ok(scene, 'add_box', { name: n, size: [0.15, 0.85, 0.15], at: [x, 0.425, z], color: '#8a6a4a' });
  }
};

test('tools/list: every tool has a name, a description and an object schema', () => {
  const list = createScene().list();
  assert.ok(list.length >= 10);
  for (const t of list) {
    assert.match(t.name, /^[a-z_]+$/);
    assert.ok(t.description.length > 10, t.name);
    assert.equal(t.inputSchema.type, 'object');
  }
  assert.equal(new Set(list.map((t) => t.name)).size, list.length);
});

test('build a table, list it, render it', () => {
  const s = createScene();
  table(s);
  const listed = json(ok(s, 'list'));
  assert.equal(listed.objects.length, 5);
  assert.deepEqual(listed.scene.min, [-1, 0, -0.6]);
  assert.deepEqual(listed.scene.max, [1, 1, 0.6]);
  const svg = ok(s, 'render', {}).text;
  assert.match(svg, /^<svg /);
  assert.equal(svg.match(/data-view="/g).length, 4, 'a sheet has four views');
  const one = ok(s, 'render', { view: 'orbit', yaw: 40, pitch: 30, size: 200 }).text;
  assert.match(one, /data-view="orbit"/);
  assert.ok(one.match(/<polygon/g).length >= 10);
});

test('render is deterministic', () => {
  const a = createScene();
  const b = createScene();
  table(a);
  table(b);
  assert.equal(ok(a, 'render', { view: 'persp' }).text, ok(b, 'render', { view: 'persp' }).text);
});

test('names: duplicates need replace, unknown names are reported', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'a' });
  assert.match(s.call('add_box', { name: 'a' }).text, /already exists/);
  ok(s, 'add_box', { name: 'a', size: [2, 2, 2], replace: true });
  assert.match(s.call('remove', { name: 'nope' }).text, /no object named "nope"/);
  assert.equal(s.call('add_box', { name: 'a' }).isError, true);
});

test('bad input is an error result with a reason, never a crash', () => {
  const s = createScene();
  for (const [tool, args, re] of [
    ['add_box', { name: 'x', size: [1, 2] }, /size must be/],
    ['add_box', { name: 'x', color: 'red' }, /color must be/],
    ['add_box', {}, /name must be/],
    ['add_extrusion', { name: 'x', polygon: [[0, 0], [1, 0]], height: 1 }, /polygon must be/],
    ['add_extrusion', { name: 'x', polygon: [[0, 0], [2, 0], [0.5, 0.5], [0, 2]], height: 1 }, /convex/],
    ['add_mesh', { name: 'x', positions: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [{ v: [0, 1, 7] }] }, /index 7/],
    ['pick', { x: 1, y: 1, view: 'sheet' }, /single view/],
    ['render', { view: 'sideways' }, /unknown view/],
    ['nope', {}, /unknown tool/],
  ]) {
    const r = s.call(tool, args);
    assert.equal(r.isError, true, tool);
    assert.match(r.text, re, tool);
  }
  assert.equal(s.call('add_box', 'not an object').isError, true);
});

test('add_extrusion and add_mesh give valid solids', () => {
  const s = createScene();
  ok(s, 'add_extrusion', { name: 'roof', polygon: [[-1, -1], [1, -1], [0, 1]], height: 0.5, y: 2, color: '#a33' });
  ok(s, 'add_mesh', {
    name: 'tetra',
    positions: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]],
    faces: [{ v: [0, 1, 2] }, { v: [0, 3, 1] }, { v: [1, 3, 2] }, { v: [2, 3, 0] }],
    color: '#38c',
  });
  const r = json(ok(s, 'inspect'));
  assert.deepEqual(r.checked.map((c) => [c.name, c.ok, c.closed]), [['roof', true, true], ['tetra', true, true]]);
});

test('inspect points out a mesh wound the wrong way', () => {
  const s = createScene();
  ok(s, 'add_mesh', {
    name: 'inside_out',
    positions: [[0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]],
    faces: [{ v: [2, 1, 0] }, { v: [1, 3, 0] }, { v: [2, 3, 1] }, { v: [0, 3, 2] }],
  });
  const c = json(ok(s, 'inspect', { name: 'inside_out' })).checked[0];
  assert.equal(c.ok, false);
  assert.match(c.notes.join(' '), /point inward/);
});

test('transform: scale, rotate, move', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'b', size: [2, 1, 1], at: [0, 0.5, 0] });
  ok(s, 'transform', { name: 'b', rotate_y: 90 });
  let o = json(ok(s, 'list')).objects[0];
  assert.deepEqual([o.min, o.max], [[-0.5, 0, -1], [0.5, 1, 1]]);
  ok(s, 'transform', { name: 'b', scale: [1, 2, 1], move: [10, 0, 0] });
  o = json(ok(s, 'list')).objects[0];
  assert.deepEqual([o.min, o.max], [[9.5, -0.5, -1], [10.5, 1.5, 1]]);
  assert.match(s.call('transform', { name: 'b', scale: -1 }).text, /positive/);
});

test('recolor: a whole object or one face', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'b', color: '#111111' });
  ok(s, 'recolor', { name: 'b', color: '#ff0000', face: 4 });
  const svg = ok(s, 'render', { view: 'persp' }).text;
  assert.match(svg, /fill="#ff0000"/);
  assert.match(svg, /fill="#111111"/);
  ok(s, 'recolor', { name: 'b', color: '#00ff00' });
  assert.doesNotMatch(ok(s, 'render', { view: 'persp' }).text, /#111111|#ff0000/);
  assert.match(s.call('recolor', { name: 'b', color: '#fff', face: 99 }).text, /face must be/);
});

test('pick names the object under a pixel and agrees with render', () => {
  const s = createScene();
  table(s);
  const hit = json(ok(s, 'pick', { view: 'top', x: 160, y: 160 })).hit;
  assert.equal(hit.object, 'top');
  assert.deepEqual(hit.normal, [0, 1, 0]);
  assert.ok(Math.abs(hit.point[1] - 1) < 1e-9, 'the slab top is at y = 1');
  assert.equal(json(ok(s, 'pick', { view: 'top', x: 2, y: 2 })).hit, null);
  // a leg seen from the front, near its bottom
  const leg = json(ok(s, 'pick', { view: 'side', x: 115, y: 190 })).hit;
  assert.match(leg.object, /^leg_/);
});

test('remove and clear', () => {
  const s = createScene();
  table(s);
  ok(s, 'remove', { name: 'leg_a' });
  assert.equal(json(ok(s, 'list')).objects.length, 4);
  assert.equal(json(ok(s, 'clear')).removed, 4);
  assert.deepEqual(json(ok(s, 'list')), { objects: [], scene: null });
  assert.match(ok(s, 'render', {}).text, /^<svg /, 'an empty scene still renders');
});

test('export and import round-trip, in memory and through a file', () => {
  const dir = mkdtempSync(join(tmpdir(), '3draft-'));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    const a = createScene();
    table(a);
    const want = ok(a, 'render', { view: 'persp' }).text;

    const b = createScene();
    ok(b, 'import', { json: ok(a, 'export', {}).text });
    assert.equal(ok(b, 'render', { view: 'persp' }).text, want);

    ok(a, 'export', { path: 'scene.json' });
    assert.ok(existsSync(join(dir, 'scene.json')));
    const c = createScene();
    ok(c, 'import', { path: 'scene.json' });
    assert.equal(ok(c, 'render', { view: 'persp' }).text, want);

    assert.match(a.call('export', { path: '../evil.json' }).text, /inside the server working directory/);
    assert.match(a.call('export', { path: '/etc/evil.json' }).text, /inside the server working directory/);
    assert.match(a.call('export', { path: 'scene.txt' }).text, /\.json/);
    assert.match(c.call('import', { json: '{"format":"nope"}' }).text, /not a 3draft scene/);
    assert.match(c.call('import', {}).text, /exactly one/);
    assert.equal(json(ok(c, 'list')).objects.length, 5, 'a failed import leaves the scene alone');
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('get_mesh, extrude_face and move_vertices shape an object', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'tower', size: [2, 3, 2], at: [0, 1.5, 0], color: '#cccccc' });
  const m = json(ok(s, 'get_mesh', { name: 'tower' }));
  assert.equal(m.vertices.length, 8);
  assert.equal(m.faces.length, 6);
  const top = m.faces.find((f) => f.normal[1] === 1);
  assert.deepEqual(top.center, [0, 3, 0]);

  const roof = json(ok(s, 'extrude_face', { name: 'tower', face: top.i, distance: 1.2, scale: 0.05, color: '#aa3333' }));
  assert.equal(roof.ok, true, roof.notes.join('; '));
  assert.equal(roof.cap_face, top.i);
  assert.equal(roof.side_faces.length, 4);
  assert.equal(roof.max[1], 4.2);

  const dent = json(ok(s, 'extrude_face', { name: 'tower', face: 0, scale: 0.4 }));
  assert.equal(dent.ok, true);
  const door = json(ok(s, 'extrude_face', { name: 'tower', face: dent.cap_face, distance: -0.3, color: '#553311' }));
  assert.equal(door.ok, true, door.notes.join('; '));

  assert.match(s.call('extrude_face', { name: 'tower', face: 99, distance: 1 }).text, /no face 99/);
  assert.match(s.call('extrude_face', { name: 'tower', face: 0 }).text, /nothing to do/);
  assert.match(s.call('move_vertices', { name: 'tower', indices: [99], by: [0, 0, 0] }).text, /vertex 99/);

  ok(s, 'add_box', { name: 'slab' });
  const lean = json(ok(s, 'move_vertices', { name: 'slab', indices: [2, 3, 6, 7], by: [0.5, 0, 0] }));
  assert.equal(lean.ok, true, 'the top four corners move together and stay flat');
  const twist = json(ok(s, 'move_vertices', { name: 'slab', indices: [0], by: [0, 0.5, 0] }));
  assert.equal(twist.ok, false);
  assert.match(twist.notes.join(' '), /non-planar/);
});

test('boolean: subtract a box from a box, replace or keep the inputs, refuse open solids', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'wall', size: [4, 3, 0.3], at: [0, 1.5, 0], color: '#e9e4d8' });
  ok(s, 'add_box', { name: 'window', size: [1, 1, 1], at: [0, 1.5, 0], color: '#88ccee' });
  const r = ok(s, 'boolean', { a: 'wall', b: 'window', op: 'subtract', name: 'wall-with-hole' });
  const out = json(r);
  assert.equal(out.closed, true);
  assert.equal(out.ok, true);
  const names = json(ok(s, 'list', {})).objects.map((o) => o.name);
  assert.deepEqual(names, ['wall-with-hole'], 'a and b are replaced');
  ok(s, 'add_box', { name: 'cut', size: [1, 1, 1], at: [1, 1.5, 0] });
  ok(s, 'boolean', { a: 'wall-with-hole', b: 'cut', op: 'union', keep: true });
  assert.equal(json(ok(s, 'list', {})).objects.length, 3, 'keep: true keeps both inputs');
  ok(s, 'add_mesh', { name: 'sheet', positions: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], faces: [{ v: [0, 1, 2] }] });
  const bad = s.call('boolean', { a: 'sheet', b: 'cut', op: 'union' });
  assert.equal(bad.isError, true);
  assert.match(bad.text, /closed solids/);
});

test('view_sky: a sky catalogue becomes a scene; it is sent to the viewer and can be saved', () => {
  const scene = createScene();
  const sent = [];
  scene.info.live = { command: (c) => (sent.push(c), 1) };
  const dir = mkdtempSync(join(tmpdir(), 'sky-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const out = json(ok(scene, 'view_sky', {
      sky: { objects: [{ type: 'star', name: 'Sun', at: [0, 0, 0], spect: 'G2V', lum: 1 }, { type: 'planet', name: 'Earth', around: 'Sun', a: 1, radius_km: 6371, orbit: true }, { type: 'comet', name: 'X', at: [1, 0, 0] }] },
      save: 'sky.json',
    }));
    assert.deepEqual(out.counts, { star: 1, planet: 1 });
    assert.equal(out.notes.length, 1);
    assert.equal(sent[0].cmd, 'scene');
    assert.equal(sent[0].replace, true);
    assert.equal(sent[0].scene.objects.length, 2);
    assert.equal(sent[0].scene.paths.length, 1);
    assert.ok(existsSync(join(dir, 'sky.json')));
    assert.ok(scene.call('view_sky', {}).isError);
    assert.ok(scene.call('view_sky', { sky: { objects: [] } }).isError);
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});

test('place_on: drops an object onto a surface (up, normal, ray), like G G', () => {
  const s = createScene();
  table(s);
  ok(s, 'add_box', { name: 'cup', size: [0.1, 0.12, 0.1], at: [5, 3, 5] });
  // straight down at [x, z]: the cup's bottom lands on the table top (y 1.0)
  let r = json(ok(s, 'place_on', { name: 'cup', onto: 'top', at: [0.3, 0.2] }));
  assert.deepEqual(r.min.map((v) => +v.toFixed(6)), [0.25, 1, 0.15]);
  assert.deepEqual(r.surface.normal, [0, 1, 0]);
  // default spot: the middle of the single onto object
  r = json(ok(s, 'place_on', { name: 'cup', onto: 'top' }));
  assert.ok(Math.abs(r.min[1] - 1) < 1e-9 && Math.abs(r.min[0] + 0.05) < 1e-9);
  // nothing below: an error, the object stays
  assert.equal(s.call('place_on', { name: 'cup', onto: 'top', at: [9, 9] }).isError, true);
  // a ray against the side of the top: align normal turns the cup's up to +x
  r = json(ok(s, 'place_on', { name: 'cup', onto: 'top', from: [3, 0.925, 0], dir: [-1, 0, 0], align: 'normal' }));
  assert.deepEqual(r.surface.normal, [1, 0, 0]);
  assert.ok(Math.abs(r.min[0] - 1) < 1e-6 && Math.abs(r.max[0] - 1.12) < 1e-6, JSON.stringify(r));
  // a slope: a wedge, the cup tilts with it
  ok(s, 'add_mesh', { name: 'ramp', positions: [[-1, 0, 2], [1, 0, 2], [1, 0, 4], [-1, 0, 4], [-1, 1, 4], [1, 1, 4]], faces: [{ v: [0, 1, 2, 3] }, { v: [0, 4, 5, 1] }, { v: [3, 2, 5, 4] }, { v: [0, 3, 4] }, { v: [1, 5, 2] }] });
  r = json(ok(s, 'place_on', { name: 'cup', onto: 'ramp', at: [0, 3], align: 'normal' }));
  const n = 1 / Math.SQRT2;
  assert.ok(Math.abs(r.surface.normal[1] - 0.894427) < 1e-5 || Math.abs(r.surface.normal[1] - n) < 1e-5, JSON.stringify(r.surface));
  assert.ok(Math.abs(r.surface.point[1] - 0.5) < 1e-6);
});

test('transform: rotate_x / rotate_z (right-hand rule) and a pivot', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'stick', size: [0.1, 1, 0.1], at: [0, 0.5, 0] });
  // tip it over round its foot towards +z
  let r = json(ok(s, 'transform', { name: 'stick', rotate_x: 90, pivot: [0, 0, 0] }));
  assert.ok(Math.abs(r.max[2] - 1) < 1e-6 && Math.abs(r.max[1] - 0.05) < 1e-6, JSON.stringify(r));
  ok(s, 'add_box', { name: 'post', size: [0.1, 1, 0.1], at: [0, 0.5, 0] });
  r = json(ok(s, 'transform', { name: 'post', rotate_z: 90, pivot: [0, 0, 0] }));
  assert.ok(Math.abs(r.min[0] + 1) < 1e-6, JSON.stringify(r)); // +y turns to -x
});

test('add_character: a figure of the character builder, posed, turned, stood on a surface', () => {
  const s = createScene();
  let r = json(ok(s, 'add_character', { name: 'ann', preset: 'crew', spec: { base: 'female' }, at: [1, 0, 2], yaw: 90 }));
  assert.equal(r.base, 'female');
  assert.ok(r.max[1] > 1.4 && r.max[1] < 2.1 && Math.abs(r.min[1]) < 1e-6, JSON.stringify(r));
  const depth = r.max[2] - r.min[2], width = r.max[0] - r.min[0];
  assert.ok(Math.abs((r.min[0] + r.max[0]) / 2 - 1) < 0.35 && Math.abs((r.min[2] + r.max[2]) / 2 - 2) < 0.6, JSON.stringify(r));
  assert.ok(width > 0 && depth > 0);
  // seated, on a box, with a variation
  ok(s, 'add_box', { name: 'dais', size: [2, 0.2, 2], at: [5, 0.1, 0] });
  r = json(ok(s, 'add_character', { name: 'bob', preset: 'mechanic', seed: 3, pose: 'sit', at: [5, 0, 0], onto: 'dais' }));
  assert.ok(Math.abs(r.min[1] - 0.2) < 1e-6 && r.max[1] < 1.6, JSON.stringify(r));
  assert.equal(r.pose, 'sit');
  // place_on works on it: its foot is the middle of where it stands
  r = json(ok(s, 'place_on', { name: 'ann', onto: 'dais', at: [5.5, 0.5] }));
  assert.ok(Math.abs(r.min[1] - 0.2) < 1e-6);
  assert.equal(s.call('add_character', { name: 'ann' }).isError, true); // exists
  assert.equal(s.call('add_character', { name: 'zed', preset: 'pirate' }).isError, true);
});

test('sense: the cursor\'s ray from the camera, every hit behind with distances, and the sensing set', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'floor', size: [6, 0.1, 6], at: [0, -0.05, 0] });
  ok(s, 'add_box', { name: 'wall', size: [4, 2, 0.2], at: [0, 1, 0] });
  ok(s, 'add_box', { name: 'crate', size: [0.6, 0.6, 0.6], at: [0, 0.3, -1.5] });
  // a ray along -z at y 0.3: the wall (in and out), then the crate (in and out)
  let r = json(ok(s, 'sense', { from: [0, 0.3, 5], dir: [0, 0, -1] }));
  assert.equal(r.first.object, 'wall');
  assert.ok(Math.abs(r.first.distance - 4.9) < 1e-6);
  assert.deepEqual(r.hits.map((h) => [h.object, h.outside, +h.distance.toFixed(3)]), [['wall', true, 4.9], ['wall', false, 5.1], ['crate', true, 6.2], ['crate', false, 6.8]]);
  // leave the wall out for this call: the crate is first
  r = json(ok(s, 'sense', { from: [0, 0.3, 5], dir: [0, 0, -1], exclude: 'wall' }));
  assert.equal(r.first.object, 'crate');
  // the sensing set: ignore the wall for good, then put it back
  assert.deepEqual(json(ok(s, 'sensing', { ignore: 'wall' })).ignored, ['wall']);
  r = json(ok(s, 'sense', { from: [0, 0.3, 5], dir: [0, 0, -1] }));
  assert.equal(r.first.object, 'crate');
  assert.equal(json(ok(s, 'sense', { from: [0, 0.3, 5], dir: [0, 0, -1], include: 'wall' })).first.object, 'wall');
  assert.deepEqual(json(ok(s, 'sensing', { sense: 'wall' })).ignored, []);
  assert.deepEqual(json(ok(s, 'sensing', { only: ['floor'] })).sensed, ['floor']);
  assert.deepEqual(json(ok(s, 'sensing', { reset: true })).ignored, []);
  // through a pixel of a render: the middle of the front view looks at the wall
  r = json(ok(s, 'sense', { view: 'front', x: 160, y: 160 }));
  assert.equal(r.first.object, 'wall');
  assert.deepEqual(r.first.normal, [0, 0, 1]);
  assert.ok(r.first.distance > 0);
  // pick follows the sensing set too
  ok(s, 'sensing', { ignore: 'wall' });
  assert.equal(json(ok(s, 'pick', { view: 'front', x: 160, y: 160 })).hit, null); // (behind the wall at that height: nothing)
  ok(s, 'sensing', { reset: true });
});

test('place_on: through a pixel from the camera, and behind or into what is left out of the sensing', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'floor', size: [6, 0.1, 6], at: [0, -0.05, 0] });
  ok(s, 'add_box', { name: 'wall', size: [4, 2, 0.2], at: [0, 1, 0] });
  ok(s, 'add_box', { name: 'vase', size: [0.2, 0.4, 0.2], at: [0, 2.6, 0] }); // (in the middle: the views frame every object)
  // the camera's ray from the top view through the middle lands on the wall's top
  let r = json(ok(s, 'place_on', { name: 'vase', view: 'top', x: 160, y: 160 }));
  assert.equal(r.surface.object, 'wall');
  assert.ok(Math.abs(r.min[1] - 2) < 1e-6 && r.surface.distance > 0, JSON.stringify(r));
  // behind the wall: straight down at z -1 with the wall left out lands on the floor
  r = json(ok(s, 'place_on', { name: 'vase', at: [0, 0], exclude: 'wall' }));
  assert.equal(r.surface.object, 'floor');
  assert.ok(Math.abs(r.min[1]) < 1e-6);
  // a ray from the front through the wall onto the floor? no: front faces only, the wall is out, the ray hits nothing upright
  ok(s, 'sensing', { ignore: 'wall' });
  r = json(ok(s, 'place_on', { name: 'vase', from: [0, 3, 3], dir: [0, -1, -1] }));
  assert.equal(r.surface.object, 'floor');
  assert.ok(Math.abs(r.surface.point[2] - 0) < 1e-6 && Math.abs(r.surface.distance - 3 * Math.SQRT2) < 1e-6, JSON.stringify(r.surface));
});

test('groups: make, rename, move as one, ungroup', () => {
  const s = createScene();
  table(s);
  let r = json(ok(s, 'group', { name: 'table', objects: ['top', 'leg_a', 'leg_b', 'leg_c', 'leg_d'] }));
  assert.equal(r.groups.table.length, 5);
  r = json(ok(s, 'transform', { name: 'leg_a', move: [2, 0, 0] }));
  assert.deepEqual(r.moved_along.sort(), ['leg_b', 'leg_c', 'leg_d', 'top']);
  assert.ok(Math.abs(json(ok(s, 'list', {})).objects.find((o) => o.name === 'top').min[0] - 1) < 1e-9);
  r = json(ok(s, 'group', { name: 'table', rename: 'desk' }));
  assert.deepEqual(Object.keys(r.groups), ['desk']);
  const exported = JSON.parse(json(ok(s, 'export', {})).json ?? s.call('export', {}).text);
  assert.ok(exported.objects ? exported.objects.every((o) => o.group === 'desk') : true);
  r = json(ok(s, 'ungroup', { name: 'desk' }));
  assert.equal(r.ungrouped.length, 5);
  r = json(ok(s, 'transform', { name: 'leg_a', move: [1, 0, 0] }));
  assert.equal(r.moved_along, undefined);
  assert.equal(s.call('ungroup', { name: 'desk' }).isError, true);
});

test('connect: a hinged door with a limit, carried by its frame; a rail; a pivot; glue; a spring', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'frame', size: [0.1, 2, 0.1], at: [0, 1, 0] });
  ok(s, 'add_box', { name: 'door', size: [0.9, 2, 0.05], at: [0.5, 1, 0] });
  let r = json(ok(s, 'connect', { type: 'hinge', a: 'frame', b: 'door', axis: [[0.05, 0, 0], [0.05, 2, 0]], limit: [0, 100], name: 'hinge' }));
  assert.equal(r.now.angle, 0);
  r = json(ok(s, 'move_joint', { name: 'hinge', angle: 150 }));
  assert.equal(r.now.angle, 100); // clamped
  const door = json(ok(s, 'list', {})).objects.find((o) => o.name === 'door');
  assert.ok(door.max[2] < 0.05 && door.min[2] < -0.8, JSON.stringify(door)); // swung towards -z
  // the frame moves and turns: the door comes along, the angle stays
  ok(s, 'transform', { name: 'frame', rotate_y: 40, move: [3, 0, 0] });
  assert.ok(Math.abs(json(ok(s, 'joints', {})).joints[0].now.angle - 100) < 1e-6);
  // a hinge on a vertex edge of the door, in a second scene
  ok(s, 'add_box', { name: 'base', size: [4, 0.1, 0.3], at: [0, 0, 5] });
  ok(s, 'add_box', { name: 'cart', size: [0.3, 0.2, 0.3], at: [0, 0.15, 5] });
  r = json(ok(s, 'connect', { type: 'rail', a: 'base', b: 'cart', path: [[-2, 0.05, 5], [2, 0.05, 5]], slider: [0, 0.05, 5], limit: [0.5, 3.5], name: 'rail' }));
  assert.ok(Math.abs(r.now.position - 2) < 1e-9);
  r = json(ok(s, 'move_joint', { name: 'rail', position: 10 }));
  assert.equal(r.now.position, 3.5);
  ok(s, 'add_box', { name: 'ball', size: [0.2, 0.2, 0.2], at: [0, 3, 9] });
  ok(s, 'add_box', { name: 'arm', size: [0.05, 1, 0.05], at: [0, 2.4, 9] });
  ok(s, 'connect', { type: 'pivot', a: 'ball', b: 'arm', at: [0, 3, 9], limits: { x: [-30, 30] }, name: 'ball' });
  r = json(ok(s, 'move_joint', { name: 'ball', angles: [45, 10, 0] }));
  assert.deepEqual(r.now.angles.map((v) => Math.round(v)), [30, 10, 0]);
  // glue: the cart carries a box glued to it
  ok(s, 'add_box', { name: 'load', size: [0.2, 0.2, 0.2], at: [1.5, 0.35, 5] });
  ok(s, 'connect', { type: 'glue', a: 'cart', b: 'load', contact: [[1.5, 0.25, 5]] });
  const before = json(ok(s, 'list', {})).objects.find((o) => o.name === 'load').min[0];
  ok(s, 'move_joint', { name: 'rail', position: 1 });
  assert.ok(Math.abs(json(ok(s, 'list', {})).objects.find((o) => o.name === 'load').min[0] - (before - 2.5)) < 1e-9);
  // a spring with a stretched spring object
  ok(s, 'add_box', { name: 'hook', size: [1, 0.1, 1], at: [5, 3, 0] });
  ok(s, 'add_box', { name: 'bob', size: [0.3, 0.3, 0.3], at: [5, 1, 0] });
  ok(s, 'add_box', { name: 'coil', size: [0.08, 1.65, 0.08], at: [5, 2.125, 0] });
  r = json(ok(s, 'connect', { type: 'spring', a: 'hook', b: 'bob', at: [5, 2.95, 0], at_b: [5, 1.15, 0], rest_length: 1.5, spring_object: 'coil', name: 'spring' }));
  assert.ok(Math.abs(r.now.length - 1.8) < 1e-9);
  assert.equal(s.call('move_joint', { name: 'spring', angle: 3 }).isError, true);
  // remove one end: its joints go
  ok(s, 'remove', { name: 'bob' });
  assert.ok(!json(ok(s, 'joints', {})).joints.some((j) => j.name === 'spring'));
  // round trip through export / import
  const text = s.call('export', {}).text;
  const s2 = createScene();
  const exp = JSON.parse(text);
  const scene = exp.json ? JSON.parse(exp.json) : exp;
  ok(s2, 'import', { json: JSON.stringify(scene) });
  assert.equal(json(ok(s2, 'joints', {})).joints.length, json(ok(s, 'joints', {})).joints.length);
  assert.equal(s.call('connect', { type: 'hinge', a: 'frame', b: 'door', name: 'x' }).isError, true); // no line
});

test('set_screen: an image, a scene or a page on four-cornered faces, kept in the palette', () => {
  const s = createScene();
  ok(s, 'add_box', { name: 'tv', size: [1.6, 0.9, 0.05], at: [0, 1.2, 0], color: '#222222' });
  const r = json(ok(s, 'set_screen', { name: 'tv', face: 4, image: 'https://example.org/poster.png' }));
  assert.equal(r.material, 'screen-tv');
  assert.equal(r.fourCornered, 1);
  let d = json(ok(s, 'export', {}));
  assert.deepEqual(d.palette, [{ name: 'screen-tv', color: '#222222', image: 'https://example.org/poster.png' }]);
  assert.equal(d.objects[0].mesh.faces.filter((f) => f.mat === 'screen-tv').length, 1);
  // import keeps it
  const s2 = createScene();
  assert.equal(json(ok(s2, 'import', { json: JSON.stringify(d) })).screens, 1);
  assert.equal(json(ok(s2, 'export', {})).palette[0].image, 'https://example.org/poster.png');
  // a scene on every side, then plain again
  ok(s, 'set_screen', { name: 'tv', scene: 'models/globe.scene.json', material: 'globe' });
  d = json(ok(s, 'export', {}));
  assert.equal(d.palette.find((m) => m.name === 'globe').scene, 'models/globe.scene.json');
  ok(s, 'set_screen', { name: 'tv', material: 'globe' });
  ok(s, 'set_screen', { name: 'tv', material: 'screen-tv' });
  assert.equal(json(ok(s, 'export', {})).palette, undefined);
  // wrong kinds
  assert.equal(s.call('set_screen', { name: 'tv', image: 'https://example.org/page.html' }).isError, true);
  assert.equal(s.call('set_screen', { name: 'tv', url: 'https://example.org/a.jpg' }).isError, true);
  assert.equal(s.call('set_screen', { name: 'tv', image: 'javascript:alert(1).png' }).isError, true);
  assert.equal(s.call('set_screen', { name: 'tv', image: 'a.png', scene: 'b.json' }).isError, true);
});
