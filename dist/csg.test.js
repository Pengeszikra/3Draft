import test from 'node:test';
import assert from 'node:assert/strict';
import { box, validate, union, subtract, intersect, boolean, merge, health } from './index.js';
const A = () => box({ size: [2, 2, 2], at: [0, 0, 0], color: '#ff0000' });
const B = () => box({ size: [1, 1, 1], at: [1, 0, 0], color: '#0000ff' }); // sticks out of A on +x
const solid = (m, volume, label) => {
    const v = validate(m);
    assert.ok(v.closed, `${label}: closed (${v.notes.join('; ')})`);
    assert.ok(v.ok, `${label}: ok (${v.notes.join('; ')})`);
    assert.ok(Math.abs((v.volume ?? 0) - volume) < 1e-6, `${label}: volume ${v.volume} should be ${volume}`);
};
test('union, subtract and intersect of two overlapping boxes give closed solids with the right volume', () => {
    // A is 8, B is 1, they share 0.5 (x from 0.5 to 1)
    solid(union(A(), B()), 8.5, 'union');
    solid(subtract(A(), B()), 7.5, 'subtract');
    solid(subtract(B(), A()), 0.5, 'subtract b-a');
    solid(intersect(A(), B()), 0.5, 'intersect');
});
test('a box inside another one: subtract leaves a closed cavity, union is the outer box, intersect the inner one', () => {
    const inner = box({ size: [1, 1, 1], at: [0, 0, 0], color: '#00ff00' });
    solid(subtract(A(), inner), 7, 'cavity');
    solid(union(A(), inner), 8, 'union');
    solid(intersect(A(), inner), 1, 'intersect');
});
test('disjoint boxes: union keeps both, intersect is empty', () => {
    const far = box({ size: [1, 1, 1], at: [5, 0, 0] });
    const u = union(A(), far);
    assert.ok(Math.abs((validate(u).volume ?? 0) - 9) < 1e-6);
    assert.equal(intersect(A(), far).faces.length, 0);
});
test('faces keep their colors; a face cut into a solid takes the color of the cutting face', () => {
    const cut = subtract(A(), B());
    const colors = new Set(cut.faces.map((f) => f.color));
    assert.ok(colors.has('#ff0000') && colors.has('#0000ff'));
});
test('the result of a boolean is again a solid that can go into the next boolean', () => {
    const step1 = subtract(A(), B());
    const hole = box({ size: [0.4, 3, 0.4], at: [-0.5, 0, 0] });
    solid(subtract(step1, hole), 7.5 - 0.4 * 0.4 * 2, 'second cut');
});
test('open and inside-out inputs are refused with a reason', () => {
    const open = { positions: A().positions, faces: A().faces.slice(1) };
    assert.throws(() => boolean(open, B(), 'union'), /closed solids: a has \d+ open edge/);
    const inverted = { positions: A().positions, faces: A().faces.map((f) => ({ ...f, v: [...f.v].reverse() })) };
    assert.throws(() => boolean(A(), inverted, 'union'), /inside out/);
    void merge;
});
test('health: connected parts, closed or open; strict:false leaves the open parts out of the calculation', () => {
    const open = box({ size: [1, 1, 1], at: [5, 0, 0], color: '#00ff00' });
    open.faces.splice(3, 1); // a box without one side: an open part
    const model = merge(A(), open);
    const h = health(model);
    assert.equal(h.parts.length, 2);
    assert.equal(h.hasSolid, true);
    assert.equal(h.allSolid, false);
    assert.equal(h.usableFaces, 6);
    assert.equal(h.skippedFaces, 5);
    assert.throws(() => subtract(model, B()), /closed solids/);
    const cut = boolean(model, B(), 'subtract', { strict: false });
    const hc = health(cut);
    assert.equal(hc.skippedFaces, 5, 'the open part comes through unchanged');
    assert.ok(hc.hasSolid);
    const solidPart = hc.parts.find((p) => p.closed);
    assert.ok(solidPart.faces.length > 6, 'the closed box got a notch');
    assert.throws(() => boolean(open, B(), 'subtract', { strict: false }), /no closed part/);
    assert.equal(health(A()).allSolid, true);
});
