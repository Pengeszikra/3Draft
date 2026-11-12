// Moving a humanoid: a skeleton of joints, joint weights per vertex, and a pose that turns the joints.
// Nothing is stored in the model. humanoidRig() reads the skeleton and the weights off the shape itself (two legs,
// two hanging arms, a neck), so a figure that was edited by hand, or made by somebody else, moves the same way.
// posed() only moves vertices: the faces, their colours and materials stay, a face that is bent becomes triangles.
// Y is up, the figure stands on its feet and looks to +z, so its left side is +x. Angles are radians.

import { add, sub, scale, dot, cross, len, minus, times } from './vec.js';
import { bounds, faceNormal } from './mesh.js';
import { triangulate } from './triangulate.js';
import type { Face, Mesh, Vec3 } from './types.js';

export interface Joint {
  name: string;
  /** Name of the joint this one hangs on; null for the root. Parents come before their children in a rig. */
  parent: string | null;
  /** The point the joint turns about, in the bind pose. */
  at: Vec3;
}

/** The joints that move one vertex: [index into `joints`, share]. The shares add up to 1. */
export type Weights = [joint: number, weight: number][];

export interface Rig {
  joints: Joint[];
  /** `skin[m][i]` belongs to vertex i of mesh m (the meshes the rig was made of, in that order). */
  skin: Weights[][];
}

/** Joint name -> [rx, ry, rz], relative to the bind pose, applied x, then y, then z in the parent's space. */
export type Pose = { [joint: string]: Vec3 | undefined };

export interface PoseOptions {
  /** Shifts the whole figure. */
  move?: Vec3;
  /** Puts the lowest point back on the height the bind pose stands on. */
  ground?: boolean;
}

const rotX = ([x, y, z]: Vec3, a: number): Vec3 => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotY = ([x, y, z]: Vec3, a: number): Vec3 => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z]: Vec3, a: number): Vec3 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
const euler = (p: Vec3, [rx, ry, rz]: Vec3): Vec3 => rotZ(rotY(rotX(p, rx), ry), rz);

/** A rigid move as three columns and a shift: p -> x*cols[0] + y*cols[1] + z*cols[2] + shift. */
interface Rigid {
  cols: [Vec3, Vec3, Vec3];
  shift: Vec3;
}
const apply = (m: Rigid, p: Vec3): Vec3 => add(add(add(scale(m.cols[0], p[0]), scale(m.cols[1], p[1])), scale(m.cols[2], p[2])), m.shift);
/** The move "turn by `angles` about `at`, then `parent`". */
const jointMove = (parent: Rigid, angles: Vec3, at: Vec3): Rigid => {
  const turn = (p: Vec3): Vec3 => add(euler(sub(p, at), angles), at);
  const o = apply(parent, turn([0, 0, 0]));
  const col = (e: Vec3): Vec3 => sub(apply(parent, turn(e)), o);
  return { cols: [col([1, 0, 0]), col([0, 1, 0]), col([0, 0, 1])], shift: o };
};

/** Where every joint takes the points that hang on it. */
const jointMoves = (joints: Joint[], pose: Pose, move: Vec3): Rigid[] => {
  const byName = new Map<string, Rigid>();
  const start: Rigid = { cols: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], shift: move };
  return joints.map((j) => {
    const parent = j.parent === null ? start : byName.get(j.parent);
    if (!parent) throw new Error(`joint "${j.name}" comes before its parent "${j.parent}"`);
    const m = jointMove(parent, pose[j.name] ?? [0, 0, 0], j.at);
    byName.set(j.name, m);
    return m;
  });
};

/**
 * Triangles of a bent face. A corner lying on the line of its neighbours makes a fan from the wrong corner flat
 * (a triangle without area, which opens the mesh), so when the plain cut has one, the fan is started elsewhere.
 */
