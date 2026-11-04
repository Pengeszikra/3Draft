// Boolean operations on closed solids: union, subtract (a - b) and intersect.
// A BSP tree per solid (after Evan Wallace's csg.js): polygons are cut by the planes of the other solid
// and the pieces inside or outside are kept, so every result face stays planar and convex, which is what
// the rest of the engine assumes. The result is welded and its T-junctions are closed, so it is a closed
// solid again and can go into the next boolean. Faces keep the color and material of the face they came from;
// a face cut into a solid by the other one takes the color of the cutting face.

import { sub, dot, cross, len } from './vec.js';
import { faceNormal, bounds } from './mesh.js';
import { validate } from './check.js';
import type { Mesh, Vec3 } from './types.js';

export type BooleanOp = 'union' | 'subtract' | 'intersect';

interface Poly {
  pts: Vec3[];
  n: Vec3;
  w: number;
  color?: string;
  mat?: string;
}
interface Plane {
  n: Vec3;
  w: number;
}

let CSG_EPS = 1e-6; // set per operation, relative to the size of the two solids

const unit = (v: Vec3): Vec3 => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

const polysOf = (mesh: Mesh): Poly[] =>
  mesh.faces.flatMap((f) => {
    const pts = f.v.map((k) => mesh.positions[k]);
    const n = unit(faceNormal(pts));
    return len(faceNormal(pts)) < 1e-12 ? [] : [{ pts, n, w: dot(n, pts[0]), color: f.color, mat: f.mat }];
  });

const flip = (p: Poly): Poly => ({ ...p, pts: [...p.pts].reverse(), n: [-p.n[0], -p.n[1], -p.n[2]], w: -p.w });

/** Cuts `p` by the plane into the four buckets. */
const splitPoly = (plane: Plane, p: Poly, cf: Poly[], cb: Poly[], front: Poly[], back: Poly[]): void => {
  const COPLANAR = 0;
  const FRONT = 1;
  const BACK = 2;
  const SPANNING = 3;
  let type = 0;
  const types = p.pts.map((q) => {
    const t = dot(plane.n, q) - plane.w;
    const k = t < -CSG_EPS ? BACK : t > CSG_EPS ? FRONT : COPLANAR;
    type |= k;
    return k;
  });
  if (type === COPLANAR) (dot(plane.n, p.n) > 0 ? cf : cb).push(p);
  else if (type === FRONT) front.push(p);
  else if (type === BACK) back.push(p);
  else if (type === SPANNING) {
    const f: Vec3[] = [];
    const b: Vec3[] = [];
    for (let i = 0; i < p.pts.length; i++) {
      const j = (i + 1) % p.pts.length;
      const ti = types[i];
      const tj = types[j];
      const vi = p.pts[i];
      const vj = p.pts[j];
      if (ti !== BACK) f.push(vi);
      if (ti !== FRONT) b.push(vi);
      if ((ti | tj) === SPANNING) {
        const t = (plane.w - dot(plane.n, vi)) / dot(plane.n, sub(vj, vi));
        const v: Vec3 = [vi[0] + (vj[0] - vi[0]) * t, vi[1] + (vj[1] - vi[1]) * t, vi[2] + (vj[2] - vi[2]) * t];
        f.push(v);
        b.push(v);
      }
    }
    if (f.length >= 3) front.push({ ...p, pts: f });
    if (b.length >= 3) back.push({ ...p, pts: b });
  }
};

interface Node {
  plane: Plane | null;
  front: Node | null;
  back: Node | null;
  polys: Poly[];
}

const build = (node: Node, polys: Poly[]): void => {
  if (!polys.length) return;
  if (!node.plane) node.plane = { n: polys[0].n, w: polys[0].w };
  const front: Poly[] = [];
  const back: Poly[] = [];
  for (const p of polys) splitPoly(node.plane, p, node.polys, node.polys, front, back);
  if (front.length) build((node.front ??= { plane: null, front: null, back: null, polys: [] }), front);
  if (back.length) build((node.back ??= { plane: null, front: null, back: null, polys: [] }), back);
};

const tree = (polys: Poly[]): Node => {
  const node: Node = { plane: null, front: null, back: null, polys: [] };
  build(node, polys);
  return node;
};

const invert = (node: Node): void => {
  node.polys = node.polys.map(flip);
  if (node.plane) node.plane = { n: [-node.plane.n[0], -node.plane.n[1], -node.plane.n[2]], w: -node.plane.w };
  invert0(node);
};
const invert0 = (node: Node): void => {
  if (node.front) invert(node.front);
  if (node.back) invert(node.back);
  [node.front, node.back] = [node.back, node.front];
};

