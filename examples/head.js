// A stylized head: middle-aged man, swept-back grey hair, full grey beard, round black glasses, orange jacket.
// Everything is a closed blob (ellipsoid or torus) of triangles, so it stays a valid solid and booleans work.
// The rounded look comes from smooth shading (N) and the soft skin material, not from the face count.
// `node examples/head.js` checks the parts and writes examples/head.scene.json + examples/out/head.svg.
// Face looks to +z, up is +y, one unit is about half of the head height.

import { writeFileSync } from 'node:fs';
import { validate, renderView, merge, orbit } from '../dist/index.js';

const MATERIALS = [
  { name: 'skin', color: '#e0a07c', metal: 0, rough: 0.75, alpha: 1, emit: 0, soft: 0.8 },
  { name: 'hair', color: '#a8a8a6', metal: 0, rough: 0.8, alpha: 1, emit: 0, soft: 0.25 },
  { name: 'hair-light', color: '#d2d2ce', metal: 0, rough: 0.8, alpha: 1, emit: 0, soft: 0.25 },
  { name: 'frame', color: '#18181a', metal: 0, rough: 0.3, alpha: 1, emit: 0, soft: 0 },
  { name: 'lens', color: '#cfe6ee', metal: 0.1, rough: 0.05, alpha: 0.18, emit: 0, soft: 0 },
  { name: 'eye-white', color: '#ece8e0', metal: 0, rough: 0.3, alpha: 1, emit: 0, soft: 0 },
  { name: 'iris', color: '#6f8a80', metal: 0, rough: 0.2, alpha: 1, emit: 0, soft: 0 },
  { name: 'pupil', color: '#101214', metal: 0, rough: 0.1, alpha: 1, emit: 0, soft: 0 },
  { name: 'lip', color: '#a8604f', metal: 0, rough: 0.5, alpha: 1, emit: 0, soft: 0.5 },
  { name: 'jacket', color: '#e2751f', metal: 0, rough: 0.85, alpha: 1, emit: 0, soft: 0 },
  { name: 'shirt', color: '#8d8f93', metal: 0, rough: 0.9, alpha: 1, emit: 0, soft: 0 },
];
const COLOR = Object.fromEntries(MATERIALS.map((m) => [m.name, m.color]));

const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];

const place = (pts, { at = [0, 0, 0], rx = 0, ry = 0, rz = 0 }) =>
  pts.map((p) => {
    const q = rotZ(rotY(rotX(p, rx), ry), rz);
    return [q[0] + at[0], q[1] + at[1], q[2] + at[2]];
  });

/** Closed triangle mesh from a ring grid with two poles (top ring list first). */
const solidOf = (rings, top, bottom, mat) => {
  const n = rings[0].length;
  const positions = [top, ...rings.flat(), bottom];
  const faces = [];
  const R = (i, j) => 1 + i * n + (((j % n) + n) % n);
  for (let j = 0; j < n; j++) faces.push({ v: [0, R(0, j + 1), R(0, j)] });
  for (let i = 0; i < rings.length - 1; i++)
    for (let j = 0; j < n; j++) {
      faces.push({ v: [R(i, j), R(i, j + 1), R(i + 1, j + 1)] });
      faces.push({ v: [R(i, j), R(i + 1, j + 1), R(i + 1, j)] });
    }
  const last = rings.length - 1;
  const b = positions.length - 1;
  for (let j = 0; j < n; j++) faces.push({ v: [R(last, j), R(last, j + 1), b] });
  return orient({ positions, faces: faces.map((f) => ({ ...f, mat, color: COLOR[mat] })) });
};

/** Flip all faces when the signed volume is negative (so the normals point out). */
const orient = (mesh) => {
  let vol = 0;
  for (const f of mesh.faces) {
    const [a, b, c] = f.v.map((i) => mesh.positions[i]);
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return vol < 0 ? { ...mesh, faces: mesh.faces.map((f) => ({ ...f, v: [...f.v].reverse() })) } : mesh;
};

/** Ellipsoid with radii r, turned and moved by `t`; `shape(x, y, z)` may bend the unit-sphere point first. */
const blob = (mat, r, t = {}, { seg = 14, rings = 8, shape } = {}) => {
  const ring = [];
  for (let i = 1; i < rings; i++) {
    const th = (Math.PI * i) / rings;
    const row = [];
    for (let j = 0; j < seg; j++) {
      const ph = (2 * Math.PI * j) / seg;
      let p = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      if (shape) p = shape(...p);
      row.push([p[0] * r[0], p[1] * r[1], p[2] * r[2]]);
    }
    ring.push(row);
  }
  const top = [0, r[1], 0];
  const bottom = [0, -r[1], 0];
  const placed = ring.map((row) => place(row, t));
  return solidOf(placed, place([top], t)[0], place([bottom], t)[0], mat);
};

/** Torus lying in the xy plane (axis z), as a ring of tube-sections. */
const torus = (mat, R, r, t = {}, { seg = 28, side = 8 } = {}) => {
  const positions = [];
  const faces = [];
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < side; j++) {
      const a = (2 * Math.PI * i) / seg;
      const b = (2 * Math.PI * j) / side;
      const rad = R + r * Math.cos(b);
      positions.push([rad * Math.cos(a), rad * Math.sin(a), r * Math.sin(b)]);
    }
  const I = (i, j) => (i % seg) * side + (j % side);
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < side; j++) {
      faces.push({ v: [I(i, j), I(i + 1, j), I(i + 1, j + 1)], mat, color: COLOR[mat] });
      faces.push({ v: [I(i, j), I(i + 1, j + 1), I(i, j + 1)], mat, color: COLOR[mat] });
    }
  return orient({ positions: place(positions, t), faces });
};

