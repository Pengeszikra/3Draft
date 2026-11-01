// Mesh = { positions: [[x, y, z], ...], faces: [{ v: [i, j, k, ...], color }] }
// Faces are CCW when seen from outside. No normals, UVs or textures yet.

import { add, len, sub } from './vec.js';

/** Axis-aligned box: 8 points, 12 edges, 6 quad faces. */
export const box = ({ size = [1, 1, 1], at = [0, 0, 0], color = '#c8c8c8' } = {}) => {
  const [hx, hy, hz] = size.map((s) => s / 2);
  const [x, y, z] = at;
  const positions = [
    [x - hx, y - hy, z - hz], // 0
    [x + hx, y - hy, z - hz], // 1
    [x + hx, y + hy, z - hz], // 2
    [x - hx, y + hy, z - hz], // 3
    [x - hx, y - hy, z + hz], // 4
    [x + hx, y - hy, z + hz], // 5
    [x + hx, y + hy, z + hz], // 6
    [x - hx, y + hy, z + hz], // 7
  ];
  const faces = [
    [4, 5, 6, 7], // +z
    [1, 0, 3, 2], // -z
    [1, 2, 6, 5], // +x
    [0, 4, 7, 3], // -x
    [3, 7, 6, 2], // +y
    [0, 1, 5, 4], // -y
  ].map((v) => ({ v, color }));
  return { positions, faces };
};

/** Concatenate meshes into one, re-indexing the faces. */
export const merge = (...meshes) => {
  const positions = [];
  const faces = [];
  for (const m of meshes) {
    const offset = positions.length;
    positions.push(...m.positions);
    for (const f of m.faces) faces.push({ ...f, v: f.v.map((i) => i + offset) });
  }
  return { positions, faces };
};

/** Bounding box center and bounding sphere radius around that center. */
export const bounds = (mesh) => {
  if (!mesh.positions.length) return { center: [0, 0, 0], radius: 0 };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.positions) {
    for (let a = 0; a < 3; a++) {
      if (p[a] < min[a]) min[a] = p[a];
      if (p[a] > max[a]) max[a] = p[a];
    }
  }
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  let radius = 0;
  for (const p of mesh.positions) radius = Math.max(radius, len(sub(p, center)));
  return { center, radius };
};

/**
 * Turntable rotation: yaw around Y first, then pitch around X (radians),
 * both around `center` (default: bounding-box center). Faces are shared.
 */
export const rotate = (mesh, { yaw = 0, pitch = 0 } = {}, center = bounds(mesh).center) => {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const positions = mesh.positions.map((p) => {
    const x = p[0] - center[0];
    const y = p[1] - center[1];
    const z = p[2] - center[2];
    const x1 = cy * x + sy * z;
    const z1 = -sy * x + cy * z;
    return [x1 + center[0], cp * y - sp * z1 + center[1], sp * y + cp * z1 + center[2]];
  });
  return { positions, faces: mesh.faces };
};

/** Face normal (not normalized) by Newell's method; points CCW => outward. */
export const faceNormal = (pts) => {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
};

/** Mean of the face points. */
export const faceCenter = (pts) => {
  const s = pts.reduce((acc, p) => add(acc, p), [0, 0, 0]);
  return [s[0] / pts.length, s[1] / pts.length, s[2] / pts.length];
};