/** The parts of `polys` that are outside the solid of `node`. */
const clipPolys = (node: Node, polys: Poly[]): Poly[] => {
  if (!node.plane) return [...polys];
  let front: Poly[] = [];
  let back: Poly[] = [];
  for (const p of polys) splitPoly(node.plane, p, front, back, front, back);
  front = node.front ? clipPolys(node.front, front) : front;
  back = node.back ? clipPolys(node.back, back) : [];
  return [...front, ...back];
};

const clipTo = (node: Node, other: Node): void => {
  node.polys = clipPolys(other, node.polys);
  if (node.front) clipTo(node.front, other);
  if (node.back) clipTo(node.back, other);
};

const all = (node: Node): Poly[] => [...node.polys, ...(node.front ? all(node.front) : []), ...(node.back ? all(node.back) : [])];

/** Polygons to a welded mesh: shared vertices, no sliver faces, T-junctions closed. */
const toMesh = (polys: Poly[], scale: number): Mesh => {
  const cell = scale * 1e-5;
  const ids = new Map<string, number>();
  const positions: Vec3[] = [];
  const weld = (p: Vec3): number => {
    // look in the neighbouring cells too, so a point on a cell border still finds its twin
    const base = p.map((c) => Math.round(c / cell));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const hit = ids.get(`${base[0] + dx},${base[1] + dy},${base[2] + dz}`);
      if (hit !== undefined && len(sub(positions[hit], p)) <= cell * 1.5) return hit;
    }
    ids.set(base.join(','), positions.length);
    positions.push(p);
    return positions.length - 1;
  };
  let faces = polys.flatMap((p) => {
    const v: number[] = [];
    for (const q of p.pts) {
      const k = weld(q);
      if (v[v.length - 1] !== k) v.push(k);
    }
    if (v.length > 1 && v[0] === v[v.length - 1]) v.pop();
    if (v.length < 3) return [];
    const n = faceNormal(v.map((k) => positions[k]));
    return len(n) < 1e-9 * scale * scale ? [] : [{ v, color: p.color, mat: p.mat }];
  });

  // T-junctions: a vertex lying on the edge of a neighbouring face gets inserted into that edge
  const used = new Set(faces.flatMap((f) => f.v));
  const verts = [...used];
  if (verts.length * faces.length < 6e7) {
    const tol = scale * 1e-5 * 3;
    faces = faces.map((f) => {
      const out: number[] = [];
      for (let i = 0; i < f.v.length; i++) {
        const a = f.v[i];
        const b = f.v[(i + 1) % f.v.length];
        out.push(a);
        const pa = positions[a];
        const pb = positions[b];
        const d = sub(pb, pa);
        const dl = len(d);
        if (dl < tol * 4) continue;
        const on: { t: number; k: number }[] = [];
        for (const k of verts) {
          if (k === a || k === b) continue;
          const pk = positions[k];
          const t = dot(sub(pk, pa), d) / (dl * dl);
          if (t <= 0 || t >= 1) continue;
          if (len(cross(sub(pk, pa), d)) / dl <= tol) on.push({ t, k });
        }
        on.sort((x, y) => x.t - y.t);
        for (const { k } of on) out.push(k);
      }
      return { ...f, v: out };
    });
  }
  return { positions, faces };
};

const closedSolid = (name: string, m: Mesh): void => {
  const v = validate(m);
  if (!v.closed) throw new Error(`boolean needs closed solids: ${name} has ${v.openEdges} open edge(s)`);
  if (v.inside_out) throw new Error(`boolean needs outward faces: ${name} is inside out`);
};

/** One connected piece of a mesh (faces joined by shared edges). */
export interface Part {
  /** Indices into mesh.faces. */
  faces: number[];
  closed: boolean;
  insideOut: boolean;
  openEdges: number;
}
export interface Health {
  parts: Part[];
  /** Faces in closed, outward parts: the ones a boolean can work with. */
  usableFaces: number;
  /** Faces in open (or inside-out) parts: a boolean ignores them. */
  skippedFaces: number;
  /** true when at least one part is a closed solid. */
  hasSolid: boolean;
  /** true when every part is a closed solid. */
  allSolid: boolean;
}

