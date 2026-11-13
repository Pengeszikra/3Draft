import { test } from 'node:test';
import assert from 'node:assert/strict';
import { galaxyPoints } from './galaxy.js';
const kinds = [
    { kind: 'S', seed: 1, arms: 2, pitch: 15, bar: 0.3 },
    { kind: 'S', seed: 2, arms: 4, pitch: 25, armShare: 0.4 },
    { kind: 'E', seed: 3, b: 0.5, c: 0.7 },
    { kind: 'I', seed: 4, clumps: 3 },
    { kind: 'D', seed: 5, n: 200 },
];
test('a recipe gives the same points every time', () => {
    for (const g of kinds) {
        const a = galaxyPoints(g), b = galaxyPoints(g);
        assert.equal(a.n, b.n);
        assert.deepEqual(Array.from(a.p), Array.from(b.p));
        assert.deepEqual(Array.from(a.c), Array.from(b.c));
    }
});
test('the default counts, all points inside the unit ball, finite', () => {
    const want = { S: 1800, E: 1400, I: 700, D: 200 };
    for (const g of kinds) {
        const q = galaxyPoints(g);
        assert.equal(q.n, want[g.kind]);
        for (let i = 0; i < q.n; i++) {
            const d = Math.hypot(q.p[3 * i], q.p[3 * i + 1], q.p[3 * i + 2]);
            assert.ok(Number.isFinite(d) && d <= 1.0001, `${g.kind} point ${i} at ${d}`);
            assert.ok(q.r[i] > 0 && q.l[i] > 0 && q.c[i] <= 0xffffff);
        }
    }
});
test('different seeds give different galaxies; a spiral is flat, an elliptical is not', () => {
    const a = galaxyPoints({ kind: 'S', seed: 10 }), b = galaxyPoints({ kind: 'S', seed: 11 });
    assert.notDeepEqual(Array.from(a.p.slice(0, 30)), Array.from(b.p.slice(0, 30)));
    const spread = (q, axis) => {
        let s = 0;
        for (let i = 0; i < q.n; i++)
            s += q.p[3 * i + axis] ** 2;
        return Math.sqrt(s / q.n);
    };
    assert.ok(spread(a, 1) < spread(a, 0) * 0.3);
    const e = galaxyPoints({ kind: 'E', seed: 12, b: 0.9, c: 0.9 });
    assert.ok(spread(e, 1) > spread(e, 0) * 0.6);
});
test('the points are shuffled: the first tenth already spreads like the whole', () => {
    const q = galaxyPoints({ kind: 'S', seed: 21, n: 5000 });
    const rms = (from, to) => {
        let s = 0;
        for (let i = from; i < to; i++)
            s += q.p[3 * i] ** 2 + q.p[3 * i + 2] ** 2;
        return Math.sqrt(s / (to - from));
    };
    const all = rms(0, q.n), head = rms(0, 500);
    assert.ok(Math.abs(head - all) / all < 0.15, `${head} vs ${all}`);
});
