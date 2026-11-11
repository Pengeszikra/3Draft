import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box } from './mesh.js';
import { bevel } from './bevel.js';
import { validate } from './check.js';
const edgesOf = (m) => {
    const seen = new Map();
    for (const f of m.faces)
        f.v.forEach((a, k) => {
            const b = f.v[(k + 1) % f.v.length];
            seen.set(a < b ? `${a},${b}` : `${b},${a}`, a < b ? [a, b] : [b, a]);
        });
    return [...seen.values()];
};
const closedOk = (m, what) => {
    const v = validate(m);
    assert.ok(v.closed, `${what}: closed (${v.notes.join('; ')})`);
    assert.ok(!v.inside_out, `${what}: faces outward`);
    assert.deepEqual(v.nonConvexFaces, [], `${what}: convex`);
    return v;
};
test('one edge of a cube, flat and round', () => {
    const c = box();
    const e = edgesOf(c)[0];
    for (const n of [1, 2, 3]) {
        const r = bevel(c, [e], 0.2, n);
        const v = closedOk(r.mesh, `1 edge, ${n} segments`);
        assert.ok(v.volume < 1 && v.volume > 0.95, 'a sliver comes off');
        assert.ok(r.mesh.faces.length >= 6 + n);
    }
});
test('all 12 edges of a cube: the corners are filled', () => {
    const c = box();
    for (const n of [1, 2, 4]) {
        const r = bevel(c, edgesOf(c), 0.15, n);
        const v = closedOk(r.mesh, `12 edges, ${n} segments`);
        assert.ok(v.volume < 1 && v.volume > 0.8);
    }
    assert.equal(bevel(c, edgesOf(c), 0.15, 1).mesh.faces.length, 6 + 12 + 8); // faces, strips, corner triangles
});
test('a loop of four edges (the top face), and two edges meeting at a point', () => {
    const c = box();
    const top = c.faces.find((f) => f.v.every((i) => c.positions[i][1] > 0.4));
    const loop = top.v.map((a, k) => [a, top.v[(k + 1) % 4]]);
    closedOk(bevel(c, loop, 0.2, 2).mesh, 'top loop');
    const pair = [loop[0], loop[1]];
    closedOk(bevel(c, pair, 0.2, 3).mesh, 'two edges at a point');
});
test('too wide a bevel is held back, and bad input is refused', () => {
    const c = box();
    const r = bevel(c, edgesOf(c), 5, 1);
    assert.ok(r.width < 0.5);
    closedOk(r.mesh, 'held back');
    assert.throws(() => bevel(c, [], 0.1));
    assert.throws(() => bevel(c, [[0, 1]], 0));
    assert.throws(() => bevel(c, [[0, 6]], 0.1)); // not a line of the mesh
});
