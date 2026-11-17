import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTsh, handGestures, type TshHand, type V3 } from './vrtsh.js';

/** A hand palm down, fingers ahead (−z), the wrist at W. Left: the index on the +x side; right: on −x. */
const hand = (side: 'left' | 'right', W: V3, { fist = false, point = false } = {}): TshHand => {
  const s = side === 'left' ? 1 : -1;
  const joints: Record<string, V3> = { wrist: W };
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
  for (const side of ['left', 'right'] as const) {
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
  for (const ic of icons) assert.ok(ic.at[1] > 1.1);
  const target = icons.find((i) => i.fn.id === 'cube')!;
  // the right index tip on it: the right hand's tip is 0.18 ahead of its wrist and 0.03 to the side
  const tipAt = (t: V3) => hand('right', [t[0] + 0.03, t[1], t[2] + 0.18]);
  const f1 = tsh.update({ left, right: tipAt(target.at) }, null, 16);
  assert.equal(f1.left.fn?.id, 'cube');
  assert.deepEqual(f1.events.map((e) => e.type), ['choose']);
  // staying there does not choose again
  const f2 = tsh.update({ left, right: tipAt(target.at) }, null, 32);
  assert.equal(f2.events.length, 0);
  assert.equal(tsh.fn('left')?.id, 'cube');
});
