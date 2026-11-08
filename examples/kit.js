// A small modelling kit for assembled models: a PROTOTYPE is a function (params) -> mesh in local space, with material
// SLOTS ('skin', 'glass', ...) instead of palette names. place() puts a copy of a prototype into a model with its own
// position / rotation / scale and its own slot -> material map, so one hull section, one landing leg or one star class
// is written once and used many times; only the numbers and the materials change.
//   const m = model(palette); m.add('hull', hullSection({ len: 8 }), { at: [0, 0, 3], mats: { skin: 'hullWhite' } });
//   m.scene()  ->  { palette, objects }   (one object per group name)
// Meshes are { positions: [[x,y,z]], faces: [{ v: [i..], mat, color? }] }. y is up, the nose of a ship points to -z.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const TAU = Math.PI * 2;

export const mesh = () => ({ positions: [], faces: [] });

/** Adds a face (points in order); `from` is a point the face must look away from (or toward, with inward = true). */
export const face = (m, pts, mat, from, inward = false) => {
  let n = [0, 0, 0];
  for (let i = 1; i < pts.length - 1; i++) {
    const c = cross(sub(pts[i], pts[0]), sub(pts[i + 1], pts[0]));
    n = [n[0] + c[0], n[1] + c[1], n[2] + c[2]];
  }
  const c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
  const away = dot(n, sub(c, from)) >= 0;
  const ordered = away !== inward ? pts : [...pts].reverse();
  const v = ordered.map((p) => m.positions.push(p) - 1);
  m.faces.push({ v, mat });
  return m;
};

export const merge = (a, b) => {
  const base = a.positions.length;
  a.positions.push(...b.positions);
  for (const f of b.faces) a.faces.push({ ...f, v: f.v.map((i) => i + base) });
  return a;
};

// ---------- primitives (all convex solids, centred on the origin unless said otherwise) ----------

/** Axis aligned box w (x) h (y) d (z). Slots: top, bottom, side (or one slot for everything). */
export const box = (w, h, d, mat = 'skin', { top = mat, bottom = mat } = {}) => {
  const m = mesh();
  const [x, y, z] = [w / 2, h / 2, d / 2];
  const o = [0, 0, 0];
  const q = (pts, s) => face(m, pts, s, o);
  q([[x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z]], mat);
  q([[-x, -y, -z], [-x, y, -z], [-x, y, z], [-x, -y, z]], mat);
  q([[-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z]], top);
  q([[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]], bottom);
  q([[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], mat);
  q([[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z]], mat);
  return m;
};

/** A convex polygon [[x, y]] extruded along z from z0 to z1. Slots: side, front (z0), back (z1) or `mat` for all. */
export const prism = (poly, z0, z1, mat = 'skin', { front = mat, back = mat } = {}) => {
  const m = mesh();
  const n = poly.length;
  const c = [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  const mid = [c[0], c[1], (z0 + z1) / 2];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    face(m, [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], mat, mid);
  }
  face(m, poly.map(([x, y]) => [x, y, z0]), front, mid);
  face(m, poly.map(([x, y]) => [x, y, z1]), back, mid);
  return m;
};

/** A cone frustum around the z axis from z0 (radius r0) to z1 (radius r1). Slots: side, front, back. */
export const cylinder = (r0, r1, z0, z1, seg = 16, mat = 'skin', { front = mat, back = mat } = {}) => {
  const ring = (r, z) => Array.from({ length: seg }, (_, i) => [r * Math.cos((i / seg) * TAU), r * Math.sin((i / seg) * TAU), z]);
  const A = ring(r0, z0), B = ring(r1, z1);
  const m = mesh();
  const mid = [0, 0, (z0 + z1) / 2];
  for (let i = 0; i < seg; i++) face(m, [A[i], A[(i + 1) % seg], B[(i + 1) % seg], B[i]], mat, mid);
  if (r0 > 0) face(m, A, front, mid);
  if (r1 > 0) face(m, B, back, mid);
  return m;
};

/** A tank along z: a cylinder of radius r with domed ends, from z0 to z1 (the domes lie inside that range). */
export const capsule = (r, z0, z1, seg = 16, caps = 3, mat = 'skin') => {
  const rows = [];
  for (let i = 0; i <= caps; i++) rows.push([r * Math.sin((i / caps) * (Math.PI / 2)), z0 + r - r * Math.cos((i / caps) * (Math.PI / 2))]);
  for (let i = 0; i <= caps; i++) rows.push([r * Math.cos((i / caps) * (Math.PI / 2)), z1 - r + r * Math.sin((i / caps) * (Math.PI / 2))]);
  const m = mesh();
  const mid = [0, 0, (z0 + z1) / 2];
  const at = (rr, z, i) => [rr * Math.cos((i / seg) * TAU), rr * Math.sin((i / seg) * TAU), z];
  for (let k = 0; k < rows.length - 1; k++) {
    const [r0, za] = rows[k], [r1, zb] = rows[k + 1];
    for (let i = 0; i < seg; i++) {
      const pts = [];
      if (r0 > 1e-9) pts.push(at(r0, za, i), at(r0, za, i + 1));
      else pts.push(at(0, za, 0));
      if (r1 > 1e-9) pts.push(at(r1, zb, i + 1), at(r1, zb, i));
      else pts.push(at(0, zb, 0));
      if (pts.length >= 3) face(m, pts, mat, mid);
    }
  }
  return m;
};

/** A convex polygon cut by a line x = value (axis 0) or y = value (axis 1); keeps the side above (or below) the value. */
export const clip = (poly, axis, value, keepAbove = true) => {
  const inside = (p) => (keepAbove ? p[axis] >= value - 1e-9 : p[axis] <= value + 1e-9);
  const out = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  });
  return out;
};

