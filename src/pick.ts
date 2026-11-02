// Surface sensing: what is under a screen pixel, and a marker that lies on it.
// Picking casts a real ray against the face geometry, so it is exact even where
// the painter-sorted drawing is not.

import { cross, dot, norm, plus, minus, times, scale } from './vec.js';
import { faceNormal } from './mesh.js';
import { ray } from './camera.js';
import type { Camera, Hit, Mesh, Vec3 } from './types.js';

const EPS = 1e-9;

// Moller-Trumbore ray/triangle test. Distance along the ray, or null.
const hitTriangle = (o: Vec3, d: Vec3, a: Vec3, b: Vec3, c: Vec3): number | null => {
  const e1 = b |> minus(a);
  const e2 = c |> minus(a);
  const h = cross(d, e2);
  const det = dot(e1, h);
  if (Math.abs(det) < EPS) return null;
  const inv = 1 / det;
  const s = o |> minus(a);
  const u = inv * dot(s, h);
  if (u < 0 || u > 1) return null;
  const q = cross(s, e1);
  const v = inv * dot(d, q);
  if (v < 0 || u + v > 1) return null;
  const t = inv * dot(e2, q);
  return t > EPS ? t : null;
};

/**
 * The nearest surface under panel pixel (x, y), or null.
 * { face, distance, point, normal, front, color }
 * `normal` is a unit vector facing the camera; `front` tells whether the face
 * itself faces the camera (always true while `cull` is on). Faces are assumed
 * convex and planar.
 */
export const pick = (mesh: Mesh, cam: Camera, x: number, y: number, { cull = true }: { cull?: boolean } = {}): Hit | null => {
  const { origin, dir } = ray(cam, x, y);
  let best: Hit | null = null;
  mesh.faces.forEach((face, i) => {
    const pts = face.v.map((k) => mesh.positions[k]);
    const outward = pts |> faceNormal |> norm;
    const front = dot(outward, dir) < 0;
    if (cull && !front) return;
    for (let j = 1; j < pts.length - 1; j++) {
      const t = hitTriangle(origin, dir, pts[0], pts[j], pts[j + 1]);
      if (t !== null && (!best || t < best.distance)) {
        best = {
          face: i,
          distance: t,
          point: dir |> times(t) |> plus(origin),
          normal: front ? outward : outward |> times(-1),
          front,
          color: face.color,
        };
      }
    }
  });
  return best;
};

/**
 * A target cross lying flat on the picked surface (perpendicular to its
 * normal): four arms with a gap in the middle and a ring, as 3D polylines.
 * It is aligned to the first edge of the face, so it turns with the object.
 * `radius` is the ring radius in world units.
 */
export const crosshair = (mesh: Mesh, hit: Hit, radius = 0.1): Vec3[][] => {
  const [a, b] = mesh.faces[hit.face].v;
  const t1 = mesh.positions[b] |> minus(mesh.positions[a]) |> norm;
  const t2 = cross(hit.normal, t1) |> norm;
  const at = (p: number, q: number): Vec3 => scale(t1, p * radius) |> plus(scale(t2, q * radius)) |> plus(hit.point);
  const ring = Array.from({ length: 33 }, (_, i) => {
    const angle = (i / 32) * 2 * Math.PI;
    return at(Math.cos(angle), Math.sin(angle));
  });
  return [
    [at(-1.7, 0), at(-0.4, 0)],
    [at(0.4, 0), at(1.7, 0)],
    [at(0, -1.7), at(0, -0.4)],
    [at(0, 0.4), at(0, 1.7)],
    ring,
  ];
};