const soundTriangles = (pts: Vec3[]): [number, number, number][] => {
  const n = faceNormal(pts);
  const least = dot(n, n) * 1e-12;
  const sound = (tris: [number, number, number][]) =>
    tris.every(([a, b, c]) => {
      const t = cross(sub(pts[b]!, pts[a]!), sub(pts[c]!, pts[a]!));
      return dot(t, n) > 0 && dot(t, t) > least;
    });
  const plain = triangulate(pts);
  if (sound(plain)) return plain;
  for (let k = 0; k < pts.length; k++) {
    const fan = pts.slice(2).map((_, i): [number, number, number] => [k, (k + i + 1) % pts.length, (k + i + 2) % pts.length]);
    if (sound(fan)) return fan;
  }
  return plain;
};

/** Faces of four or more corners that are no longer flat (or no longer convex) become triangles; they keep their colour and material. */
const flat = (mesh: Mesh): Mesh => {
  const size = bounds(mesh).radius || 1;
  const faces: Face[] = [];
  for (const f of mesh.faces) {
    const pts = f.v.map((i) => mesh.positions[i]!);
    let bent = false;
    if (pts.length > 3) {
      const n = faceNormal(pts);
      const l = len(n);
      const turnsBack = (a: Vec3, b: Vec3, c: Vec3) => dot(cross(sub(b, a), sub(c, b)), n) / l < -5e-10 * size * size;
      bent =
        l === 0 ||
        pts.some((p) => Math.abs(dot(n, sub(p, pts[0]!))) / l > size * 4e-7) ||
        pts.some((p, i) => turnsBack(p, pts[(i + 1) % pts.length]!, pts[(i + 2) % pts.length]!));
    }
    if (!bent) faces.push(f);
    else for (const t of soundTriangles(pts)) faces.push({ ...f, v: t.map((k) => f.v[k]!) });
  }
  return { positions: mesh.positions, faces };
};

/**
 * The meshes in a pose. `meshes` are the ones the rig was made of. Every vertex goes where its joints take it,
 * mixed by its weights; faces stay as they are unless the move bends them.
 */
export const posed = (meshes: Mesh[], rig: Rig, pose: Pose = {}, { move = [0, 0, 0], ground = false }: PoseOptions = {}): Mesh[] => {
  if (meshes.length !== rig.skin.length) throw new Error(`the rig is for ${rig.skin.length} mesh(es), got ${meshes.length}`);
  const moves = jointMoves(rig.joints, pose, move);
  let out = meshes.map((mesh, m) => {
    const skin = rig.skin[m]!;
    if (skin.length !== mesh.positions.length) throw new Error(`mesh ${m} has ${mesh.positions.length} points, the rig knows ${skin.length}`);
    return {
      positions: mesh.positions.map((p, i) => skin[i]!.reduce<Vec3>((sum, [j, w]) => add(sum, scale(apply(moves[j]!, p), w)), [0, 0, 0])),
      faces: mesh.faces,
    };
  });
  if (ground) {
    const low = (ms: Mesh[]) => Math.min(...ms.flatMap((m) => m.positions.map((p) => p[1])));
    const lift: Vec3 = [0, low(meshes) - low(out), 0];
    out = out.map((m) => ({ ...m, positions: m.positions.map((p) => add(p, lift)) }));
  }
  return out.map(flat);
};

/** Where the joints are in a pose (the same order as `rig.joints`). */
export const posedJoints = (rig: Rig, pose: Pose = {}, { move = [0, 0, 0] }: PoseOptions = {}): Vec3[] => {
  const moves = jointMoves(rig.joints, pose, move);
  return rig.joints.map((j, i) => apply(moves[i]!, j.at));
};

/**
 * The joint moves of a pose for a GPU skin: 12 floats per joint (`rig.joints` order), the three rows of the 3x4 matrix
 * [cols | shift], so a vertex goes to (dot(row0, [p, 1]), dot(row1, [p, 1]), dot(row2, [p, 1])). The same moves as posed().
 */
export const boneMatrices = (rig: Rig, pose: Pose = {}, { move = [0, 0, 0] }: PoseOptions = {}): Float32Array => {
  const moves = jointMoves(rig.joints, pose, move);
  const out = new Float32Array(moves.length * 12);
  moves.forEach((m, j) => {
    for (let r = 0; r < 3; r++) out.set([m.cols[0][r], m.cols[1][r], m.cols[2][r], m.shift[r]], j * 12 + r * 4);
  });
  return out;
};

