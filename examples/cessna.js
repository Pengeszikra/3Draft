// A small Cessna as ONE mesh with differently coloured faces (one flat material, colour per face).
// Every part is a closed solid lofted between rings of points; the parts are merged into a single
// mesh. `node examples/cessna.js` checks the result and writes examples/cessna.scene.json (one
// object) plus examples/out/cessna.svg. Nose points to +x, the wings span z, up is +y, the wheels
// touch y = 0.

import { writeFileSync } from 'node:fs';
import { validate, renderView, merge, orbit } from '../dist/index.js';
import { sub, cross, dot, len } from '../dist/vec.js';

const C = {
  white: '#f1f1ec',
  belly: '#d9d9d2',
  blue: '#1f4e9c',
  red: '#c0392b',
  glass: '#26323d',
  tire: '#2a2a2c',
  hub: '#9aa0a6',
  metal: '#7d848c',
  prop: '#3b3b3f',
};

/** A closed solid through rings of equal point count; color(i, j) paints the quad between ring i and i+1, edge j. */
const loft = (rings, { color = () => C.white, caps = [C.white, C.white] } = {}) => {
  const n = rings[0].length;
  const positions = rings.flat();
  const faces = [];
  const planar = (q) => {
    const p = q.map((k) => positions[k]);
    const nn = cross(sub(p[1], p[0]), sub(p[2], p[0]));
    const l = len(nn);
    return l < 1e-12 || Math.abs(dot(sub(p[3], p[0]), nn)) / l < 1e-6;
  };
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const q = [i * n + j, i * n + k, (i + 1) * n + k, (i + 1) * n + j];
      const c = color(i, j);
      if (planar(q)) faces.push({ v: q, color: c });
      else {
        faces.push({ v: [q[0], q[1], q[2]], color: c });
        faces.push({ v: [q[0], q[2], q[3]], color: c });
      }
    }
  }
  const last = (rings.length - 1) * n;
  faces.push({ v: Array.from({ length: n }, (_, j) => n - 1 - j), color: caps[0] });
  faces.push({ v: Array.from({ length: n }, (_, j) => last + j), color: caps[1] });
  let mesh = { positions, faces };
  if (validate(mesh).inside_out) mesh = { positions, faces: faces.map((f) => ({ ...f, v: [...f.v].reverse() })) };
  return mesh;
};

const circle = (n, r, at) => (a) => {
  const t = (2 * Math.PI * a) / n;
  return at(r * Math.cos(t), r * Math.sin(t));
};

/** A slanted square-section strut from a to b. */
const strut = (a, b, r, color) =>
  loft(
    [a, b].map(([x, y, z]) => [[x - r, y, z - r / 2], [x + r, y, z - r / 2], [x + r, y, z + r / 2], [x - r, y, z + r / 2]]),
    { color: () => color, caps: [color, color] },
  );

/** A wheel with its axis along z. */
const wheel = (x, y, z, r, w) => {
  const ring = (zz, rr) => Array.from({ length: 12 }, (_, a) => circle(12, rr, (c, s) => [x + c, y + s, zz])(a));
  return loft([ring(z - w, r), ring(z + w, r)], { color: () => C.tire, caps: [C.hub, C.hub] });
};