/** A thin rod between two points (a closed 6-sided prism with pointy-free ends). */
const rod = (mat, a, b, r) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  const ry = Math.atan2(d[0], d[2]);
  const rx = -Math.asin(d[1] / L);
  const ring = (z) => Array.from({ length: 6 }, (_, k) => [r * Math.cos((k * Math.PI) / 3), r * Math.sin((k * Math.PI) / 3), z]);
  const pts = place([...ring(0), ...ring(L)], { at: a, rx, ry });
  const faces = [];
  for (let k = 0; k < 6; k++) {
    const k2 = (k + 1) % 6;
    faces.push({ v: [k, k2, 6 + k2, 6 + k], mat, color: COLOR[mat] });
  }
  faces.push({ v: [0, 1, 2, 3, 4, 5].reverse(), mat, color: COLOR[mat] });
  faces.push({ v: [6, 7, 8, 9, 10, 11], mat, color: COLOR[mat] });
  return orient({ positions: pts, faces });
};

// A head and its jaw: the unit sphere narrows towards the chin and flattens at the back.
const skull = (x, y, z) => {
  const jaw = y < 0 ? 1 - 0.28 * Math.pow(-y, 1.4) : 1;
  const back = z < 0 ? 0.92 : 1;
  return [x * jaw, y, z * back * (y < -0.6 ? 0.9 : 1)];
};

