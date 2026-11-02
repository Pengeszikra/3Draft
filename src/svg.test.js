import test from 'node:test';
import assert from 'node:assert/strict';
import { box, merge, renderView, orbit } from './index.js';

const polys = (svg) => (svg.match(/<polygon/g) ?? []).length;

test('faces entirely off the panel are not drawn', () => {
  const m = merge(box({ at: [0, 0, 0] }), box({ at: [40, 0, 0] }), box({ at: [0, 40, 0] }));
  const svg = renderView(m, orbit({ yaw: 0.4, pitch: 0.3 }), { size: 400, fit: { center: [0, 0, 0], radius: 1 } });
  assert.ok(polys(svg) <= 6, `only the near box shows, got ${polys(svg)}`);
  assert.ok(polys(svg) >= 3);
});

test('a face cut by the near plane is clipped, not dropped', () => {
  // the eye sits inside a big floor slab; the floor under it must still be drawn
  const floor = box({ size: [20, 0.2, 20], at: [0, -0.5, 0] });
  const svg = renderView(floor, orbit({ yaw: 0, pitch: 0.4 }), { size: 400, fit: { center: [0, 0, 0], radius: 1, dist: 0.05 } });
  assert.ok(polys(svg) >= 1, 'the top face, partly behind the eye, is clipped and drawn');
  assert.ok(!svg.includes('NaN'));
});

test('faces behind the eye are skipped', () => {
  const m = box({ at: [0, 0, 6] }); // the camera looks towards -z from +z by default; this box is behind it
  const svg = renderView(m, orbit({ yaw: 0, pitch: 0 }), { size: 400, fit: { center: [0, 0, 0], radius: 1, dist: 0.05 } });
  assert.equal(polys(svg), 0);
});