/** A hollow ring of a profile: outer skin, inner skin, both along z. */
export const inset = (poly, t) => {
  // moves every edge of a convex polygon (counter clockwise) inwards by t
  const n = poly.length;
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l; // left normal = inwards for ccw
    return [a[0] + nx * t, a[1] + ny * t, dx, dy];
  });
  return poly.map((_, i) => {
    const p = lines[(i + n - 1) % n], q = lines[i];
    const det = p[2] * q[3] - p[3] * q[2];
    const s = ((q[0] - p[0]) * q[3] - (q[1] - p[1]) * q[2]) / det;
    return [p[0] + p[2] * s, p[1] + p[3] * s];
  });
};

/** An octagon w x h with corners cut by c, bottom edge at y0, counter clockwise: edge 0 bottom, 2 right, 4 top, 6 left. */
export const octagon = (w, h, c, y0 = 0) => [
  [-w / 2 + c, y0], [w / 2 - c, y0], [w / 2, y0 + c], [w / 2, y0 + h - c],
  [w / 2 - c, y0 + h], [-w / 2 + c, y0 + h], [-w / 2, y0 + h - c], [-w / 2, y0 + c],
];

/**
 * A pressure hull section: the polygon swept along z from z0 to z1 as an outer skin and an inner lining (wall thickness
 * t), open at both ends. `end` is an optional polygon at z0 (a tapered nose): the outer and inner skins taper to it.
 * Edge slots: skinSlots[i] names the outer slot of edge i (default 'skin'); glass edges have no lining.
 * Slots: skin / others by skinSlots, floor (inner bottom), wall (inner sides), ceil (inner top), rim.
 */
