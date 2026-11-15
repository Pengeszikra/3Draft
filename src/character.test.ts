import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacter, normalizeCharacter, CHARACTER_MATERIALS, variateCharacter, CHARACTER_PRESETS, CHARACTER_RANGES, CHARACTER_PARTS, FACE_SHAPES, HAIR_STYLES, OUTFITS, PROPS } from './character.js';
import { posed, walkPose, HUMANOID_POSES, HUMANOID_JOINTS } from './rig.js';
import { validate } from './check.js';

const valid = (c: ReturnType<typeof buildCharacter>, pose = {}) => {
  const ms = posed(c.parts.map((p) => p.mesh), c.rig, pose, { ground: true });
  ms.forEach((m, i) => assert.ok(validate(m).ok, `${c.spec.role ?? c.spec.base} ${c.parts[i]!.id}: ${JSON.stringify(validate(m)).slice(0, 160)}`));
  return ms;
};

test('the presets build valid figures with the humanoid joints, in every pose', () => {
  for (const spec of Object.values(CHARACTER_PRESETS)) {
    const c = buildCharacter(spec);
    assert.deepEqual(c.rig.joints.map((j) => j.name), [...HUMANOID_JOINTS]);
    assert.deepEqual(c.parts.map((p) => p.id), CHARACTER_PARTS.filter((id) => c.parts.some((p) => p.id === id)));
    for (const pose of [{}, HUMANOID_POSES.sit!, HUMANOID_POSES.wave!, walkPose(0.3)]) valid(c, pose);
  }
});

