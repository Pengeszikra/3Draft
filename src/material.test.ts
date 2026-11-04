import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceOf } from './material.js';
import { buildVertices } from './gpu.js';
import { box } from './index.js';

test('surfaceOf: palette entry, defaults, clamping, fallback', () => {
  const palette = { steel: { color: '#8899aa', metal: 1, rough: 0.3 }, odd: { color: '#000000', alpha: 7, emit: -2 } };
  assert.deepEqual(surfaceOf({ mat: 'steel', color: '#ff0000' }, palette), { color: '#8899aa', metal: 1, rough: 0.3, alpha: 1, emit: 0 });
  assert.deepEqual(surfaceOf({ color: '#ff0000' }, palette), { color: '#ff0000', metal: 0, rough: 0.7, alpha: 1, emit: 0 }, 'no mat: the face color');
  assert.equal(surfaceOf({ mat: 'missing', color: '#123456' }, palette).color, '#123456', 'unknown name: the face color');
  assert.equal(surfaceOf({}, palette).color, '#c8c8c8');
  const odd = surfaceOf({ mat: 'odd' }, palette);
  assert.equal(odd.alpha, 1);
  assert.equal(odd.emit, 0);
  assert.equal(surfaceOf({ mat: 'lamp' }, { lamp: { color: '#ffd36b', emit: 3 } }).emit, 3, 'emit goes above 1');
  assert.equal(surfaceOf({ mat: 'lamp' }, { lamp: { color: '#ffd36b', emit: 50 } }).emit, 5, 'but stops at 5');
});

test('buildVertices carries the material of every face', () => {
  const m = box({ color: '#ff0000' });
  m.faces[0].mat = 'glass';
  const v = buildVertices(m, { glass: { color: '#00ff00', alpha: 0.5, metal: 0.25, rough: 0.1, emit: 0.75 } });
  assert.deepEqual([...v.slice(6, 13)], [0, 1, 0, 0.25, 0.10000000149011612, 0.5, 0.75]);
  assert.deepEqual([...v.slice(13 * 6 + 9, 13 * 6 + 13)], [0, 0.699999988079071, 1, 0], 'the other faces: defaults');
});