export const hullSection = ({ poly, z0, z1, t = 0.25, end, skinSlots = [], rim = true, lining = (i) => (i === 0 ? 'floor' : i === 4 ? 'ceil' : 'wall') }) => {
  const m = mesh();
  const n = poly.length;
  const A = poly, B = end ?? poly;
  const Ai = inset(A, t), Bi = inset(B, t);
  const zi0 = z0 + (end ? t * 0.5 : 0);
  const cen = (P) => [P.reduce((s, p) => s + p[0], 0) / n, P.reduce((s, p) => s + p[1], 0) / n];
  const axis = (z) => [...cen(A), z];
  const slotIn = lining;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const o = [[B[i][0], B[i][1], z0], [B[j][0], B[j][1], z0], [A[j][0], A[j][1], z1], [A[i][0], A[i][1], z1]];
    const slot = skinSlots[i] ?? 'skin';
    face(m, o, slot, axis((z0 + z1) / 2));
    if (slot === 'glass') continue;
    const q = [[Bi[i][0], Bi[i][1], zi0], [Bi[j][0], Bi[j][1], zi0], [Ai[j][0], Ai[j][1], z1], [Ai[i][0], Ai[i][1], z1]];
    face(m, q, slotIn(i), axis((z0 + z1) / 2), true);
    if (rim) face(m, [o[3], o[2], q[2], q[3]], 'rim', axis((z0 + z1) / 2));
  }
  return m;
};

// ---------- placing ----------

const rotate = (p, [rx, ry, rz]) => {
  let [x, y, z] = p;
  if (rz) [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  if (rx) [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  if (ry) [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  return [x, y, z];
};

/** A copy of `proto` scaled, rotated (radians x, y, z) and moved; `mats` maps slot -> palette name. */
export const place = (proto, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], mats = {} } = {}) => {
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  const mirrored = s[0] * s[1] * s[2] < 0;
  return {
    positions: proto.positions.map((p) => {
      const r = rotate([p[0] * s[0], p[1] * s[1], p[2] * s[2]], rot);
      return [r[0] + at[0], r[1] + at[1], r[2] + at[2]];
    }),
    faces: proto.faces.map((f) => ({ ...f, v: mirrored ? [...f.v].reverse() : f.v, mat: mats[f.mat] ?? mats['*'] ?? f.mat })),
  };
};

/** A strut between two points in the XY plane (a box of thickness t, depth d). */
export const strut = (a, b, t, d, mat = 'metal') => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return place(box(len, t, d, mat), { rot: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])], at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0] });
};

// ---------- a model: instances collected into named groups ----------

const jitter = (a, b, c) => {
  let h = (Math.floor(a) * 73856093) ^ (Math.floor(b) * 19349663) ^ (Math.floor(c) * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const shade = (c, k) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');

export const model = (palette, { panels = [], panelCell = 1.2, rust, rustAmount = 0 } = {}) => {
  const groups = new Map();
  const pal = new Map(palette.map((p) => [p.name, p]));
  let instances = 0;
  const api = {
    /** Adds a copy of a prototype to a group. */
    add(group, proto, opts) {
      const m = place(proto, opts);
      const g = groups.get(group) ?? groups.set(group, { positions: [], index: new Map(), faces: [] }).get(group);
      const ids = m.positions.map((p) => {
        const key = p.map((v) => Math.round(v * 1000)).join();
        if (!g.index.has(key)) g.index.set(key, g.positions.push(p.map((v) => Math.round(v * 1000) / 1000)) - 1);
        return g.index.get(key);
      });
      for (const f of m.faces) {
        const v = [...new Set(f.v.map((i) => ids[i]))];
        if (v.length >= 3) g.faces.push({ v, mat: f.mat });
      }
      instances++;
      return api;
    },
    get instances() {
      return instances;
    },
    scene() {
      const objects = [];
      for (const [name, g] of groups) {
        for (const f of g.faces) {
          if (!panels.includes(f.mat)) continue;
          const c = [0, 1, 2].map((j) => f.v.reduce((s, k) => s + g.positions[k][j], 0) / f.v.length);
          const k = 0.84 + jitter(c[0] / panelCell, c[1] / panelCell, c[2] / panelCell) * 0.24;
          const base = rust && jitter(c[0] / 2.4 + 9, c[1] / 2.4, c[2] / 2.4) > 1 - rustAmount ? pal.get(rust).color : pal.get(f.mat).color;
          f.color = shade(base, k);
        }
        objects.push({ name, mesh: { positions: g.positions, faces: g.faces } });
      }
      const used = new Set(objects.flatMap((o) => o.mesh.faces.map((f) => f.mat)));
      return { palette: palette.filter((p) => used.has(p.name) || p.name === rust), objects };
    },
  };
  return api;
};
