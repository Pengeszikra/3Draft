import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCharacter, normalizeCharacter, variateCharacter, CHARACTER_PRESETS, CHARACTER_RANGES, CHARACTER_PARTS, FACE_SHAPES, HAIR_STYLES, OUTFITS, PROPS } from './character.js';
import { posed, walkPose, HUMANOID_POSES, HUMANOID_JOINTS } from './rig.js';
import { validate } from './check.js';
const valid = (c, pose = {}) => {
    const ms = posed(c.parts.map((p) => p.mesh), c.rig, pose, { ground: true });
    ms.forEach((m, i) => assert.ok(validate(m).ok, `${c.spec.role ?? c.spec.base} ${c.parts[i].id}: ${JSON.stringify(validate(m)).slice(0, 160)}`));
    return ms;
};
test('the presets build valid figures with the humanoid joints, in every pose', () => {
    for (const spec of Object.values(CHARACTER_PRESETS)) {
        const c = buildCharacter(spec);
        assert.deepEqual(c.rig.joints.map((j) => j.name), [...HUMANOID_JOINTS]);
        assert.deepEqual(c.parts.map((p) => p.id), CHARACTER_PARTS.filter((id) => c.parts.some((p) => p.id === id)));
        for (const pose of [{}, HUMANOID_POSES.sit, HUMANOID_POSES.wave, walkPose(0.3)])
            valid(c, pose);
    }
});
test('the same spec gives the same figure; a JSON round trip too', () => {
    const s = variateCharacter(CHARACTER_PRESETS.mechanic, 42);
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
            const on = (id) => c.rig.skin[c.parts.findIndex((p) => p.id === id)];
            for (const id of ['hair', 'glasses', 'beard'])
                if (c.parts.some((p) => p.id === id))
                    assert.ok(on(id).every((w) => w[0][0] === head), `${id} rides on the head`);
            assert.ok(on('prop').every((w) => w[0][0] === wrist), 'the prop rides on the right hand');
            const top = Math.max(...c.parts[0].mesh.positions.map((p) => p[1]));
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
    assert.equal(s.version, 1);
});