test('the same spec gives the same figure; a JSON round trip too', () => {
  const s = variateCharacter(CHARACTER_PRESETS.mechanic!, 42);
  const a = buildCharacter(s), b = buildCharacter(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(a.parts, b.parts);
});

test('both bases at the ends of the ranges stay valid, and the parts ride on the right joints', () => {
  const R = CHARACTER_RANGES;
  for (const base of ['female', 'male'])
    for (const k of [0, 1]) {
      const spec = normalizeCharacter({ base, body: { height: R.height[k], build: R.build[k], shoulders: R.shoulders[1 - k], head: R.head[k] }, face: { shape: FACE_SHAPES[k * 3], jaw: R.jaw[k], nose: R.nose[1 - k] }, hair: { style: HAIR_STYLES[k + 1] }, glasses: true, beard: 'full', outfit: { kind: OUTFITS[k * 2] }, prop: PROPS[k + 2] });
      const c = buildCharacter(spec);
      valid(c, HUMANOID_POSES.sit);
      valid(c, walkPose(0.7));
      const head = c.rig.joints.findIndex((j) => j.name === 'head'), wrist = c.rig.joints.findIndex((j) => j.name === 'wristR');
      const on = (id: string) => c.rig.skin[c.parts.findIndex((p) => p.id === id)]!;
      for (const id of ['head', 'face', 'hair']) if (c.parts.some((p) => p.id === id)) assert.ok(on(id).every((w) => w.length === 1 && w[0]![0] === head), `${id} rides on the head`);
      assert.ok(on('prop').every((w) => w[0]![0] === wrist), 'the prop rides on the right hand');
      const top = Math.max(...c.parts.flatMap((p) => p.mesh.positions.map((q) => q[1])));
      assert.ok(top > spec.body.height * 0.95 && top < spec.body.height * 1.25, `height ${top} for ${spec.body.height}`);
    }
});

test('variate keeps the role: outfit kind and prop', () => {
  for (const spec of Object.values(CHARACTER_PRESETS))
    for (let seed = 1; seed < 6; seed++) {
      const v = variateCharacter(spec, seed);
      assert.equal(v.outfit.kind, spec.outfit.kind);
      assert.equal(v.prop, spec.prop);
      assert.notDeepEqual(v.face, spec.face);
      assert.ok(buildCharacter(v).parts.length >= 3);
    }
});

test('bad input is cleaned up', () => {
  const s = normalizeCharacter({ base: 'robot', body: { height: 9, build: 'x' }, face: { shape: 'blob', skin: 'red' }, prop: 'sword' });
  assert.equal(s.base, 'female');
  assert.equal(s.body.height, CHARACTER_RANGES.height[1]);
  assert.equal(s.face.shape, 'oval');
  assert.equal(s.prop, 'none');
  assert.equal(s.version, 3);
});

test('few meshes: the body is one closed piece, the arms two, every face names a material', () => {
  for (const spec of Object.values(CHARACTER_PRESETS)) {
    const c = buildCharacter(spec);
    const body = c.parts.find((p) => p.id === 'body')!.mesh;
    // one connected piece: walk the shared edges from the first face
    const byEdge = new Map<string, number[]>();
    body.faces.forEach((f, i) => f.v.forEach((a, j) => { const b = f.v[(j + 1) % f.v.length]!; const k = a < b ? `${a},${b}` : `${b},${a}`; byEdge.set(k, [...(byEdge.get(k) ?? []), i]); }));
    const seen = new Set([0]), stack = [0];
    while (stack.length) { const f = body.faces[stack.pop()!]!; f.v.forEach((a, j) => { const b = f.v[(j + 1) % f.v.length]!; for (const g of byEdge.get(a < b ? `${a},${b}` : `${b},${a}`)!) if (!seen.has(g)) (seen.add(g), stack.push(g)); }); }
    assert.equal(seen.size, body.faces.length, `${spec.role}: the body is one piece`);
    for (const p of c.parts) assert.ok(p.mesh.faces.every((f) => typeof f.mat === 'string' && f.mat.length), `${spec.role} ${p.id}: materials`);
    for (const p of c.parts) for (const f of p.mesh.faces) if (CHARACTER_MATERIALS[f.mat!]) assert.equal(f.color, CHARACTER_MATERIALS[f.mat!]!.color);
  }
});

test('a version 1 spec (colours) opens as materials; any palette name may be chosen', () => {
  const s = normalizeCharacter({ version: 1, face: { skin: '#e8b896' }, hair: { style: 'curly', color: '#1d1a1a' }, outfit: { kind: 'overall', color: '#3d5a8a', color2: '#2b2b2b' }, prop: 'tomato' });
  assert.equal(s.face.skin, 'skin-2');
  assert.equal(s.hair.mat, 'hair-black');
  assert.equal(s.hair.style, 'long');
  assert.equal(s.prop, 'none');
  assert.equal(s.outfit.main, 'denim');
  const t = normalizeCharacter({ outfit: { kind: 'coat', main: 'my gold', second: 'brick' } });
  assert.equal(t.outfit.main, 'my gold');
  assert.ok(buildCharacter(t, { 'my gold': { color: '#d9b04a' } }).parts.some((p) => p.mesh.faces.some((f) => f.mat === 'my gold' && f.color === '#d9b04a')));
});

test('the astronaut wears a helmet over the head (no hair), a collar and a small pack', () => {
  const c = buildCharacter(CHARACTER_PRESETS.astronaut);
  assert.ok(!c.parts.some((p) => p.id === 'hair'));
  const gear = c.parts.find((p) => p.id === 'gear')!.mesh;
  assert.ok(gear.faces.some((f) => f.mat === 'visor'));
  const z = gear.positions.map((p) => p[2]);
  assert.ok(Math.min(...z) > -0.2 * c.height, 'the pack stays small');
  const bare = buildCharacter({ ...CHARACTER_PRESETS.astronaut, outfit: { ...CHARACTER_PRESETS.astronaut!.outfit, helmet: false } });
  assert.ok(bare.parts.some((p) => p.id === 'hair'));
});

test('the crew tunic: the left sleeve is the department colour, the right the tunic; a belt in the gear', () => {
  const c = buildCharacter(CHARACTER_PRESETS.crew);
  const arms = c.parts.find((p) => p.id === 'arms')!.mesh;
  const left = arms.faces.filter((f) => arms.positions[f.v[0]!]![0] > 0.05 && f.mat === 'rust');
  const right = arms.faces.filter((f) => arms.positions[f.v[0]!]![0] < -0.05 && f.mat === 'rust');
  assert.ok(left.length > 20 && right.length === 0);
  assert.ok(c.parts.find((p) => p.id === 'gear')!.mesh.faces.some((f) => f.mat === 'brass'));
  assert.ok(!('farmer' in CHARACTER_PRESETS));
});