export const cessna = () => {
  const parts = [];

  // fuselage: octagon rings (x, half width, bottom, top)
  const R = [
    [-4.1, 0.03, 1.0, 1.1],
    [-3.0, 0.16, 0.85, 1.2],
    [-1.5, 0.38, 0.65, 1.35],
    [-0.6, 0.5, 0.55, 1.75],
    [0.9, 0.52, 0.55, 1.75],
    [1.6, 0.5, 0.58, 1.5],
    [1.7, 0.48, 0.6, 1.2],
    [3.0, 0.4, 0.62, 1.15],
  ];
  const ring = ([x, w, b, t]) => {
    const h = t - b;
    return [[x, b, -0.6 * w], [x, b, 0.6 * w], [x, b + 0.35 * h, w], [x, b + 0.8 * h, w], [x, t, 0.7 * w], [x, t, -0.7 * w], [x, b + 0.8 * h, -w], [x, b + 0.35 * h, -w]];
  };
  parts.push(
    loft(R.map(ring), {
      color: (i, j) => {
        if (j === 1 || j === 7) return C.blue; // lower stripe
        if (j === 0) return C.belly;
        if (i === 3 && (j === 2 || j === 6)) return C.glass; // cabin windows
        if (i === 4 && (j === 3 || j === 4 || j === 5)) return C.glass; // windshield
        if (i >= 5 && j === 4) return C.white;
        return C.white;
      },
      caps: [C.red, C.blue],
    }),
  );

  // high wing: root-tip taper through three rings along z
  const wingRing = (z, le, te, top, bot) => [[le, top, z], [te, top, z], [te, bot, z], [le, bot, z]];
  parts.push(
    loft([wingRing(-4.2, 0.95, -0.05, 1.74, 1.65), wingRing(0, 1.1, -0.4, 1.82, 1.68), wingRing(4.2, 0.95, -0.05, 1.74, 1.65)], {
      color: (i, j) => (j === 2 ? C.belly : j === 1 ? C.white : C.white),
      caps: [C.red, C.red],
    }),
  );

  // tailplane and fin
  const tailRing = (z, le, te, y, t = 0.025) => [[le, y + t, z], [te, y + t, z], [te, y - t, z], [le, y - t, z]];
  parts.push(loft([tailRing(-1.3, -3.55, -4.0, 1.06), tailRing(0, -3.2, -4.05, 1.1, 0.04), tailRing(1.3, -3.55, -4.0, 1.06)], { caps: [C.blue, C.blue] }));
  const finRing = (y, le, te, t) => [[le, y, -t], [te, y, -t], [te, y, t], [le, y, t]];
  parts.push(
    loft([finRing(1.08, -2.85, -4.05, 0.06), finRing(1.8, -3.35, -4.1, 0.04), finRing(2.35, -3.8, -4.15, 0.025)], {
      color: (i) => (i === 0 ? C.white : C.blue),
      caps: [C.white, C.blue],
    }),
  );

  // wing struts and landing gear
  for (const s of [-1, 1]) {
    parts.push(strut([0.3, 0.72, s * 0.5], [0.3, 1.67, s * 2.4], 0.05, C.white));
    parts.push(strut([0.5, 0.6, s * 0.45], [0.5, 0.27, s * 1.1], 0.045, C.metal));
    parts.push(wheel(0.5, 0.25, s * 1.15, 0.25, 0.07));
  }
  parts.push(strut([2.0, 0.62, 0], [2.0, 0.24, 0], 0.045, C.metal));
  parts.push(wheel(2.0, 0.22, 0, 0.22, 0.06));

  // spinner and propeller
  const disc = (x, r) => Array.from({ length: 8 }, (_, a) => circle(8, r, (c, s) => [x, 0.88 + s, c])(a));
  parts.push(loft([disc(3.0, 0.22), disc(3.12, 0.2), disc(3.42, 0.04)], { color: () => C.red, caps: [C.red, C.red] }));
  const blade = (yaw) =>
    loft(
      [-1, 1].map((e) => {
        const dz = Math.sin(yaw) * e * 0.8;
        const dy = Math.cos(yaw) * e * 0.8;
        const w = 0.09;
        return [[3.3, 0.88 + dy, dz - w * Math.cos(yaw)], [3.3, 0.88 + dy, dz + w * Math.cos(yaw)], [3.36, 0.88 + dy, dz + w * Math.cos(yaw)], [3.36, 0.88 + dy, dz - w * Math.cos(yaw)]];
      }),
      { color: () => C.prop, caps: [C.prop, C.prop] },
    );
  parts.push(blade(0.5));

  return merge(...parts);
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const mesh = cessna();
  const v = validate(mesh);
  console.log(`${mesh.positions.length} vertices, ${mesh.faces.length} faces, ${new Set(mesh.faces.map((f) => f.color)).size} colours`, v.ok ? 'ok' : v.notes);
  writeFileSync(new URL('./cessna.scene.json', import.meta.url), JSON.stringify({ format: '3draft-scene', version: 1, objects: [{ name: 'cessna', mesh }] }));
  writeFileSync(new URL('./out/cessna.svg', import.meta.url), renderView(mesh, orbit({ yaw: -0.7, pitch: 0.25 }), { size: 800, points: false }));
}
