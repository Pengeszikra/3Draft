import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTsh, handGestures } from './vrtsh.js';
/** A hand palm down, fingers ahead (−z), the wrist at W. Left: the index on the +x side; right: on −x. */
const hand = (side, W, { fist = false, point = false } = {}) => {
    const s = side === 'left' ? 1 : -1;
    const joints = { wrist: W };
    ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'].forEach((f, i) => {
        const x = W[0] + s * (0.03 - i * 0.02);
        const curl = fist || (point && i > 0);
        joints[`${f}-metacarpal`] = [x, W[1], W[2] - 0.02];
        joints[`${f}-phalanx-proximal`] = [x, W[1], W[2] - 0.09];
        joints[`${f}-phalanx-intermediate`] = [x, W[1] - (curl ? 0.02 : 0), W[2] - (curl ? 0.1 : 0.12)];
        joints[`${f}-phalanx-distal`] = [x, W[1] - (curl ? 0.03 : 0), W[2] - (curl ? 0.08 : 0.15)];
        joints[`${f}-tip`] = [x, W[1] - (curl ? 0.03 : 0), W[2] - (curl ? 0.06 : 0.18)];
    });
    joints['thumb-metacarpal'] = [W[0] + s * 0.03, W[1], W[2] - 0.02];
    joints['thumb-phalanx-proximal'] = [W[0] + s * 0.05, W[1], W[2] - 0.04];
    joints['thumb-phalanx-distal'] = [W[0] + s * 0.06, W[1], W[2] - 0.06];
    joints['thumb-tip'] = [W[0] + s * 0.07, W[1], W[2] - 0.08];
    return { joints, wrist: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ...W, 1] };
};
test('the back of the hand points up for both hands palm down', () => {
    for (const side of ['left', 'right']) {
        const g = handGestures(side, hand(side, [0, 1, 0]), {}, 0);
        assert.ok(g.back[1] > 0.99, `${side}: ${g.back}`);
        assert.equal(g.fist, false);
    }
});
test('fist, pointing and a fist opened', () => {
    const tsh = createTsh({ left: [{ id: 'a' }, { id: 'b' }] });
    tsh.update({ left: hand('left', [0, 1, 0], { fist: true }) }, null, 0);
    const f = tsh.update({ left: hand('left', [0, 1, 0], { fist: true }) }, null, 300);
    assert.equal(f.left.g?.fist, true);
    assert.ok(Math.abs((f.left.g?.fistFor ?? 0) - 0.3) < 1e-9);
    const o = tsh.update({ left: hand('left', [0, 1, 0]) }, null, 400);
    const ev = o.events.find((e) => e.type === 'fistOpen');
    assert.ok(ev && ev.type === 'fistOpen' && ev.heldFor >= 0.29);
    const p = handGestures('right', hand('right', [0, 1, 0], { point: true }), {}, 0);
    assert.equal(p.point, true);
    assert.equal(p.fist, false);
});
test('the other hand chooses a function by poking its icon', () => {
    const fns = ['m0', 'm1', 'grab', 'cube', 'exit'].map((id) => ({ id }));
    const tsh = createTsh({ left: fns });
    const left = hand('left', [-0.2, 1.1, -0.3]);
    const f0 = tsh.update({ left }, null, 0);
    assert.equal(f0.left.fn?.id, 'm0');
    const icons = f0.left.icons.filter((i) => !i.big);
    assert.equal(icons.length, 5);
    assert.equal(f0.left.icons.filter((i) => i.big).length, 1);
    // icons sit above the back of the hand
    for (const ic of icons)
        assert.ok(ic.at[1] > 1.1);
    const target = icons.find((i) => i.fn.id === 'cube');
    // the right index tip on it: the right hand's tip is 0.18 ahead of its wrist and 0.03 to the side
    const tipAt = (t) => hand('right', [t[0] + 0.03, t[1], t[2] + 0.18]);
    const f1 = tsh.update({ left, right: tipAt(target.at) }, null, 16);
    assert.equal(f1.left.fn?.id, 'cube');
    assert.deepEqual(f1.events.map((e) => e.type), ['choose']);
    // staying there does not choose again
    const f2 = tsh.update({ left, right: tipAt(target.at) }, null, 32);
    assert.equal(f2.events.length, 0);
    assert.equal(tsh.fn('left')?.id, 'cube');
});
test('a slot puts an icon in its cell; -1 is the last cell of the last row', () => {
    const tsh = createTsh({ right: [{ id: 'grab' }, { id: 'exit', slot: -1 }] });
    const f = tsh.update({ right: hand('right', [0.2, 1.1, -0.3]) }, null, 0);
    const icons = f.right.icons.filter((i) => !i.big);
    const grab = icons.find((i) => i.fn.id === 'grab'), exit = icons.find((i) => i.fn.id === 'exit');
    // 4 columns, 1 row: grab in the first cell, exit in the fourth, 3 cells (7.2 cm) apart
    const d = Math.hypot(grab.at[0] - exit.at[0], grab.at[1] - exit.at[1], grab.at[2] - exit.at[2]);
    assert.ok(Math.abs(d - 3 * 0.024) < 1e-9, String(d));
});
test('the big sign of the chosen function sits over the fingers and does not react to a touch', () => {
    const tsh = createTsh({ left: [{ id: 'a' }, { id: 'b' }] });
    const left = hand('left', [-0.2, 1.1, -0.3]);
    const big = tsh.update({ left }, null, 0).left.icons.find((i) => i.big);
    assert.ok(big.at[2] < -0.3 - 0.045 - 0.08, `ahead of the palm: ${big.at}`); // the palm's middle is 4.5 cm ahead of the wrist
    const tipAt = (t) => hand('right', [t[0] + 0.03, t[1], t[2] + 0.18]);
    const f = tsh.update({ left, right: tipAt(big.at) }, null, 16);
    assert.equal(f.events.length, 0);
    assert.equal(f.left.fn?.id, 'a');
});
test('aiming with the index, then curling the other fingers is "this one"', () => {
    const tsh = createTsh({ right: [{ id: 'build' }] });
    const open = tsh.update({ right: hand('right', [0.2, 1.1, -0.3]) }, null, 0);
    assert.equal(open.right.g?.aim, true);
    assert.equal(open.right.g?.point, false);
    const p = tsh.update({ right: hand('right', [0.2, 1.1, -0.3], { point: true }) }, null, 16);
    assert.deepEqual(p.events.map((e) => e.type), ['pointStart']);
    assert.equal(tsh.update({ right: hand('right', [0.2, 1.1, -0.3], { point: true }) }, null, 32).events.length, 0);
});
test('the icons hang on the wrist: shaken finger joints do not move them', () => {
    const tsh = createTsh({ left: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] });
    const left = hand('left', [-0.2, 1.1, -0.3]);
    const a = tsh.update({ left }, null, 0).left.icons;
    // another hand comes near: the metacarpals and knuckles jump 2 cm (the tracking shakes); the wrist stays
    const shaken = { ...left, joints: { ...left.joints } };
    for (const f of ['index-finger', 'pinky-finger'])
        for (const k of ['metacarpal', 'phalanx-proximal'])
            shaken.joints[`${f}-${k}`] = [shaken.joints[`${f}-${k}`][0], shaken.joints[`${f}-${k}`][1] + 0.02, shaken.joints[`${f}-${k}`][2]];
    const b = tsh.update({ left: shaken }, null, 16).left.icons;
    for (let i = 0; i < a.length; i++) {
        const d = Math.hypot(a[i].at[0] - b[i].at[0], a[i].at[1] - b[i].at[1], a[i].at[2] - b[i].at[2]);
        assert.ok(d < 0.002, `${a[i].fn.id}${a[i].big ? ' (big)' : ''} moved ${d}`);
    }
});
test('the thumb laid on the straight index', () => {
    const tsh = createTsh({ right: [{ id: 'build' }] });
    const h = hand('right', [0.2, 1.1, -0.3]);
    assert.equal(tsh.update({ right: h }, null, 0).right.g?.thumbOn, false);
    // the thumb's tip on the index between its knuckle and its last joint, 1 cm off it
    const on = { ...h, joints: { ...h.joints, 'thumb-tip': [h.joints['index-finger-phalanx-intermediate'][0] - 0.01, 1.11, h.joints['index-finger-phalanx-intermediate'][2]] } };
    const f = tsh.update({ right: on }, null, 16);
    assert.equal(f.right.g?.thumbOn, true);
    assert.equal(f.right.g?.pinch, false);
    assert.deepEqual(f.events.map((e) => e.type), ['thumbDown']);
});
test('aiming with the index alone, then the ring finger beside it: "lay it here"', () => {
    const tsh = createTsh({ right: [{ id: 'build' }] });
    const W = [0.2, 1.1, -0.3];
    // the index alone: the others curled (the pointing pose)
    const alone = tsh.update({ right: hand('right', W, { point: true }) }, null, 0);
    assert.equal(alone.right.g?.pair, false);
    // then the other fingers straight too: the ring beside the index
    const pair = tsh.update({ right: hand('right', W) }, null, 300);
    assert.equal(pair.right.g?.pair, true);
    assert.deepEqual(pair.events.map((e) => e.type), ['pairStart']);
    // an open hand that has not aimed alone lately: no event
    const t2 = createTsh({ right: [{ id: 'build' }] });
    assert.equal(t2.update({ right: hand('right', W) }, null, 0).events.length, 0);
});
test('a two-handed skill chosen on one hand takes the other too, and gives it back', () => {
    const tsh = createTsh({ left: [{ id: 'paint' }, { id: 'grab' }], right: [{ id: 'move' }, { id: 'type', both: true }] });
    tsh.choose('left', 'grab');
    tsh.choose('right', 'type');
    assert.equal(tsh.fn('left')?.id, 'type');
    assert.equal(tsh.fn('right')?.id, 'type');
    tsh.choose('right', 'move'); // anything else: the left hand gets its own back
    assert.equal(tsh.fn('left')?.id, 'grab');
    tsh.choose('left', 'type'); // (chosen from the other hand's list)
    assert.equal(tsh.fn('right')?.id, 'type');
    tsh.release();
    assert.equal(tsh.fn('left')?.id, 'grab');
    assert.equal(tsh.fn('right')?.id, 'move');
});