/**
 * How much a posed figure must be lifted so that its lowest point stays where the bind pose's was (what `ground: true`
 * does in posed()), without building the posed meshes: only the heights of the points are mixed.
 */
export const poseLift = (meshes: Mesh[], rig: Rig, pose: Pose = {}): number => {
  const bones = boneMatrices(rig, pose);
  let bind = Infinity;
  let low = Infinity;
  meshes.forEach((mesh, m) =>
    mesh.positions.forEach((p, i) => {
      bind = Math.min(bind, p[1]);
      let y = 0;
      for (const [j, w] of rig.skin[m]![i]!) y += w * (bones[j * 12 + 4]! * p[0] + bones[j * 12 + 5]! * p[1] + bones[j * 12 + 6]! * p[2] + bones[j * 12 + 7]!);
      low = Math.min(low, y);
    }),
  );
  return Number.isFinite(low) ? bind - low : 0;
};

// ---------- reading a humanoid off its shape ----------

const smooth = (from: number, to: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
const mean = (pts: Vec3[]): Vec3 | null => (pts.length ? scale(pts.reduce(add, [0, 0, 0]), 1 / pts.length) : null);

/** Groups of points joined by face edges, counting only the points that `keep` lets in. Returns a group id per point (-1: left out). */
const groups = (count: number, edges: [number, number][], keep: (i: number) => boolean): number[] => {
  const up = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    while (up[i] !== i) {
      up[i] = up[up[i]!]!;
      i = up[i]!;
    }
    return i;
  };
  for (const [a, b] of edges) if (keep(a) && keep(b)) up[find(a)] = find(b);
  return up.map((_, i) => (keep(i) ? find(i) : -1));
};

export const HUMANOID_JOINTS = [
  'root', 'spine', 'head',
  'shoulderL', 'elbowL', 'wristL', 'hipL', 'kneeL', 'ankleL',
  'shoulderR', 'elbowR', 'wristR', 'hipR', 'kneeR', 'ankleR',
] as const;

/**
 * The skeleton and the weights of a standing figure, read off its shape. It must stand on two feet joined in one
 * mesh, look to +z, and its arms must hang (a relaxed or A pose; a T pose is not understood). Other meshes and loose
 * shells (hair, a hat, a watch) follow the nearest point of the body. Throws with the reason when no figure is found.
 *
 * Joints: root (hips), spine, head, and per side (L is +x) shoulder, elbow, wrist, hip, knee, ankle.
 */
