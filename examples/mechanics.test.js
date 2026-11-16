import test from 'node:test';
import assert from 'node:assert/strict';
import { mechanics } from './mechanics.js';
import { jointNow } from '../dist/index.js';

test('the mechanics example: its joints and its group, the door open at 35°', () => {
  const s = mechanics();
  assert.equal(s.joints.length, 9);
  assert.deepEqual([...new Set(s.joints.map((j) => j.type))].sort(), ['glue', 'hinge', 'pivot', 'rail', 'spring']);
  assert.equal(s.objects.filter((o) => o.group === 'table').length, 5);
  const mesh = (n) => s.objects.find((o) => o.name === n).mesh;
  const hinge = s.joints.find((j) => j.name === 'door hinge');
  assert.ok(Math.abs(jointNow(hinge, mesh('door post'), mesh('door')).angle - 35) < 1e-9);
});
