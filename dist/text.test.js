import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box, bounds } from './mesh.js';
import { faceFrame, textMesh, GLYPHS, STROKE } from './text.js';
import { validate } from './check.js';
const front = (m) => m.faces.findIndex((f) => f.v.every((i) => m.positions[i][2] > 0.49));
test('a face gives the frame: lower left corner, its height, outward', () => {
    const m = box({ size: [2, 1, 1] });
    const fr = faceFrame(m, front(m));
    assert.deepEqual(fr.normal.map((v) => Math.round(v)), [0, 0, 1]);
    assert.deepEqual(fr.right.map((v) => Math.round(v)), [1, 0, 0]);
    assert.deepEqual(fr.up.map((v) => Math.round(v)), [0, 1, 0]);
    assert.ok(Math.abs(fr.height - 1) < 1e-9);
    assert.deepEqual(fr.origin.map((v) => +v.toFixed(6)), [-1, -0.5, 0.5]);
});
test('the stroke is 20 % of the letter height, and the letters stand out by the same', () => {
    const m = box({ size: [2, 1, 1] });
    const fr = faceFrame(m, front(m));
    const t = textMesh('I', fr, { mat: 'wood' });
    const b = (() => {
        const lo = [Infinity, Infinity, Infinity];
        const hi = [-Infinity, -Infinity, -Infinity];
        for (const p of t.positions)
            p.forEach((c, i) => ((lo[i] = Math.min(lo[i], c)), (hi[i] = Math.max(hi[i], c))));
        return { lo, hi };
    })();
    assert.ok(Math.abs(b.hi[1] - b.lo[1] - 1) < 1e-9, 'the letter is as high as the face');
    assert.ok(Math.abs(b.hi[2] - b.lo[2] - STROKE) < 1e-9, 'it stands out by 20 % of the height');
    assert.ok(Math.abs(b.lo[2] - 0.5) < 1e-9, 'on the face');
    assert.ok(t.faces.every((f) => f.mat === 'wood'));
    assert.ok(bounds(t).radius > 0);
});
test('every glyph builds, spaces move on, accents and lower case work', () => {
    const m = box();
    const fr = faceFrame(m, front(m));
    for (const ch of Object.keys(GLYPHS))
        if (ch !== ' ')
            assert.ok(textMesh(ch, fr).faces.length >= 6, ch);
    assert.ok(textMesh('Árvíztűrő tükörfúrógép', fr).faces.length > 100);
    assert.equal(textMesh('abc', fr).faces.length, textMesh('ABC', fr).faces.length);
    assert.equal(textMesh('   ', fr).faces.length, 0);
    assert.ok(validate(textMesh('HI', fr)).ok ?? true);
});