export const humanoidRig = (meshes: Mesh[]): Rig => {
  // every point of every mesh in one list
  const P: Vec3[] = [];
  const start: number[] = [];
  const edges: [number, number][] = [];
  for (const mesh of meshes) {
    const base = P.length;
    start.push(base);
    P.push(...mesh.positions);
    for (const f of mesh.faces) f.v.forEach((a, k) => edges.push([base + a, base + f.v[(k + 1) % f.v.length]!]));
  }
  if (P.length < 8) throw new Error('no figure: the scene is empty');
  const ys = P.map((p) => p[1]);
  const ground = Math.min(...ys);
  const H = Math.max(...ys) - ground;
  const cx = (Math.min(...P.map((p) => p[0])) + Math.max(...P.map((p) => p[0]))) / 2;
  const off = (i: number) => P[i]![0] - cx; // + is the figure's left

  // the feet: the lowest point on each side; the body is the shell they both belong to
  const lowest = (side: number) =>
    P.reduce((best, p, i) => (off(i) * side > 0 && (best < 0 || p[1] < P[best]![1]) ? i : best), -1);
  const foot = [lowest(1), lowest(-1)];
  const whole = groups(P.length, edges, () => true);
  if (foot[0]! < 0 || foot[1]! < 0 || whole[foot[0]!] !== whole[foot[1]!]) throw new Error('no figure: the two feet are not parts of one mesh');
  const body = (i: number) => whole[i] === whole[foot[0]!];
  const levels = [...new Set(P.filter((_, i) => body(i)).map((p) => p[1]))].sort((a, b) => a - b);
  const below = (h: number) => groups(P.length, edges, (i) => body(i) && P[i]![1] < h);

  // the crotch: the highest level under which the two legs are still apart
  let crotch = -1;
  let legOf: number[] = [];
  for (const h of levels) {
    const g = below(h);
    if (g[foot[0]!]! < 0 || g[foot[1]!]! < 0) continue;
    if (g[foot[0]!] === g[foot[1]!]) break;
    crotch = h;
    legOf = g;
  }
  if (crotch < 0) throw new Error('no figure: the legs do not part');
  const legId = [legOf[foot[0]!]!, legOf[foot[1]!]!];
  const inLeg = (i: number, s: number) => legOf[i] === legId[s];

  // the armpits: the highest level under which something long still hangs free of the legs on that side
  const arm: { pit: number; has: Set<number> }[] = [];
  for (const side of [1, -1]) {
    let found: { pit: number; has: Set<number> } | null = null;
    for (const h of levels) {
      if (h <= ground + 0.3 * H || h > ground + 0.92 * H) continue;
      const g = below(h);
      const feet = new Set([g[foot[0]!], g[foot[1]!]]);
      const parts = new Map<number, number[]>();
      g.forEach((id, i) => {
        if (id >= 0 && !feet.has(id)) parts.set(id, [...(parts.get(id) ?? []), i]);
      });
      let best: number[] | null = null;
      for (const part of parts.values()) {
        const c = mean(part.map((i) => P[i]!))!;
        const drop = h - Math.min(...part.map((i) => P[i]![1]));
        if ((c[0] - cx) * side > 0.05 * H && drop > 0.12 * H && (!best || part.length > best.length)) best = part;
      }
      if (best) found = { pit: h, has: new Set(best) };
    }
    if (!found) throw new Error(`no figure: no hanging ${side > 0 ? 'left' : 'right'} arm (the arms must hang, apart from the trunk)`);
    arm.push(found);
  }

  // measures of an arm: its inner side and thickness at the armpit, the shoulder it turns about, the line to the fingertip
  const arms = arm.map(({ pit, has }, s) => {
    const side = s === 0 ? 1 : -1;
    const pts = [...has].map((i) => P[i]!);
    const lowY = Math.min(...pts.map((p) => p[1]));
    const highY = Math.max(...pts.map((p) => p[1]));
    const top = pts.filter((p) => p[1] >= highY - 0.25 * (pit - lowY));
    const reach = top.map((p) => (p[0] - cx) * side);
    const inner = Math.min(...reach);
    const thick = Math.max(Math.max(...reach) - inner, 0.02 * H);
    const shoulder: Vec3 = [cx + side * inner, pit + thick / 2, mean(top)![2]];
    const tip = pts.reduce((far, p) => (len(sub(p, shoulder)) > len(sub(far, shoulder)) ? p : far), pts[0]!);
    const line = tip |> minus(shoulder);
    const along = (p: Vec3) => dot(sub(p, shoulder), line) / dot(line, line);
    const at = (t: number): Vec3 => mean(pts.filter((p) => Math.abs(along(p) - t) < 0.05)) ?? (line |> times(t) |> ((v: Vec3) => add(shoulder, v)));
    return { side, pit, has, inner, thick, shoulder, along, elbow: at(0.42), wrist: at(0.74) };
  });
  const ELBOW = 0.42;
  const WRIST = 0.74;

  // the neck: the narrowest level of the trunk between the shoulders and the top of the head
  const armInner = Math.min(...arms.map((a) => a.inner));
  const pitTop = Math.max(...arms.map((a) => a.pit));
  const trunk = P.map((_, i) => i).filter((i) => body(i) && Math.abs(off(i)) < armInner && !arms.some((a) => a.has.has(i)));
  let neck = pitTop + 0.5 * (ground + H - pitTop);
  let narrow = Infinity;
  for (const h of levels) {
    if (h < pitTop + 0.03 * H || h > ground + H - 0.08 * H) continue;
    const xs = trunk.filter((i) => Math.abs(P[i]![1] - h) < 0.012 * H).map(off);
    if (xs.length < 3) continue;
    const width = Math.max(...xs) - Math.min(...xs);
    if (width < narrow - 1e-9) {
      narrow = width;
      neck = h;
    }
  }
  const zNear = (y: number, band: number, fallback: number) => mean(trunk.filter((i) => Math.abs(P[i]![1] - y) < band).map((i) => P[i]!))?.[2] ?? fallback;
  const rootY = crotch + 0.06 * H;
  const spineY = rootY + 0.22 * (neck - rootY);
  const zRoot = zNear(rootY, 0.04 * H, 0);

  // the legs
  const hipY = crotch + 0.03 * H;
  const ankleY = ground + 0.045 * H;
  const kneeY = ankleY + 0.5 * (hipY - ankleY);
  const legs = [0, 1].map((s) => {
    const pts = P.filter((_, i) => inLeg(i, s));
    const near = (y: number, lo: number, hi: number, fallback: Vec3): Vec3 => {
      const c = mean(pts.filter((p) => p[1] > y + lo && p[1] < y + hi)) ?? fallback;
      return [c[0], y, c[2]];
    };
    const hip = near(hipY, -0.1 * H, 0, mean(pts)!);
    return { hip, knee: near(kneeY, -0.03 * H, 0.03 * H, hip), ankle: near(ankleY, 0, 0.04 * H, hip) };
  });

  const J = (name: string, parent: string | null, at: Vec3): Joint => ({ name, parent, at });
  const joints: Joint[] = [
    J('root', null, [cx, rootY, zRoot]),
    J('spine', 'root', [cx, spineY, zNear(spineY, 0.04 * H, zRoot)]),
    J('head', 'spine', [cx, neck, zNear(neck, 0.02 * H, zRoot)]),
    ...['L', 'R'].flatMap((n, s) => [
      J(`shoulder${n}`, 'spine', arms[s]!.shoulder),
      J(`elbow${n}`, `shoulder${n}`, arms[s]!.elbow),
      J(`wrist${n}`, `elbow${n}`, arms[s]!.wrist),
      J(`hip${n}`, 'root', legs[s]!.hip),
      J(`knee${n}`, `hip${n}`, legs[s]!.knee),
      J(`ankle${n}`, `knee${n}`, legs[s]!.ankle),
    ]),
  ];
  const id = Object.fromEntries(joints.map((j, i) => [j.name, i])) as Record<string, number>;

  // weights: a point follows the bones of its limb, blended over a short band at every joint
  const band = 0.02 * H;
  const weigh = (i: number): Weights => {
    const p = P[i]!;
    const w = new Map<number, number>();
    const give = (name: string, share: number) => w.set(id[name]!, (w.get(id[name]!) ?? 0) + share);
    const asTrunk = (share: number) => {
      const head = smooth(neck - band * 0.6, neck + band * 0.6, p[1]);
      const spine = smooth(spineY - band, spineY + band, p[1]) * (1 - head);
      give('head', share * head);
      give('spine', share * spine);
      give('root', share * (1 - head - spine));
    };
    const s = off(i) >= 0 ? 0 : 1;
    const n = s === 0 ? 'L' : 'R';
    const a = arms[s]!;
    if (inLeg(i, s)) {
      const leg = smooth(crotch, crotch - 0.05 * H, p[1]);
      const ankle = smooth(ankleY + band * 0.6, ankleY - band * 0.6, p[1]);
      const knee = smooth(kneeY + band, kneeY - band, p[1]) * (1 - ankle);
      give(`ankle${n}`, leg * ankle);
      give(`knee${n}`, leg * knee);
      give(`hip${n}`, leg * (1 - ankle - knee));
      asTrunk(1 - leg);
    } else {
      // an arm point is wholly the arm's; above the armpit the shoulder fades into the trunk towards the middle
      const reach = Math.abs(off(i));
      const cap = p[1] >= a.pit && p[1] < a.pit + 2.2 * a.thick ? smooth(a.inner - 0.5 * a.thick, a.inner + 0.1 * a.thick, reach) : 0;
      const share = a.has.has(i) ? 1 : cap;
      if (share > 0) {
        const t = a.along(p);
        const wrist = smooth(WRIST - 0.045, WRIST + 0.045, t);
        const elbow = smooth(ELBOW - 0.045, ELBOW + 0.045, t) * (1 - wrist);
        give(`wrist${n}`, share * wrist);
        give(`elbow${n}`, share * elbow);
        give(`shoulder${n}`, share * (1 - wrist - elbow));
      }
      asTrunk(1 - share);
    }
    const kept = [...w].filter(([, x]) => x > 1e-3);
    const total = kept.reduce((sum, [, x]) => sum + x, 0);
    return kept.map(([j, x]) => [j, x / total]);
  };
  const bodyPoints = P.map((_, i) => i).filter(body);
  const bodyWeights = new Map(bodyPoints.map((i) => [i, weigh(i)]));
  const all = P.map((p, i) => {
    const own = bodyWeights.get(i);
    if (own) return own;
    // hair, a hat, a watch: a point outside the body goes with the body point nearest to it
    let best = bodyPoints[0]!;
    let d = Infinity;
    for (const k of bodyPoints) {
      const q = P[k]!;
      const dk = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
      if (dk < d) {
        d = dk;
        best = k;
      }
    }
    return bodyWeights.get(best)!;
  });
  return { joints, skin: meshes.map((mesh, m) => all.slice(start[m]!, start[m]! + mesh.positions.length)) };
};

