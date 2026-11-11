import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box } from './mesh.js';
import { union } from './csg.js';
import { validate } from './check.js';
import { humanoidRig, posed, posedJoints, walkPose, HUMANOID_POSES, HUMANOID_JOINTS } from './rig.js';
/** A man of boxes, joined into one mesh: 1.72 m, legs apart, arms hanging beside the trunk. */
const boxMan = () => {
    const b = (size, at) => box({ size, at });
    const parts = [
        b([0.36, 0.6, 0.2], [0, 1.1, 0]), // trunk, y 0.8 .. 1.4
        ...[1, -1].flatMap((s) => [
            b([0.14, 0.85, 0.14], [s * 0.09, 0.425, 0]), // leg
            b([0.14, 0.1, 0.12], [s * 0.22, 1.35, 0]), // shoulder
            b([0.09, 0.62, 0.1], [s * 0.27, 1.07, 0]), // arm, y 0.76 .. 1.38
        ]),
        b([0.1, 0.1, 0.1], [0, 1.44, 0]), // neck
        b([0.2, 0.24, 0.22], [0, 1.6, 0]), // head, top at 1.72
    ];
    return parts.reduce((all, part) => union(all, part));
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;
const joint = (rig, name) => rig.joints.find((j) => j.name === name).at;
test('a figure of boxes gets the fifteen joints, in the right places', () => {
    const man = boxMan();
    assert.ok(validate(man).ok);
    const rig = humanoidRig([man]);
    assert.deepEqual(rig.joints.map((j) => j.name), [...HUMANOID_JOINTS]);
    for (const [i, j] of rig.joints.entries()) {
        const parent = rig.joints.findIndex((p) => p.name === j.parent);
        assert.ok(j.parent === null ? i === 0 : parent >= 0 && parent < i, `${j.name} comes after its parent`);
    }
    assert.ok(near(joint(rig, 'hipL')[0], 0.09, 0.02) && near(joint(rig, 'hipR')[0], -0.09, 0.02), 'hips are over the legs');
    assert.ok(near(joint(rig, 'hipL')[1], 0.85, 0.08), 'hips are at the crotch');
    assert.ok(joint(rig, 'kneeL')[1] > 0.3 && joint(rig, 'kneeL')[1] < 0.6);
    assert.ok(joint(rig, 'shoulderL')[0] > 0.18 && joint(rig, 'shoulderR')[0] < -0.18, 'left is +x');
    assert.ok(near(joint(rig, 'shoulderL')[1], 1.35, 0.08));
    assert.ok(joint(rig, 'elbowL')[1] < joint(rig, 'shoulderL')[1] && joint(rig, 'wristL')[1] < joint(rig, 'elbowL')[1], 'the arm hangs');
    assert.ok(near(joint(rig, 'head')[1], 1.44, 0.06), 'the head turns on the neck');
});
test('every vertex has weights that add up to 1', () => {
    const man = boxMan();
    const rig = humanoidRig([man]);
    assert.equal(rig.skin.length, 1);
    assert.equal(rig.skin[0].length, man.positions.length);
    for (const w of rig.skin[0]) {
        assert.ok(w.length >= 1);
        assert.ok(near(w.reduce((sum, [, x]) => sum + x, 0), 1, 1e-9));
    }
});
test('the bind pose changes nothing, a pose keeps the mesh a closed solid', () => {
    const man = boxMan();
    const rig = humanoidRig([man]);
    const [same] = posed([man], rig);
    for (const [i, p] of man.positions.entries())
        for (let k = 0; k < 3; k++)
            assert.ok(near(same.positions[i][k], p[k], 1e-12));
    assert.equal(same.faces.length, man.faces.length);
    for (const pose of [HUMANOID_POSES.tpose, HUMANOID_POSES.sit, walkPose(0.3), walkPose(0.1, { run: true })]) {
        const [m] = posed([man], rig, pose, { ground: true });
        const v = validate(m);
        assert.ok(v.ok, v.notes.join('; '));
        assert.equal(m.positions.length, man.positions.length, 'only the points move');
        assert.ok(near(Math.min(...m.positions.map((p) => p[1])), 0, 1e-9), 'ground: the lowest point stays on the floor');
    }
});
test('lifting the left arm moves the left hand and nothing else', () => {
    const man = boxMan();
    const rig = humanoidRig([man]);
    const [m] = posed([man], rig, { shoulderL: [0, 0, Math.PI / 2] });
    const moved = man.positions.map((p, i) => Math.hypot(...p.map((x, k) => x - m.positions[i][k])));
    const hand = man.positions.findIndex((p) => p[0] > 0.25 && p[1] < 0.8);
    const foot = man.positions.findIndex((p) => p[1] < 0.01);
    const otherHand = man.positions.findIndex((p) => p[0] < -0.25 && p[1] < 0.8);
    assert.ok(moved[hand] > 0.5, 'the hand swings out');
    assert.ok(m.positions[hand][1] > 1.2, 'up to shoulder height');
    assert.ok(moved[foot] < 1e-12 && moved[otherHand] < 1e-12);
    // the joints move with their parents
    const at = posedJoints(rig, { shoulderL: [0, 0, Math.PI / 2] });
    const wrist = rig.joints.findIndex((j) => j.name === 'wristL');
    assert.ok(at[wrist][1] > rig.joints[wrist].at[1] + 0.3);
});
test('loose parts follow the body; what is no figure is refused with the reason', () => {
    const man = boxMan();
    const hat = box({ size: [0.24, 0.06, 0.24], at: [0, 1.76, 0] });
    const rig = humanoidRig([man, hat]);
    const head = rig.joints.findIndex((j) => j.name === 'head');
    assert.ok(rig.skin[1].every((w) => w.length === 1 && w[0][0] === head), 'the hat sits on the head');
    const [, nodding] = posed([man, hat], rig, { head: [0.5, 0, 0] });
    assert.ok(nodding.positions.some((p, i) => p[2] > hat.positions[i][2] + 0.05), 'and nods with it');
    assert.throws(() => humanoidRig([box({ size: [1, 1, 1], at: [0, 0.5, 0] })]), /no figure/);
    assert.throws(() => posed([man], rig), /2 mesh/);
});
