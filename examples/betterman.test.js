import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, walkPose, HUMANOID_POSES } from '../dist/index.js';
import { betterman, bettermanIn } from './betterman.js';

test('betterman is two valid solids and a skeleton is found in him', () => {
  const { scene, meshes, rig } = betterman();
  assert.deepEqual(scene.objects.map((o) => o.name), ['body', 'hair']);
  for (const m of meshes) assert.ok(validate(m).ok);
  const at = Object.fromEntries(rig.joints.map((j) => [j.name, j.at]));
  assert.equal(rig.joints.length, 15);
  // 1.84 m tall: crotch about 0.85, armpit about 1.33, neck about 1.55
  assert.ok(Math.abs(at.hipL[1] - 0.9) < 0.05 && Math.abs(at.kneeL[1] - 0.5) < 0.05 && Math.abs(at.ankleL[1] - 0.08) < 0.03);
  assert.ok(Math.abs(at.shoulderL[1] - 1.4) < 0.05 && at.shoulderL[0] > 0.15 && at.shoulderR[0] < -0.15);
  assert.ok(Math.abs(at.elbowL[1] - 1.12) < 0.06 && Math.abs(at.wristL[1] - 0.89) < 0.06);
  assert.ok(Math.abs(at.head[1] - 1.55) < 0.04);
  // the hair goes with the head
  const head = rig.joints.findIndex((j) => j.name === 'head');
  assert.ok(rig.skin[1].every((w) => w.every(([j]) => j === head)));
});

test('he stays a closed solid through a whole walk, a run and the ready poses', () => {
  const man = betterman();
  const poses = [
    ...Array.from({ length: 16 }, (_, i) => walkPose(i / 16)),
    ...Array.from({ length: 8 }, (_, i) => walkPose(i / 8, { stride: 0.9, run: true })),
    ...Object.values(HUMANOID_POSES),
  ];
  for (const pose of poses)
    for (const o of bettermanIn(pose, man)) {
      const v = validate(o.mesh);
      assert.ok(v.ok, `${o.name}: ${v.notes.join('; ')}`);
    }
  // materials are untouched by a pose
  const mats = (objects) => objects.map((o) => [...new Set(o.mesh.faces.map((f) => f.mat))].sort().join(','));
  assert.deepEqual(mats(bettermanIn(HUMANOID_POSES.sit, man)), mats(man.scene.objects));
});