// ---------- ready poses ----------
// Signs, for limbs that hang: hip x < 0 swings the leg forward, knee x > 0 bends it, elbow x < 0 bends it,
// head x > 0 nods, shoulderL z > 0 / shoulderR z < 0 lifts the arm sideways, y turns to the figure's left.

export const HUMANOID_POSES: Record<string, Pose> = {
  bind: {},
  tpose: { shoulderL: [0, 0, 1.35], shoulderR: [0, 0, -1.35] },
  wave: { head: [-0.05, 0.25, 0.08], spine: [0, 0.1, 0.03], shoulderL: [0, 0, 2.0], elbowL: [0, 0, 0.7], wristL: [0, 0, 0.2] },
  sit: {
    hipL: [-1.45, 0, 0.05], hipR: [-1.45, 0, -0.05], kneeL: [1.45, 0, 0], kneeR: [1.45, 0, 0],
    shoulderL: [-0.5, 0, 0], shoulderR: [-0.5, 0, 0], elbowL: [-0.7, 0, 0], elbowR: [-0.7, 0, 0],
  },
  phone: {
    head: [0.4, 0, 0], spine: [0.08, 0, 0], shoulderL: [-0.25, 0, 0], shoulderR: [-0.35, 0, 0],
    elbowL: [-1.4, -0.6, 0], elbowR: [-1.25, 0.55, 0],
  },
};

