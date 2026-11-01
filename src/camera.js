// Four fixed views, all looking at the mesh bounding-box center.
// front / side / top are orthographic (same scale), persp is a perspective view.

import { add, cross, dot, norm, scale, sub } from './vec.js';
import { bounds } from './mesh.js';

export const VIEW_ORDER = ['front', 'side', 'top', 'persp'];

const FOV = (35 * Math.PI) / 180;

const VIEWS = {
  front: { dir: [0, 0, 1], up: [0, 1, 0], ortho: true }, // eye on +z
  side: { dir: [1, 0, 0], up: [0, 1, 0], ortho: true }, // eye on +x
  top: { dir: [0, 1, 0], up: [0, 0, -1], ortho: true }, // eye on +y, -z is screen-up
  persp: { dir: norm([1, 0.8, 1.2]), up: [0, 1, 0], ortho: false },
};

export const makeCamera = (name, mesh, size) => {
  const spec = VIEWS[name];
  if (!spec) throw new Error(`unknown view: ${name}`);
  const { center, radius } = bounds(mesh);
  const r0 = radius || 1;
  const dist = spec.ortho ? r0 * 4 : (r0 * 1.25) / Math.sin(FOV / 2);
  const eye = add(center, scale(spec.dir, dist));
  const f = norm(sub(center, eye)); // forward
  const r = norm(cross(f, spec.up)); // right
  const u = cross(r, f); // up
  const k = spec.ortho ? ((size / 2) * 0.8) / r0 : size / 2 / Math.tan(FOV / 2);
  return { name, eye, f, r, u, ortho: spec.ortho, k, size };
};

/** World point -> { x, y } in panel pixels (y down) and depth along the view direction. */
export const project = (cam, p) => {
  const d = sub(p, cam.eye);
  const cx = dot(d, cam.r);
  const cy = dot(d, cam.u);
  const depth = dot(d, cam.f);
  const w = cam.ortho ? 1 : depth;
  return {
    x: cam.size / 2 + (cx / w) * cam.k,
    y: cam.size / 2 - (cy / w) * cam.k,
    depth,
  };
};
