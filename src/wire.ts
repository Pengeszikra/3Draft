// Drawing on a mesh: put a vertex on a surface, cut a face along a line between two vertices,
// move a vertex, close a loop of lines into a face. The wire is a list of [a, b] vertex pairs next to the mesh:
// its ends are ordinary mesh vertices, so moving a vertex moves every line (and every face) that uses it.
// Faces stay convex and planar: a vertex placed inside a face splits it into triangles, a cut splits a convex
// polygon into two convex ones, and a moved vertex turns the polygons it touches into triangles.

import { sub, add, scale, dot, len } from './vec.js';
import { faceNormal, bounds } from './mesh.js';
import type { Mesh, Vec3, Face } from './types.js';

/** Lines drawn on / off a mesh: pairs of vertex indices. */
export type Wire = [number, number][];

const sizeOf = (mesh: Mesh): number => bounds(mesh).radius || 1;

/** Distance from `p` to the segment a-b, and where along it (0..1). */
const toSegment = (p: Vec3, a: Vec3, b: Vec3): { distance: number; t: number } => {
  const ab = sub(b, a);
  const l2 = dot(ab, ab) || 1;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return { distance: len(sub(p, add(a, scale(ab, t)))), t };
};

const withFaces = (mesh: Mesh, faces: Face[], positions: Vec3[] = mesh.positions): Mesh => ({ ...mesh, positions, faces });

/**
 * Puts a vertex at `point`, which lies on face `face`. On an existing vertex it returns that one; on an edge it is
 * added to both faces that share the edge (no crack); inside the face it splits the face into triangles around it.
 * { mesh, index }
 */
export const insertVertex = (mesh: Mesh, face: number, point: Vec3): { mesh: Mesh; index: number } => {
  const eps = 1e-6 * sizeOf(mesh);
  const f = mesh.faces[face];
  const { positions } = mesh;
  for (const v of f.v) if (len(sub(positions[v], point)) <= eps * 10) return { mesh, index: v };

  const index = positions.length;
  const next = [...positions, point];
  const m = f.v.length;
  for (let j = 0; j < m; j++) {
    const a = f.v[j];
    const b = f.v[(j + 1) % m];
    if (toSegment(point, positions[a], positions[b]).distance > eps * 10) continue;
    // on the edge a-b: every face holding that edge (same positions, either direction) gets the new vertex
    const faces = mesh.faces.map((g, gi) => {
      const n = g.v.length;
      for (let k = 0; k < n; k++) {
        const p = positions[g.v[k]];
        const q = positions[g.v[(k + 1) % n]];
        const same = (len(sub(p, positions[a])) <= eps && len(sub(q, positions[b])) <= eps) || (len(sub(p, positions[b])) <= eps && len(sub(q, positions[a])) <= eps);
        if (same) return { ...g, v: [...g.v.slice(0, k + 1), index, ...g.v.slice(k + 1)] };
      }
      return gi === face ? g : g;
    });
    return { mesh: withFaces(mesh, faces, next), index };
  }
  // inside: a fan of triangles around the new vertex, same side as the face
  const fan: Face[] = f.v.map((v, j) => ({ ...f, v: [v, f.v[(j + 1) % m], index] }));
  return { mesh: withFaces(mesh, [...mesh.faces.slice(0, face), ...fan, ...mesh.faces.slice(face + 1)], next), index };
};

/**
 * Cuts the face that holds vertices `a` and `b` (not next to each other) along the line a-b: two convex faces.
 * `cut` is false when no face holds both, or they are already neighbours on every face.
 */
export const cutFace = (mesh: Mesh, a: number, b: number): { mesh: Mesh; cut: boolean } => {
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const f = mesh.faces[fi];
    const ia = f.v.indexOf(a);
    const ib = f.v.indexOf(b);
    if (ia < 0 || ib < 0) continue;
    const m = f.v.length;
    if ((ia - ib + m) % m === 1 || (ib - ia + m) % m === 1) continue;
    const walk = (from: number, to: number): number[] => {
      const out = [f.v[from]];
      for (let k = from; k !== to; ) {
        k = (k + 1) % m;
        out.push(f.v[k]);
      }
      return out;
    };
    const faces = [...mesh.faces.slice(0, fi), { ...f, v: walk(ia, ib) }, { ...f, v: walk(ib, ia) }, ...mesh.faces.slice(fi + 1)];
    return { mesh: withFaces(mesh, faces), cut: true };
  }
  return { mesh, cut: false };
};

/** Moves vertex `i` to `to`. Polygons that use it become triangles, so every face stays planar. */
export const moveVertex = (mesh: Mesh, i: number, to: Vec3): Mesh => {
  const positions = mesh.positions.map((p, k) => (k === i ? to : p));
  const faces: Face[] = [];
  for (const f of mesh.faces) {
    if (f.v.length <= 3 || !f.v.includes(i)) faces.push(f);
    else for (let j = 1; j < f.v.length - 1; j++) faces.push({ ...f, v: [f.v[0], f.v[j], f.v[j + 1]] });
  }
  return withFaces(mesh, faces, positions);
};

/**
 * A face from a closed loop of vertices. It is wound to point away from `awayFrom` (default: the middle of the
 * mesh), which is what a patch closing a gap in a surface wants; 4 or more vertices become a fan of triangles.
 */
export const fillLoop = (mesh: Mesh, loop: number[], face: Partial<Face> = {}, awayFrom: Vec3 = bounds(mesh).center): Mesh => {
  if (loop.length < 3) return mesh;
  const pts = loop.map((v) => mesh.positions[v]);
  const centre = scale(pts.reduce((s, p) => add(s, p), [0, 0, 0] as Vec3), 1 / pts.length);
  const ordered = dot(faceNormal(pts), sub(centre, awayFrom)) >= 0 ? loop : [...loop].reverse();
  const out: Face[] = [];
  for (let j = 1; j < ordered.length - 1; j++) out.push({ ...face, v: [ordered[0], ordered[j], ordered[j + 1]] });
  return withFaces(mesh, [...mesh.faces, ...out]);
};

/** Adds the line a-b (not twice, not a point). */
export const addLine = (wire: Wire, a: number, b: number): Wire => (a === b || wire.some(([p, q]) => (p === a && q === b) || (p === b && q === a)) ? wire : [...wire, [a, b]]);

/**
 * The shortest closed loop of lines through line [a, b], at most `max` vertices: [a, ..., b], or null.
 * Close it with fillLoop.
 */
export const findLoop = (wire: Wire, [a, b]: [number, number], max = 8): number[] | null => {
  const near = new Map<number, number[]>();
  for (const [p, q] of wire) {
    if ((p === a && q === b) || (p === b && q === a)) continue; // not through the line itself
    near.set(p, [...(near.get(p) ?? []), q]);
    near.set(q, [...(near.get(q) ?? []), p]);
  }
  const from = new Map<number, number>([[a, -1]]);
  const queue = [a];
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head];
    if (v === b) break;
    for (const w of near.get(v) ?? []) if (!from.has(w)) (from.set(w, v), queue.push(w));
  }
  if (!from.has(b)) return null;
  const path: number[] = [];
  for (let v = b; v !== -1; v = from.get(v) as number) path.unshift(v);
  return path.length <= max ? path : null;
};
