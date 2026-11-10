import test from 'node:test';
import assert from 'node:assert/strict';
import { box, saw, validate, faceNormal, subtract } from './index.js';
// an L-shaped prism (concave top and bottom faces), outward faces
const lPrism = () => {
    let ring = [[0, 0, 0], [3, 0, 0], [3, 0, 1], [1, 0, 1], [1, 0, 3], [0, 0, 3]];
    if (faceNormal(ring)[1] < 0)
        ring = [...ring].reverse();
    const n = ring.length;
    const positions = [...ring, ...ring.map((p) => [p[0], 1, p[2]])];
    const faces = [
        { v: ring.map((_, i) => n + i), color: '#aa8866' },
        { v: ring.map((_, i) => n - 1 - i), color: '#aa8866' },
        ...ring.map((_, i) => ({ v: [i, (i + 1) % n, n + ((i + 1) % n), n + i], color: '#aa8866' })),
    ];
    return { positions, faces };
};
test('the L prism with concave caps is a closed solid and a boolean with it stays sound', () => {
    const l = lPrism();
    const v = validate(l);
    assert.ok(v.closed && !v.inside_out);
    const dent = subtract(l, box({ size: [0.5, 0.5, 0.5], at: [2, 1, 0.5] }));
    const vd = validate(dent);
    assert.ok(vd.closed && !vd.inside_out, 'the concave top face was cut by its triangles, the result is closed');
});
test('a saw through the L cuts it into two closed solids', () => {
    const { front, back } = saw(lPrism(), { point: [2, 0, 0], n: [1, 0, 0] });
    for (const m of [...front, ...back]) {
        const v = validate(m);
        assert.ok(v.closed && !v.inside_out);
    }
    assert.equal(front.length + back.length, 2);
});
test('a model of several shells: every closed one is cut, an open one goes whole to its side', () => {
    const cube = box({ size: [2, 2, 2], at: [0, 1, 0] });
    const small = box({ size: [0.4, 0.4, 0.4], at: [0.1, 2.3, 0] }); // another closed shell standing on the cube, over the plane x = 0.1
    const quad = { positions: [[-1, 3, -1], [-0.5, 3, -1], [-0.5, 3, 1], [-1, 3, 1]], faces: [{ v: [0, 1, 2, 3], color: '#ff0000' }] }; // open, on the back side
    const o = cube.positions.length;
    const o2 = o + small.positions.length;
    const mesh = {
        positions: [...cube.positions, ...small.positions, ...quad.positions],
        faces: [...cube.faces, ...small.faces.map((f) => ({ ...f, v: f.v.map((k) => k + o) })), ...quad.faces.map((f) => ({ ...f, v: f.v.map((k) => k + o2) }))],
    };
    const { front, back } = saw(mesh, { point: [0.1, 0, 0], n: [1, 0, 0] });
    assert.equal(front.length, 2, 'the cube half and the small box half in front');
    assert.equal(back.length, 3, 'the cube half, the small box half and the open quad behind');
    assert.ok([...front, ...back].filter((m) => validate(m).closed).length === 4);
});