/** One frame of a walk on the spot (with `run`: a run); `t` goes from 0 to 1 round the loop. Use it with `ground: true`. */
export const walkPose = (t: number, { stride = 0.5, run = false }: { stride?: number; run?: boolean } = {}): Pose => {
  const a = t * Math.PI * 2;
  const leg = (phase: number) => {
    const hip = -stride * Math.sin(a + phase) - (run ? 0.2 : 0.05);
    const knee = (run ? 0.3 : 0.08) + (run ? 1.3 : 0.8) * Math.max(0, Math.cos(a + phase - 0.5));
    return { hip: [hip, 0, 0] as Vec3, knee: [knee, 0, 0] as Vec3, ankle: [-(hip + knee) * 0.75, 0, 0] as Vec3 };
  };
  const armOf = (phase: number) => ({
    shoulder: [stride * 0.9 * Math.sin(a + phase), 0, 0] as Vec3,
    elbow: [(run ? -1.3 : -0.2) - 0.25 * Math.max(0, -Math.sin(a + phase)), 0, 0] as Vec3,
  });
  const [L, R, AL, AR] = [leg(0), leg(Math.PI), armOf(0), armOf(Math.PI)];
  const sway = stride * Math.sin(a);
  return {
    root: [run ? 0.2 : 0.03, 0.1 * sway, 0],
    spine: [0, -0.3 * sway, 0],
    head: [run ? -0.15 : 0, 0.1 * sway, 0],
    hipL: L.hip, kneeL: L.knee, ankleL: L.ankle,
    hipR: R.hip, kneeR: R.knee, ankleR: R.ankle,
    shoulderL: AL.shoulder, elbowL: AL.elbow,
    shoulderR: AR.shoulder, elbowR: AR.elbow,
  };
};
