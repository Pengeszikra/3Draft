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
