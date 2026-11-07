// The 500 nearest stars as plain spheres (no shaders yet). 1 unit = 1 light-year, the Sun sits at the origin, y is up
// (equatorial z), so you can fly from star to star. Data: examples/data/stars500.js (HYG v4.1, nearest 500, out to ~38 ly).
// Every star is ONE object: a solid core sphere sized by its real radius and a faint emissive halo that grows with the
// luminosity, so even a far star stays visible as a glow. Real radii are ~1e-8 ly, so they are scaled by one constant
// (SUN = displayed Sun radius) and clamped to a visible floor; the ratios between stars stay true above the floor.
// `node examples/stars.js` writes examples/stars.scene.json.

import { writeFileSync } from 'node:fs';
import { validate } from '../dist/index.js';
import { STARS } from './data/stars500.js';

const LY_PER_PC = 3.26156;
const SUN = 0.05; // displayed radius of a 1 R_sun star, in ly
const FLOOR = 0.012; // smallest displayed core radius (white dwarfs)

// class -> [core colour, halo colour, emit, roughness]; colours are the usual blackbody tints
const CLASSES = {
  O: ['#9bb0ff', 1.0], B: ['#aabfff', 1.0], A: ['#cad7ff', 0.95], F: ['#f8f7ff', 0.9], G: ['#fff4ea', 0.85],
  K: ['#ffd2a1', 0.8], M: ['#ffb067', 0.75], D: ['#e8eeff', 0.9], L: ['#c46a3a', 0.4], X: ['#ffcf9a', 0.6],
};
const palette = [];
for (const [k, [color, emit]] of Object.entries(CLASSES)) {
  palette.push({ name: `star-${k}`, color, metal: 0, rough: 0.5, alpha: 1, emit, soft: 0 });
  palette.push({ name: `halo-${k}`, color, metal: 0, rough: 1, alpha: 0.16, emit: 1, soft: 0 });
}

const klass = (spect, ci) => {
  if (/^D/.test(spect)) return 'D';
  const m = /[OBAFGKMLT]/i.exec(spect.replace(/^sd|^d/i, ''));
  if (m) return m[0].toUpperCase() === 'T' ? 'L' : m[0].toUpperCase();
  if (ci == null) return 'X';
  return ci < 0 ? 'B' : ci < 0.3 ? 'A' : ci < 0.58 ? 'F' : ci < 0.81 ? 'G' : ci < 1.4 ? 'K' : 'M';
};
// B-V colour index -> effective temperature in K (Ballesteros 2012)
const temp = (ci) => 4600 * (1 / (0.92 * ci + 1.7) + 1 / (0.92 * ci + 0.62));
const TYPICAL = { O: 4e4, B: 2e4, A: 9e3, F: 6.8e3, G: 5.7e3, K: 4.5e3, M: 3.3e3, D: 1.2e4, L: 2e3, X: 4e3 };
// ci is a B-V colour, so it only stands in for the temperature when the class is unknown
const tint = (ci, k) => {
  if (ci == null) return CLASSES[k][0];
  const t = Math.min(40000, Math.max(2500, temp(ci)));
  const u = (Math.log(t) - Math.log(2500)) / (Math.log(40000) - Math.log(2500)); // 0 red .. 1 blue
  const stops = [[0, [255, 150, 70]], [0.3, [255, 205, 150]], [0.5, [255, 244, 234]], [0.7, [220, 228, 255]], [1, [155, 176, 255]]];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) if (u >= stops[i][0] && u <= stops[i + 1][0]) (a = stops[i], b = stops[i + 1]);
  const w = (u - a[0]) / (b[0] - a[0] || 1);
  return '#' + a[1].map((x, i) => Math.round(x + (b[1][i] - x) * w).toString(16).padStart(2, '0')).join('');
};

const sphere = (cx, cy, cz, r, seg, rings, mat, color) => {
  const positions = [[cx, cy + r, cz]];
  for (let i = 1; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const th = (Math.PI * i) / rings, ph = (2 * Math.PI * j) / seg;
      positions.push([cx + r * Math.sin(th) * Math.sin(ph), cy + r * Math.cos(th), cz + r * Math.sin(th) * Math.cos(ph)]);
    }
  positions.push([cx, cy - r, cz]);
  const faces = [];
  const f = (a, b, c) => faces.push({ v: [a, b, c], mat, color });
  const R = (i, j) => 1 + (i - 1) * seg + (j % seg);
  for (let j = 0; j < seg; j++) f(0, R(1, j), R(1, j + 1));
  for (let i = 1; i < rings - 1; i++)
    for (let j = 0; j < seg; j++) (f(R(i, j), R(i + 1, j + 1), R(i, j + 1)), f(R(i, j), R(i + 1, j), R(i + 1, j + 1)));
  for (let j = 0; j < seg; j++) f(R(rings - 1, j), positions.length - 1, R(rings - 1, j + 1));
  return { positions, faces };
};

export const stars = () => {
  const objects = [];
  for (const [name, x, y, z, absmag, spect, ci, lumField] of STARS) {
    const k = klass(spect, ci);
    const lum = lumField > 0 ? lumField : Math.pow(10, (4.85 - absmag) / 2.5);
    const T = ci != null && k !== 'D' ? temp(ci) : TYPICAL[k];
    const rSun = k === 'D' ? 0.012 : Math.sqrt(lum) / Math.pow(Math.max(T, 1500) / 5772, 2); // R/R_sun from L and T
    const r = Math.max(FLOOR, SUN * rSun);
    const halo = r + 0.04 + 0.16 * Math.log10(1 + lum * 100) / 2; // grows slowly with luminosity
    const px = x * LY_PER_PC, py = z * LY_PER_PC, pz = -y * LY_PER_PC; // equatorial z is up; flip y so it is not mirrored
    const col = tint(ci, k);
    const core = sphere(px, py, pz, r, 10, 5, `star-${k}`, col);
    const glow = sphere(px, py, pz, halo, 8, 4, `halo-${k}`, col);
    const mesh = { positions: [...core.positions, ...glow.positions], faces: [...core.faces, ...glow.faces.map((f) => ({ ...f, v: f.v.map((i) => i + core.positions.length) }))] };
    objects.push({ name: name === 'Sol' ? 'Sun' : name, mesh });
  }
  return { palette, objects };
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { palette, objects } = stars();
  const faces = objects.reduce((n, o) => n + o.mesh.faces.length, 0);
  const bad = objects.filter((o) => !validate(o.mesh).ok).length;
  console.log(objects.length, 'stars', faces, 'faces', bad, 'invalid');
  writeFileSync(new URL('./stars.scene.json', import.meta.url), JSON.stringify({ format: '3draft-scene', version: 1, palette, objects }));
}
