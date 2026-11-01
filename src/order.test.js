import test from 'node:test';
import assert from 'node:assert/strict';
import { box, merge, makeCamera, orbit, pick, standOn, renderView, project, rotate, bounds } from './index.js';
import { table } from '../examples/table-model.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const polygons = (svg) =>
  [...svg.matchAll(/<polygon data-face="(\d+)"[^>]* points="([^"]+)"/g)].map((m) => ({
    face: Number(m[1]),
    pts: m[2].split(' ').map((p) => p.split(',').map(Number)),
  }));
const inside = (pts, x, y) => {
  let pos = false;
  let neg = false;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (c > 0) pos = true;
    else if (c < 0) neg = true;
  }
  return !(pos && neg);
};

const slab = box({ size: [2, 0.15, 1.2], at: [0, 0.925, 0] }); // top face: index 4

// Do two painted polygons share any screen area? (sampled; the order only matters there)
const sharesArea = (p, q) => {
  const xs = p.pts.map((v) => v[0]);
  const ys = p.pts.map((v) => v[1]);
  for (let i = 0; i <= 24; i++) {
    for (let j = 0; j <= 24; j++) {
      const x = Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * i) / 24;
      const y = Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * j) / 24;
      if (inside(p.pts, x, y) && inside(q.pts, x, y)) return true;
    }
  }
  return false;
};

const paintedOverSlab = (px, py) => {
  // the top view maps x to screen x and z to screen y (up is -z)
  const hit = pick(slab, makeCamera('top', slab, 400), px, py);
  assert.equal(hit.face, 4);
  const scene = merge(slab, standOn(slab, hit));
  const polys = polygons(renderView(scene, 'persp'));
  const slabTop = polys.findIndex((p) => p.face === 4);
  assert.ok(slabTop >= 0);
  const covering = polys.filter((p) => p.face >= 6 && sharesArea(p, polys[slabTop]));
  assert.ok(covering.length >= 2, 'the prism overlaps the slab top on screen');
  for (const p of covering) {
    assert.ok(polys.indexOf(p) > slabTop, `prism face ${p.face} must be painted after the slab top`);
  }
};

test('a prism on the far half of a slab is painted over the slab top', () => {
  paintedOverSlab(90, 145); // x about -0.8, z about -0.4: away from the persp camera
});

test('a prism on the near half of a slab is painted over the slab top too', () => {
  paintedOverSlab(310, 255);
});

// End to end: whatever the ray hits first must be the face painted last at that pixel.
const furnished = () => {
  let scene = table;
  const fit = bounds(table);
  const spots = [
    [orbit({ yaw: -0.6, pitch: 0.45 }), [200, 150], '#2f9e44'],
    [orbit({ yaw: -0.6, pitch: 0.45 }), [290, 170], '#1c7ed6'],
    [orbit({ yaw: -0.6, pitch: 0.45 }), [150, 175], '#e8590c'],
    [orbit({ yaw: -0.6, pitch: 0.45 }), [250, 235], '#9c36b5'],
    [orbit({ yaw: 0.9, pitch: 0.6 }), [200, 200], '#f08c00'],
    [orbit({ yaw: 2.4, pitch: 0.5 }), [240, 170], '#0c8599'],
  ];
  for (const [spec, [x, y], color] of spots) {
    const hit = pick(scene, makeCamera(spec, scene, 400, fit), x, y);
    if (hit) scene = merge(scene, standOn(scene, hit, { color }));
  }
  return { scene, fit };
};

test('painting order agrees with exact ray picking on a furnished table', () => {
  const { scene, fit } = furnished();
  assert.ok(scene.faces.length >= table.faces.length + 6 * 4, 'several prisms were placed');
  const views = [
    'persp',
    'front',
    'side',
    'top',
    orbit({ yaw: 0.8, pitch: 0.5 }),
    orbit({ yaw: -2.2, pitch: 0.9 }),
    orbit({ yaw: 2.5, pitch: 0.3 }),
    orbit({ yaw: -0.6, pitch: 0.45 }),
  ];
  let checked = 0;
  for (const view of views) {
    const label = typeof view === 'string' ? view : `orbit ${view.dir.map((v) => v.toFixed(2))}`;
    const svg = renderView(scene, view, { fit });
    const polys = polygons(svg);
    const cam = makeCamera(view, scene, 400, fit);
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 24; j++) {
        const x = 9.37 + i * 16.31;
        const y = 8.11 + j * 16.43;
        const hit = pick(scene, cam, x, y);
        const covering = polys.filter((p) => inside(p.pts, x, y));
        if (!hit) {
          assert.equal(covering.length, 0, `${label} (${x.toFixed(1)}, ${y.toFixed(1)}): painted where nothing is`);
          continue;
        }
        const top = covering.at(-1);
        assert.ok(top, `${label} (${x.toFixed(1)}, ${y.toFixed(1)}): nothing painted on a hit`);
        assert.equal(top.face, hit.face, `${label} (${x.toFixed(1)}, ${y.toFixed(1)}): face ${top.face} painted over the nearer face ${hit.face}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 800, `only ${checked} hit pixels were checked`);
});

test('orbit is the same view as rotating the mesh in front of a fixed camera', () => {
  const m = box({ size: [2, 1, 3], at: [1, 0.5, 0] });
  const fit = bounds(m);
  const angles = { yaw: 0.7, pitch: -0.4 };
  const turned = rotate(m, angles, fit.center);
  const still = { name: 'still', dir: [0, 0, 1], up: [0, 1, 0], ortho: false };
  const a = makeCamera(still, turned, 400, fit);
  const b = makeCamera(orbit(angles), m, 400, fit);
  m.positions.forEach((p, i) => {
    const pa = project(a, turned.positions[i]);
    const pb = project(b, p);
    assert.ok(near(pa.x, pb.x, 1e-9) && near(pa.y, pb.y, 1e-9) && near(pa.depth, pb.depth, 1e-9), `point ${i}`);
  });
});