const subMesh = (mesh: Mesh, idx: number[]): Mesh => {
  const map = new Map<number, number>();
  const positions: Mesh['positions'] = [];
  const faces = idx.map((i) => {
    const f = mesh.faces[i];
    return { ...f, v: f.v.map((k) => (map.has(k) ? (map.get(k) as number) : (map.set(k, positions.length), positions.push(mesh.positions[k]), positions.length - 1))) };
  });
  return { ...mesh, positions, faces };
};

/** Splits a mesh into connected parts and says which of them are closed solids (the health check). */
export const health = (mesh: Mesh): Health => {
  const n = mesh.faces.length;
  const root = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  const seen = new Map<string, number>();
  mesh.faces.forEach((f, i) =>
    f.v.forEach((v, k) => {
      const w = f.v[(k + 1) % f.v.length];
      const key = v < w ? `${v},${w}` : `${w},${v}`;
      const j = seen.get(key);
      if (j === undefined) seen.set(key, i);
      else root[find(i)] = find(j);
    }),
  );
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  const parts: Part[] = [...groups.values()].map((faces) => {
    const v = validate(subMesh(mesh, faces));
    return { faces, closed: v.closed, insideOut: v.inside_out, openEdges: v.openEdges };
  });
  const usable = parts.filter((p) => p.closed && !p.insideOut);
  const usableFaces = usable.reduce((t, p) => t + p.faces.length, 0);
  return { parts, usableFaces, skippedFaces: n - usableFaces, hasSolid: usable.length > 0, allSolid: usable.length === parts.length && parts.length > 0 };
};

const append = (base: Mesh, extra: Mesh): Mesh => {
  const o = base.positions.length;
  return { ...base, positions: [...base.positions, ...extra.positions], faces: [...base.faces, ...extra.faces.map((f) => ({ ...f, v: f.v.map((k) => k + o) }))] };
};

/**
 * Boolean of two closed solids (outward CCW faces): 'union', 'subtract' (a minus b) or 'intersect'.
 * Throws with a reason when an input is open or inside out. With `strict: false` the parts that are not closed solids are
 * left out of the calculation instead (see `health`): a union keeps them as they are, a subtract keeps those of `a`,
 * an intersect drops them; it throws only when `a` has no closed part at all.
 */
export const boolean = (a: Mesh, b: Mesh, op: BooleanOp, { strict = true }: { strict?: boolean } = {}): Mesh => {
  if (strict) {
    closedSolid('a', a);
    closedSolid('b', b);
    return run(a, b, op);
  }
  const ha = health(a);
  const hb = health(b);
  if (!ha.hasSolid) throw new Error('boolean: the model has no closed part (nothing to calculate with)');
  if (!hb.hasSolid) throw new Error('boolean: the second model has no closed part');
  const pick = (m: Mesh, h: Health, closed: boolean): Mesh =>
    subMesh(m, h.parts.filter((p) => (p.closed && !p.insideOut) === closed).flatMap((p) => p.faces).sort((x, y) => x - y));
  let out = run(pick(a, ha, true), pick(b, hb, true), op);
  if (ha.skippedFaces) out = append(out, pick(a, ha, false));
  if (op === 'union' && hb.skippedFaces) out = append(out, pick(b, hb, false));
  return out;
};

const run = (a: Mesh, b: Mesh, op: BooleanOp): Mesh => {
  const sa = bounds(a);
  const sb = bounds(b);
  const scale = Math.max(sa.radius, sb.radius, 1e-9) * 2 + len(sub(sa.center, sb.center));
  CSG_EPS = scale * 1e-9 * 1000;
  const A = tree(polysOf(a));
  const B = tree(polysOf(b));
  if (op === 'union') {
    clipTo(A, B);
    clipTo(B, A);
    invert(B);
    clipTo(B, A);
    invert(B);
    build(A, all(B));
  } else if (op === 'subtract') {
    invert(A);
    clipTo(A, B);
    clipTo(B, A);
    invert(B);
    clipTo(B, A);
    invert(B);
    build(A, all(B));
    invert(A);
  } else {
    invert(A);
    clipTo(B, A);
    invert(B);
    clipTo(A, B);
    clipTo(B, A);
    build(A, all(B));
    invert(A);
  }
  return toMesh(all(A), scale);
};

export const union = (a: Mesh, b: Mesh): Mesh => boolean(a, b, 'union');
export const subtract = (a: Mesh, b: Mesh): Mesh => boolean(a, b, 'subtract');
export const intersect = (a: Mesh, b: Mesh): Mesh => boolean(a, b, 'intersect');
