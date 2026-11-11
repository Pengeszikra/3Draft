import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lathe } from './lathe.js';
import { health } from './csg.js';
const frame = { origin: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1] };
const volume = (m) => {
    let v = 0;
    for (const f of m.faces) {
        const P = f.v.map((i) => m.positions[i]);
        for (let k = 1; k < P.length - 1; k++) {
            const [a, b, c] = [P[0], P[k], P[k + 1]];
            v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
        }
    }
    return v;
};
test('a cylinder: both ends closed, one solid, outward faces', () => {
    const m = lathe([[0, 1], [2, 1]], frame, 8);
    assert.equal(m.faces.length, 8 + 2); // 8 sides and 2 discs
    const h = health(m);
    assert.ok(h.allSolid && h.parts.length === 1);
    assert.ok(volume(m) > 0, 'faces look outward');
    // an octagon of circumradius 1, 2 long: area 2*sqrt(2)*r^2 = 2.828 -> 5.657
    assert.ok(Math.abs(volume(m) - 2 * 2 * Math.SQRT2) < 1e-9);
});
test('the contour may run either way, and a tip on the axis is a point', () => {
    const a = lathe([[0, 0], [2, 1]], frame, 6); // a cone
    const b = lathe([[2, 1], [0, 0]], frame, 6);
    assert.equal(a.faces.length, 6 + 1);
    assert.ok(volume(a) > 0 && volume(b) > 0);
    assert.ok(Math.abs(volume(a) - volume(b)) < 1e-9);
    assert.ok(health(a).allSolid);
});
test('a vase (profile with a waist) is solid and keeps its normals out', () => {
    const m = lathe([[0, 1], [1, 0.5], [2, 1], [3, 0.8]], frame, 9);
    assert.ok(health(m).allSolid);
    assert.ok(volume(m) > 0);
});
test('bad input is refused', () => {
    assert.throws(() => lathe([[0, 1]], frame, 7));
    assert.throws(() => lathe([[0, 1], [1, 1]], frame, 2));
    assert.throws(() => lathe([[0, 1], [1, -1]], frame, 7));
    assert.throws(() => lathe([[0, 0], [1, 0]], frame, 7));
});
