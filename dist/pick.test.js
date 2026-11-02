import test from 'node:test';
import assert from 'node:assert/strict';
import { box, rotate, bounds, faceNormal, makeCamera, project, ray, pick, crosshair, renderView, displayVersion, } from './index.js';
import { add, dot, len, norm, scale, sub } from './vec.js';
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const nearV = (a, b, eps = 1e-6) => a.every((v, i) => near(v, b[i], eps));
const VIEWS = ['front', 'side', 'top', 'persp'];
test('ray is the inverse of project: a projected point lies on its own ray', () => {
    const m = box({ size: [2, 1, 3], at: [1, 0, 0] });
    const p = [0.3, 0.2, -0.4];
    for (const view of VIEWS) {
        const cam = makeCamera(view, m, 400);
        const s = project(cam, p);
        const { origin, dir } = ray(cam, s.x, s.y);
        const along = add(origin, scale(dir, dot(sub(p, origin), dir)));
        assert.ok(len(sub(p, along)) < 1e-9, `${view}: off the ray`);
        assert.ok(near(len(dir), 1), `${view}: dir is not a unit vector`);
    }
});
test('pick: the center of the front view hits the +z face of a cube', () => {
    const cube = box();
    const cam = makeCamera('front', cube, 400);
    const hit = pick(cube, cam, 200, 200);
    assert.equal(hit.face, 0);
    assert.ok(nearV(hit.normal, [0, 0, 1]));
    assert.ok(nearV(hit.point, [0, 0, 0.5]));
    assert.ok(near(hit.distance, 4 * (Math.sqrt(3) / 2) - 0.5));
    assert.equal(hit.front, true);
});
test('pick: empty space is a miss', () => {
    const cube = box();
    assert.equal(pick(cube, makeCamera('front', cube, 400), 5, 5), null);
});
test('pick: the perspective view finds a camera-facing point on the surface', () => {
    const cube = box();
    const cam = makeCamera('persp', cube, 400);
    const hit = pick(cube, cam, 200, 200);
    const { dir } = ray(cam, 200, 200);
    assert.ok(hit);
    assert.ok(dot(hit.normal, dir) < 0);
    assert.ok(near(Math.max(...hit.point.map(Math.abs)), 0.5));
});
test('pick: the nearer of two stacked faces wins, and cull:false sees the same front', () => {
    const front = box({ at: [0, 0, 2], color: 'near' });
    const back = box({ at: [0, 0, -2], color: 'far' });
    const both = { positions: [...back.positions, ...front.positions], faces: [...back.faces, ...front.faces.map((f) => ({ ...f, v: f.v.map((i) => i + 8) }))] };
    const cam = makeCamera('front', both, 400);
    assert.equal(pick(both, cam, 200, 200).color, 'near');
    assert.equal(pick(both, cam, 200, 200, { cull: false }).color, 'near');
});
test('pick works on the rotated mesh, and the face index gives the object-space normal', () => {
    const cube = box();
    const fit = bounds(cube);
    const turned = rotate(cube, { yaw: Math.PI / 2 }, fit.center);
    const hit = pick(turned, makeCamera('front', turned, 400, fit), 200, 200);
    // after a +90 degree yaw the original -x face looks at the camera
    assert.equal(hit.face, 3);
    assert.ok(nearV(hit.normal, [0, 0, 1]), 'view-space normal faces the camera');
    const own = norm(faceNormal(cube.faces[hit.face].v.map((i) => cube.positions[i])));
    assert.ok(nearV(own, [-1, 0, 0]), 'object-space normal stays on the object');
});
test('crosshair lies flat on the surface: every point is on the hit plane', () => {
    const cube = box({ size: [2, 1, 3] });
    const cam = makeCamera('persp', cube, 400);
    const hit = pick(cube, cam, 190, 210);
    const radius = 0.15;
    const lines = crosshair(cube, hit, radius);
    assert.equal(lines.length, 5);
    for (const p of lines.flat()) {
        assert.ok(Math.abs(dot(hit.normal, sub(p, hit.point))) < 1e-9, 'point off the plane');
    }
    const ring = lines[4];
    assert.equal(ring.length, 33);
    assert.ok(nearV(ring[0], ring[32]), 'ring is closed');
    assert.ok(ring.every((p) => near(len(sub(p, hit.point)), radius)));
});
test('crosshair follows the object: it is aligned to a face edge, not to the world', () => {
    const cube = box();
    const fit = bounds(cube);
    const a = rotate(cube, { yaw: 0.3 }, fit.center);
    const hit = pick(a, makeCamera('front', a, 400, fit), 200, 200);
    const [arm] = crosshair(a, hit, 0.1);
    const [i, j] = a.faces[hit.face].v;
    const edge = norm(sub(a.positions[j], a.positions[i]));
    const dirOfArm = norm(sub(arm[1], arm[0]));
    assert.ok(near(Math.abs(dot(edge, dirOfArm)), 1));
});
test('renderView draws marks on top, deterministically', () => {
    const cube = box();
    const cam = makeCamera('persp', cube, 400);
    const hit = pick(cube, cam, 200, 200);
    const marks = [{ name: 'cursor', lines: crosshair(cube, hit, 0.1) }];
    const svg = renderView(cube, 'persp', { marks });
    assert.equal((svg.match(/<polyline data-mark="cursor"/g) ?? []).length, 5);
    assert.equal(svg, renderView(cube, 'persp', { marks }));
    assert.ok(!/NaN|Infinity/.test(svg));
    assert.ok(svg.lastIndexOf('<polygon') < svg.indexOf('<polyline'), 'marks come after the faces');
});
test('displayVersion gives the readable form', () => {
    assert.equal(displayVersion('26.11.1001'), '26.11.01.001');
});
