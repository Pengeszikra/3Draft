import test from 'node:test';
import assert from 'node:assert/strict';
import { box } from './mesh.js';
import { sceneLights, MAX_BONES } from './gpu.js';
test('emissive skin lights follow bones, dim with emission, and account for transformed area', () => {
    const mesh = box({ size: [.2, .2, .2] });
    mesh.faces.forEach(f => f.mat = 'alarm');
    const palette = { alarm: { color: '#ff0000', emit: 2 } }, empty = { positions: [], faces: [] };
    const bones = new Float32Array(MAX_BONES * 12), emission = new Float32Array(MAX_BONES).fill(1);
    bones.set([1, 0, 0, 10, 0, 1, 0, 20, 0, 0, 1, 30]);
    const skin = { meshes: [mesh], weights: [mesh.positions.map(() => [[0, 1]])], bones, emission };
    const bright = sceneLights(empty, undefined, palette, skin);
    assert.ok(bright.length > 0);
    for (let i = 0; i < bright.length; i += 8) {
        assert.ok(Math.abs(bright[i] - 10) < .2);
        assert.ok(Math.abs(bright[i + 1] - 20) < .2);
        assert.ok(Math.abs(bright[i + 2] - 30) < .2);
        assert.equal(bright[i + 4], 1);
        assert.equal(bright[i + 5], 0);
    }
    emission[0] = .25;
    const dim = sceneLights(empty, undefined, palette, skin);
    assert.equal(dim.length, bright.length);
    assert.ok(Math.abs(dim[3] / bright[3] - .5) < 1e-6);
    emission[0] = 0;
    assert.equal(sceneLights(empty, undefined, palette, skin).length, 0);
    emission[0] = 1;
    bones[0] = bones[5] = bones[10] = 2;
    const scaled = sceneLights(empty, undefined, palette, skin);
    assert.ok(Math.abs(scaled[3] / bright[3] - 2) < 1e-6);
    bones[3] = 15;
    const moved = sceneLights(empty, undefined, palette, skin);
    assert.ok(Math.abs(moved[0] - scaled[0] - 5) < 1e-6);
});
