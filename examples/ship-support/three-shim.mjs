// A tiny stand-in for the parts of three.js that the redneck-wreck ship (github.com/Pengeszikra/redneck-wreck, src/ship)
// uses, so that its procedural code can run in Node and hand over plain triangles: no rendering, no textures, no lights.
// Geometry classes build `{ positions, faces: [{ v, g }] }` (g = index into a material array, as three's groups).

const TAU = Math.PI * 2;

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v) {
    return this.set(v.x, v.y, v.z);
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
  add(v) {
    return this.set(this.x + v.x, this.y + v.y, this.z + v.z);
  }
  sub(v) {
    return this.set(this.x - v.x, this.y - v.y, this.z - v.z);
  }
  multiplyScalar(s) {
    return this.set(this.x * s, this.y * s, this.z * s);
  }
  length() {
    return Math.hypot(this.x, this.y, this.z);
  }
  normalize() {
    return this.multiplyScalar(1 / (this.length() || 1));
  }
  applyMatrix4(m) {
    const e = m.e;
    const { x, y, z } = this;
    return this.set(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
  }
}

export class Color {
  constructor(c = 0xffffff) {
    this.c = c;
  }
  copy(o) {
    this.c = o.c;
    return this;
  }
  set(c) {
    this.c = c;
    return this;
  }
}

class Quaternion {
  constructor(owner) {
    this.owner = owner;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 1;
  }
  setFromUnitVectors(a, b) {
    // the shortest rotation taking a to b (both unit vectors)
    let r = a.x * b.x + a.y * b.y + a.z * b.z + 1;
    let q;
    if (r < 1e-9) q = Math.abs(a.x) > Math.abs(a.z) ? [-a.y, a.x, 0, 0] : [0, -a.z, a.y, 0];
    else q = [a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x, r];
    const n = Math.hypot(...q) || 1;
    [this.x, this.y, this.z, this.w] = q.map((v) => v / n);
    if (this.owner) this.owner.quatDriven = true;
    return this;
  }
}

class Euler {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

// 4x4 matrices, column major like three
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const rotQ = ({ x, y, z, w }) => [
  1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
  2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
  2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
  0, 0, 0, 1,
];
const rotEuler = ({ x, y, z }) => {
  // order XYZ: R = Rx * Ry * Rz
  const rx = [1, 0, 0, 0, 0, Math.cos(x), Math.sin(x), 0, 0, -Math.sin(x), Math.cos(x), 0, 0, 0, 0, 1];
  const ry = [Math.cos(y), 0, -Math.sin(y), 0, 0, 1, 0, 0, Math.sin(y), 0, Math.cos(y), 0, 0, 0, 0, 1];
  const rz = [Math.cos(z), Math.sin(z), 0, 0, -Math.sin(z), Math.cos(z), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return mul(mul(rx, ry), rz);
};

export class Object3D {
  constructor() {
    this.name = '';
    this.position = new Vector3();
    this.rotation = new Euler();
    this.quaternion = new Quaternion(this);
    this.scale = new Vector3(1, 1, 1);
    this.children = [];
    this.parent = null;
    this.userData = {};
    this.visible = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.quatDriven = false;
    this.matrixWorld = { e: mul([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) };
  }
  add(o) {
    o.parent = this;
    this.children.push(o);
    return this;
  }
  traverse(fn) {
    fn(this);
    for (const c of this.children) c.traverse(fn);
  }
  updateMatrixWorld() {
    const r = this.quatDriven ? rotQ(this.quaternion) : rotEuler(this.rotation);
    const s = this.scale;
    const local = [r[0] * s.x, r[1] * s.x, r[2] * s.x, 0, r[4] * s.y, r[5] * s.y, r[6] * s.y, 0, r[8] * s.z, r[9] * s.z, r[10] * s.z, 0, this.position.x, this.position.y, this.position.z, 1];
    this.matrixWorld.e = this.parent ? mul(this.parent.matrixWorld.e, local) : local;
    for (const c of this.children) c.updateMatrixWorld();
  }
  getWorldPosition(v) {
    let top = this;
    while (top.parent) top = top.parent;
    top.updateMatrixWorld();
    const e = this.matrixWorld.e;
    return v.set(e[12], e[13], e[14]);
  }
}

export class Group extends Object3D {}
export class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}
export class PointLight extends Object3D {
  constructor() {
    super();
    this.color = new Color();
  }
}
export class SpotLight extends PointLight {
  constructor() {
    super();
    this.target = new Object3D();
  }
}
export class CanvasTexture {}
export class Box3 {
  constructor(min, max) {
    this.min = min;
    this.max = max;
  }
}
export const DoubleSide = 2;
export const AdditiveBlending = 2;
export const SRGBColorSpace = 'srgb';

export class Material {
  constructor(params = {}) {
    this.params = params;
    this.userData = {};
    this.emissiveIntensity = params.emissiveIntensity ?? 1;
    this.name = params.name ?? '';
    this.emissive = new Color(params.emissive ?? 0);
    this.color = new Color(params.color ?? 0xffffff);
  }
  clone() {
    const m = new this.constructor(this.params);
    m.name = this.name;
    m.userData = { ...this.userData };
    return m;
  }
}
export class MeshStandardMaterial extends Material {}
export class MeshPhysicalMaterial extends Material {}
export class MeshBasicMaterial extends Material {}

// --- geometry ---
export class BufferGeometry {
  constructor(positions = [], faces = []) {
    this.positions = positions;
    this.faces = faces;
    this.attributes = {};
  }
  rotateX(a) {
    const c = Math.cos(a), s = Math.sin(a);
    this.positions = this.positions.map(([x, y, z]) => [x, y * c - z * s, y * s + z * c]);
    return this;
  }
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const faceNormal = (P, v) => {
  let n = [0, 0, 0];
  for (let i = 1; i < v.length - 1; i++) {
    const c = cross(sub(P[v[i]], P[v[0]]), sub(P[v[i + 1]], P[v[0]]));
    n = [n[0] + c[0], n[1] + c[1], n[2] + c[2]];
  }
  return n;
};
const centroid = (P, v) => {
  const c = [0, 0, 0];
  for (const i of v) for (let k = 0; k < 3; k++) c[k] += P[i][k] / v.length;
  return c;
};
// each face turned so that it looks away from `from(centroid)`, a point inside (or on the axis of) the solid
const outward = (g, from) => {
  g.faces = g.faces.map((f) => {
    const c = centroid(g.positions, f.v);
    return dot(faceNormal(g.positions, f.v), sub(c, from(c))) < 0 ? { ...f, v: [...f.v].reverse() } : f;
  });
  return g;
};
const center = () => [0, 0, 0];

export class BoxGeometry extends BufferGeometry {
  constructor(w = 1, h = 1, d = 1) {
    const [x, y, z] = [w / 2, h / 2, d / 2];
    const P = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) P.push([sx * x, sy * y, sz * z]);
    const idx = (sx, sy, sz) => (sx > 0 ? 4 : 0) + (sy > 0 ? 2 : 0) + (sz > 0 ? 1 : 0);
    // groups in three's order: +x, -x, +y, -y, +z, -z
    const faces = [
      [idx(1, -1, 1), idx(1, -1, -1), idx(1, 1, -1), idx(1, 1, 1)],
      [idx(-1, -1, -1), idx(-1, -1, 1), idx(-1, 1, 1), idx(-1, 1, -1)],
      [idx(-1, 1, 1), idx(1, 1, 1), idx(1, 1, -1), idx(-1, 1, -1)],
      [idx(-1, -1, -1), idx(1, -1, -1), idx(1, -1, 1), idx(-1, -1, 1)],
      [idx(-1, -1, 1), idx(1, -1, 1), idx(1, 1, 1), idx(-1, 1, 1)],
      [idx(1, -1, -1), idx(-1, -1, -1), idx(-1, 1, -1), idx(1, 1, -1)],
    ].map((v, g) => ({ v, g }));
    super(P, faces);
    outward(this, center);
  }
}

export class CylinderGeometry extends BufferGeometry {
  constructor(rTop = 1, rBottom = 1, height = 1, seg = 8) {
    const P = [];
    const ring = (r, y) => {
      for (let i = 0; i < seg; i++) P.push([r * Math.sin((i / seg) * TAU), y, r * Math.cos((i / seg) * TAU)]);
    };
    ring(rTop, height / 2);
    ring(rBottom, -height / 2);
    const faces = [];
    for (let i = 0; i < seg; i++) faces.push({ v: [i, seg + i, seg + ((i + 1) % seg), (i + 1) % seg], g: 0 });
    faces.push({ v: [...Array(seg).keys()], g: 1 });
    faces.push({ v: [...Array(seg).keys()].map((i) => seg + i).reverse(), g: 2 });
    super(P, faces);
    outward(this, (c) => [0, Math.max(-height / 2, Math.min(height / 2, c[1])), 0]);
  }
}

// three's sphere: phi round the Y axis, theta from the top pole
export class SphereGeometry extends BufferGeometry {
  constructor(radius = 1, wSeg = 8, hSeg = 6, phiStart = 0, phiLength = TAU, thetaStart = 0, thetaLength = Math.PI) {
    const P = [];
    const grid = [];
    for (let iy = 0; iy <= hSeg; iy++) {
      const row = [];
      for (let ix = 0; ix <= wSeg; ix++) {
        const u = ix / wSeg, v = iy / hSeg;
        const phi = phiStart + u * phiLength, th = thetaStart + v * thetaLength;
        row.push(P.length);
        P.push([-radius * Math.cos(phi) * Math.sin(th), radius * Math.cos(th), radius * Math.sin(phi) * Math.sin(th)]);
      }
      grid.push(row);
    }
    const faces = [];
    const full = phiLength >= TAU - 1e-9;
    for (let iy = 0; iy < hSeg; iy++)
      for (let ix = 0; ix < wSeg; ix++) {
        const a = grid[iy][ix + 1], b = grid[iy][ix], c = grid[iy + 1][ix], d = grid[iy + 1][ix + 1];
        const topPole = thetaStart === 0 && iy === 0, bottomPole = thetaStart + thetaLength >= Math.PI - 1e-9 && iy === hSeg - 1;
        if (topPole) faces.push({ v: [b, c, d], g: 0 });
        else if (bottomPole) faces.push({ v: [a, b, c], g: 0 });
        else faces.push({ v: [a, b, c, d], g: 0 });
      }
    void full;
    super(P, faces);
    outward(this, center);
  }
}

// a lathe: profile = [[r, y], ...] from the bottom pole to the top, `seg` steps round the Y axis
const lathe = (profile, seg) => {
  const P = [];
  const rows = profile.map(([r, y]) => {
    const row = [];
    for (let i = 0; i < seg; i++) row.push(P.push([r * Math.sin((i / seg) * TAU), y, r * Math.cos((i / seg) * TAU)]) - 1);
    return row;
  });
  const faces = [];
  for (let k = 0; k < rows.length - 1; k++)
    for (let i = 0; i < seg; i++) {
      const a = rows[k][i], b = rows[k][(i + 1) % seg], c = rows[k + 1][(i + 1) % seg], d = rows[k + 1][i];
      const quad = [a, b, c, d].filter((v, j, all) => P[v][0] > 1e-9 || P[v][2] > 1e-9 || all.indexOf(v) === j); // drop nothing: poles are rings of equal points
      faces.push({ v: quad, g: 0 });
    }
  return { P, faces };
};

export class CapsuleGeometry extends BufferGeometry {
  constructor(radius = 1, length = 1, capSeg = 4, radialSeg = 8) {
    const profile = [];
    const half = length / 2;
    for (let i = 0; i <= capSeg; i++) {
      const a = (i / capSeg) * (Math.PI / 2);
      profile.push([radius * Math.sin(a), -half - radius * Math.cos(a)]);
    }
    for (let i = 0; i <= capSeg; i++) {
      const a = (i / capSeg) * (Math.PI / 2);
      profile.push([radius * Math.cos(a), half + radius * Math.sin(a)]);
    }
    const { P, faces } = lathe(profile, radialSeg);
    // the poles are a ring of coincident points: collapse every face to its distinct vertices
    const key = (p) => p.map((v) => v.toFixed(6)).join();
    const first = new Map();
    const map = P.map((p, i) => first.get(key(p)) ?? (first.set(key(p), i), i));
    const fs = faces
      .map((f) => ({ ...f, v: f.v.map((i) => map[i]).filter((v, j, all) => all.indexOf(v) === j) }))
      .filter((f) => f.v.length >= 3);
    super(P, fs);
    outward(this, (c) => [0, Math.max(-half, Math.min(half, c[1])), 0]);
  }
}

export class TorusGeometry extends BufferGeometry {
  constructor(radius = 1, tube = 0.4, radialSeg = 8, tubularSeg = 6) {
    const P = [];
    const at = (j, i) => P.length;
    void at;
    const grid = [];
    for (let j = 0; j < tubularSeg; j++) {
      const row = [];
      for (let i = 0; i < radialSeg; i++) {
        const u = (j / tubularSeg) * TAU, v = (i / radialSeg) * TAU;
        row.push(P.push([(radius + tube * Math.cos(v)) * Math.cos(u), (radius + tube * Math.cos(v)) * Math.sin(u), tube * Math.sin(v)]) - 1);
      }
      grid.push(row);
    }
    const faces = [];
    for (let j = 0; j < tubularSeg; j++)
      for (let i = 0; i < radialSeg; i++) faces.push({ v: [grid[j][i], grid[(j + 1) % tubularSeg][i], grid[(j + 1) % tubularSeg][(i + 1) % radialSeg], grid[j][(i + 1) % radialSeg]], g: 0 });
    super(P, faces);
    outward(this, (c) => {
      const l = Math.hypot(c[0], c[1]) || 1;
      return [(c[0] / l) * radius, (c[1] / l) * radius, 0];
    });
  }
}

export class PlaneGeometry extends BufferGeometry {
  constructor(w = 1, h = 1) {
    super([[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]], [{ v: [0, 1, 2, 3], g: 0 }]);
  }
}

export class CircleGeometry extends BufferGeometry {
  constructor(radius = 1, seg = 8) {
    const P = [];
    for (let i = 0; i < seg; i++) P.push([radius * Math.cos((i / seg) * TAU), radius * Math.sin((i / seg) * TAU), 0]);
    super(P, [{ v: [...Array(seg).keys()], g: 0 }]);
  }
}

export class Shape {
  constructor(points = []) {
    this.points = points;
  }
}

// ear clipping of a simple polygon in the XY plane (counter clockwise or clockwise)
const triangulate = (pts) => {
  const area = pts.reduce((s, p, i) => s + (p.x * pts[(i + 1) % pts.length].y - pts[(i + 1) % pts.length].x * p.y), 0);
  const idx = pts.map((_, i) => i);
  if (area < 0) idx.reverse();
  const tris = [];
  const cr = (a, b, c) => (pts[b].x - pts[a].x) * (pts[c].y - pts[a].y) - (pts[b].y - pts[a].y) * (pts[c].x - pts[a].x);
  const inside = (p, a, b, c) => cr(a, b, p) >= 0 && cr(b, c, p) >= 0 && cr(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 1000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k + idx.length - 1) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
      if (cr(a, b, c) <= 1e-12) continue;
      if (idx.some((p) => p !== a && p !== b && p !== c && inside(p, a, b, c))) continue;
      tris.push([a, b, c]);
      idx.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) tris.push([...idx]);
  return tris;
};

export class ExtrudeGeometry extends BufferGeometry {
  constructor(shape, { depth = 1 } = {}) {
    const pts = shape.points;
    const n = pts.length;
    const P = [...pts.map((p) => [p.x, p.y, 0]), ...pts.map((p) => [p.x, p.y, depth])];
    const faces = triangulate(pts).flatMap((t) => [{ v: [t[0], t[1], t[2]], g: 0 }, { v: [n + t[0], n + t[1], n + t[2]], g: 1 }]);
    for (let i = 0; i < n; i++) faces.push({ v: [i, (i + 1) % n, n + ((i + 1) % n), n + i], g: 2 });
    super(P, faces);
    // a closed solid: flip every face by the sign of the whole volume
    let vol = 0;
    for (const f of this.faces) for (let i = 1; i < f.v.length - 1; i++) vol += dot(P[f.v[0]], cross(P[f.v[i]], P[f.v[i + 1]]));
    if (vol < 0) this.faces = this.faces.map((f) => ({ ...f, v: [...f.v].reverse() }));
  }
}