export const head = () => {
  const both = (f) => [1, -1].flatMap((s) => f(s));
  const skin = [
    blob('skin', [0.78, 0.97, 0.85], {}, { seg: 28, rings: 16, shape: skull }),
    // nose: bridge + tip + wings
    blob('skin', [0.15, 0.3, 0.19], { at: [0, -0.1, 0.8], rx: -0.35 }, { seg: 12, rings: 8 }),
    blob('skin', [0.15, 0.12, 0.15], { at: [0, -0.3, 0.9] }, { seg: 12, rings: 7 }),
    ...both((s) => [blob('skin', [0.09, 0.09, 0.1], { at: [s * 0.12, -0.3, 0.84] }, { seg: 10, rings: 6 })]),
    // ears and cheek bones
    ...both((s) => [
      blob('skin', [0.1, 0.24, 0.15], { at: [s * 0.8, -0.02, -0.03], rz: s * 0.15 }, { seg: 12, rings: 8 }),
      blob('skin', [0.22, 0.14, 0.14], { at: [s * 0.46, -0.12, 0.7], rz: s * -0.3 }, { seg: 12, rings: 7 }),
    ]),
    // neck
    blob('skin', [0.42, 0.6, 0.42], { at: [0, -1.25, -0.05] }, { seg: 16, rings: 8 }),
  ];
  const eyes = both((s) => [
    blob('eye-white', [0.13, 0.1, 0.1], { at: [s * 0.3, 0.14, 0.7] }, { seg: 12, rings: 7 }),
    blob('iris', [0.075, 0.075, 0.03], { at: [s * 0.3, 0.14, 0.795] }, { seg: 12, rings: 6 }),
    blob('pupil', [0.035, 0.035, 0.02], { at: [s * 0.3, 0.14, 0.82] }, { seg: 8, rings: 5 }),
  ]);
  const lids = both((s) => [
    // heavy upper lid and frowning brow: the inner end sits lower
    blob('skin', [0.17, 0.04, 0.09], { at: [s * 0.3, 0.27, 0.72], rz: s * -0.1 }, { seg: 12, rings: 6 }),
    blob('hair', [0.3, 0.07, 0.12], { at: [s * 0.32, 0.43, 0.74], rz: s * -0.28, rx: -0.15 }, { seg: 14, rings: 7 }),
  ]);
  const hair = [
    blob('hair', [0.88, 0.7, 0.95], { at: [0, 0.48, -0.12] }, { seg: 24, rings: 12 }),
    // swept-back waves: lumps along the top, light and dark so they read as strands
    blob('hair-light', [0.66, 0.2, 0.34], { at: [0, 1.03, 0.4], rx: 0.5 }, { seg: 16, rings: 8 }),
    blob('hair', [0.56, 0.17, 0.3], { at: [0, 1.12, 0.1], rx: 0.2 }, { seg: 16, rings: 8 }),
    blob('hair-light', [0.5, 0.16, 0.3], { at: [0, 1.1, -0.3], rx: -0.2 }, { seg: 16, rings: 8 }),
    ...both((s) => [
      blob('hair-light', [0.22, 0.17, 0.4], { at: [s * 0.52, 0.98, 0.3], rx: 0.4, rz: s * -0.5 }, { seg: 12, rings: 7 }),
      blob('hair', [0.2, 0.16, 0.36], { at: [s * 0.32, 1.06, 0.16], rx: 0.3, rz: s * -0.3 }, { seg: 12, rings: 7 }),
      blob('hair-light', [0.2, 0.3, 0.4], { at: [s * 0.74, 0.55, -0.1], rz: s * 0.1 }, { seg: 12, rings: 7 }),
      blob('hair', [0.17, 0.28, 0.5], { at: [s * 0.78, 0.2, -0.28] }, { seg: 12, rings: 7 }),
    ]),
    blob('hair', [0.6, 0.55, 0.4], { at: [0, 0.12, -0.78] }, { seg: 16, rings: 8 }),
  ];
  const beard = [
    blob('hair', [0.7, 0.58, 0.62], { at: [0, -0.62, 0.22] }, { seg: 24, rings: 12, shape: skull }),
    blob('hair-light', [0.42, 0.28, 0.4], { at: [0, -0.98, 0.5], rx: 0.2 }, { seg: 16, rings: 8 }),
    ...both((s) => [
      blob('hair', [0.26, 0.42, 0.32], { at: [s * 0.55, -0.22, 0.42], rz: s * 0.3 }, { seg: 12, rings: 8 }),
      blob('hair', [0.16, 0.22, 0.2], { at: [s * 0.4, -0.6, 0.66], rz: s * 0.4 }, { seg: 12, rings: 7 }),
      // moustache: sweeps out and down
      blob('hair-light', [0.2, 0.07, 0.1], { at: [s * 0.14, -0.4, 0.89], rz: s * 0.28 }, { seg: 14, rings: 7 }),
    ]),
  ];
  const mouth = [blob('lip', [0.13, 0.035, 0.05], { at: [0, -0.55, 0.88] }, { seg: 12, rings: 6 })];
  const glasses = [
    ...both((s) => [
      torus('frame', 0.26, 0.032, { at: [s * 0.3, 0.14, 0.93] }),
      rod('frame', [s * 0.55, 0.16, 0.91], [s * 0.8, 0.12, 0.2], 0.022),
      rod('frame', [s * 0.8, 0.12, 0.2], [s * 0.82, -0.02, 0.0], 0.022),
    ]),
    rod('frame', [-0.06, 0.2, 0.95], [0.06, 0.2, 0.95], 0.024),
  ];
  const lens = both((s) => [blob('lens', [0.25, 0.25, 0.012], { at: [s * 0.3, 0.14, 0.93], rx: Math.PI / 2 }, { seg: 24, rings: 3 })]);
  const clothes = [
    blob('shirt', [0.5, 0.42, 0.4], { at: [0, -1.78, 0.28] }, { seg: 16, rings: 8 }),
    blob('jacket', [1.25, 0.7, 0.8], { at: [0, -2.15, -0.1] }, { seg: 24, rings: 10 }),
    blob('jacket', [0.62, 0.3, 0.55], { at: [0, -1.64, -0.1] }, { seg: 16, rings: 8 }),
    ...both((s) => [blob('jacket', [0.28, 0.5, 0.17], { at: [s * 0.42, -1.72, 0.5], rz: s * 0.45, rx: -0.2 }, { seg: 12, rings: 8 })]),
  ];
  return {
    palette: MATERIALS,
    objects: [
      { name: 'head', mesh: merge(...skin, ...lids.filter((_, i) => i % 2 === 0), mouth[0]) },
      { name: 'eyes', mesh: merge(...eyes) },
      { name: 'hair', mesh: merge(...hair, ...lids.filter((_, i) => i % 2 === 1)) },
      { name: 'beard', mesh: merge(...beard) },
      { name: 'glasses', mesh: merge(...glasses) },
      { name: 'lenses', mesh: merge(...lens) },
      { name: 'clothes', mesh: merge(...clothes) },
    ],
  };
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { palette, objects } = head();
  let tri = 0;
  for (const o of objects) {
    const v = validate(o.mesh);
    tri += o.mesh.faces.length;
    console.log(o.name.padEnd(8), o.mesh.positions.length, 'vertices', o.mesh.faces.length, 'faces', v.ok ? 'ok' : v.notes.slice(0, 3));
  }
  console.log('total faces', tri);
  writeFileSync(new URL('./head.scene.json', import.meta.url), JSON.stringify({ format: '3draft-scene', version: 1, palette, objects }));
  const all = merge(...objects.map((o) => o.mesh));
  writeFileSync(new URL('./out/head.svg', import.meta.url), renderView(all, orbit({ yaw: 0.25, pitch: 0.05 }), { size: 900, points: false, palette: Object.fromEntries(palette.map(({ name, ...m }) => [name, m])) }));
}
