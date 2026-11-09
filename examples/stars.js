// The 500 nearest stars as plain spheres (no shaders yet). 1 unit = 1 light-year, the Sun sits at the origin, y is up
// (equatorial z), so you can fly from star to star. Data: examples/data/stars500.js (HYG v4.1, nearest 500, out to ~38 ly).
// Every star is ONE object: a solid core sphere sized by its real radius and a faint emissive halo that grows with the
// luminosity, so even a far star stays visible as a glow. Real radii are ~1e-8 ly, so they are scaled by one constant
// (SUN = displayed Sun radius) and clamped to a visible floor; the ratios between stars stay true above the floor.
// `node examples/stars.js` writes examples/stars.scene.json (500 stars, with glow) and stars-plain.scene.json (the nearest 5000, no glow).

import { writeFileSync } from 'node:fs';
import { validate } from '../dist/index.js';
import { STARS } from './data/stars500.js';
import { STARS as STARS5000 } from './data/stars5000.js';
import { GALAXIES } from './data/galaxies.js';
import { cloudFor, CLOUD_PROTOS } from './galaxy-clouds.js';

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

// One prototype for every star: a core sphere and a halo sphere (slots 'core' and 'halo', radius 1), seven levels of detail.
// Seven levels of detail; far away the shape does not matter: the last ones are a lone halo, and an octahedron when it is only a few pixels.
const lod = (coreSeg, coreRings, haloSeg, haloRings) => {
  const core = coreSeg ? sphere(0, 0, 0, 1, coreSeg, coreRings, 'core') : { positions: [], faces: [] };
  const halo = sphere(0, 0, 0, 1, haloSeg, haloRings, 'halo');
  const r4 = (p) => p.map((v) => Math.round(v * 1e4) / 1e4);
  return { positions: [...core.positions, ...halo.positions].map(r4), faces: [...core.faces, ...halo.faces.map((f) => ({ ...f, v: f.v.map((i) => i + core.positions.length) }))] };
};
// the core is smooth enough at every size (the edge of a ball of r pixels stays within ~half a pixel of a true circle); the halo is faint but up to ~8x wider than the core, so it keeps more segments than a core of the same level
export const PROTOTYPES = { star: { lods: [lod(64, 32, 48, 24), lod(32, 16, 32, 16), lod(16, 8, 24, 12), lod(8, 4, 16, 8), lod(4, 2, 12, 6), lod(0, 0, 8, 4), lod(0, 0, 4, 2)] } };

// the plain star: the core sphere only, no glow object (`halo: false` tells the viewer the last level is no halo-only one)
const coreOnly = (seg, rings) => sphere(0, 0, 0, 1, seg, rings, 'core');
const r4m = (m) => ({ ...m, positions: m.positions.map((p) => p.map((v) => Math.round(v * 1e4) / 1e4)) });
export const PLAIN = { star: { halo: false, // no halo mesh: the viewer draws a soft sprite instead (instance field `glow`)
    lods: [coreOnly(64, 32), coreOnly(32, 16), coreOnly(16, 8), coreOnly(8, 4), coreOnly(4, 2)].map(r4m) } };

const round = (v) => Math.round(v * 1e4) / 1e4;

// ---- galaxies and the black hole of the Milky Way (the point-glow scene) ----
const ellipsoid = (r, y, seg, rings, mat) => { const m = sphere(0, 0, 0, r, seg, rings, mat); return { ...m, positions: m.positions.map(([a, b, c]) => [a, b * y, c]) }; };
// a thin lens (or ring with an inner radius): closed, so it is a proper solid; `t` is the half thickness
const disc = (inner, n, mat, t = 0.03) => {
  const positions = [], faces = [];
  const ang = (j) => (2 * Math.PI * j) / n;
  if (!inner) {
    for (let j = 0; j < n; j++) positions.push([Math.sin(ang(j)), 0, Math.cos(ang(j))]);
    positions.push([0, t, 0], [0, -t, 0]);
    for (let j = 0; j < n; j++) { const k = (j + 1) % n; faces.push({ v: [k, n, j], mat }, { v: [j, n + 1, k], mat }); }
    return { positions, faces };
  }
  const mid = (1 + inner) / 2;
  for (let j = 0; j < n; j++) { const a = ang(j), s = Math.sin(a), c = Math.cos(a); positions.push([s, 0, c], [mid * s, t, mid * c], [inner * s, 0, inner * c], [mid * s, -t, mid * c]); }
  const V = (j, w) => 4 * (j % n) + w;
  for (let j = 0; j < n; j++) for (let w = 0; w < 4; w++) {
    const w2 = (w + 1) % 4, a = V(j, w), b = V(j + 1, w), c = V(j + 1, w2), d = V(j, w2);
    faces.push({ v: [a, b, c], mat }, { v: [a, c, d], mat });
  }
  return { positions, faces };
};
const join = (...ms) => { const positions = [], faces = []; for (const m of ms) { const o = positions.length; positions.push(...m.positions); faces.push(...m.faces.map((f) => ({ ...f, v: f.v.map((i) => i + o) }))); } return r4m({ positions, faces }); };
export const GALAXY_PROTOS = {
  // a faint stand-in for a galaxy that is drawn as a point cloud: something to point at and to target (one level, 24 faces)
  ghost: { halo: false, lods: [r4m(ellipsoid(1, 0.75, 8, 4, 'core'))] },
  // the black hole: a black ball inside a thin hot ring (accretion disc), radius of the ball 1
  hole: { halo: false, lods: [[32, 16, 48], [16, 8, 24], [8, 4, 16], [6, 3, 8]].map(([sg, rg, n]) => join(sphere(0, 0, 0, 1, sg, rg, 'core'), (() => { const d = disc(0.35, n, 'disc'); return { ...d, positions: d.positions.map((p) => p.map((v) => v * 4.5)) }; })())) },
};
export const GALAXY_PALETTE = [
  { name: 'gal-disc', color: '#9db4ff', metal: 0, rough: 1, alpha: 1, emit: 0.55, soft: 0 },
  { name: 'gal-bulge', color: '#ffdca8', metal: 0, rough: 1, alpha: 1, emit: 0.9, soft: 0 },
  { name: 'gal-blob', color: '#ffd9a0', metal: 0, rough: 1, alpha: 1, emit: 0.7, soft: 0 },
  { name: 'gal-ghost', color: '#9db4ff', metal: 0, rough: 1, alpha: 0, emit: 0, soft: 0 },
  { name: 'bh-core', color: '#000000', metal: 0, rough: 1, alpha: 1, emit: 0, soft: 0 },
  { name: 'bh-disc', color: '#ff9a40', metal: 0, rough: 1, alpha: 1, emit: 1, soft: 0 },
];
const KIND = { S: ['#bcd0ff'], E: ['#ffd9a0'], I: ['#a9c4ff'], D: ['#ffe2b8'] };
export const LY = (ra, dec, d) => { const a = (ra * Math.PI) / 12, b = (dec * Math.PI) / 180; const x = d * Math.cos(b) * Math.cos(a), y = d * Math.cos(b) * Math.sin(a), z = d * Math.sin(b); return [round(x), round(z), round(-y)]; };
// Sagittarius A*, the supermassive black hole at the centre of the Milky Way. The ball is drawn far larger than its true size (a few light-minutes) so it can be found.
export const blackHole = (at) => ({ name: 'Sagittarius A* (Milky Way black hole)', proto: 'hole', at, scale: 40, mats: { core: 'bh-core', disc: 'bh-disc' }, glow: 700, glowColor: '#ff9a40', far: true, rot: [0.6, 0.4] });
export const galaxies = () => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // fixed orientations
  const out = GALAXIES.slice(0, 100).map(([name, ra, dec, mly, kly, t], idx) => {
    const radius = kly * 500; // ly
    return { name, proto: 'ghost', at: LY(ra, dec, mly * 1e6), scale: radius, mats: { core: 'gal-ghost' }, glow: round(radius * 4), glowColor: KIND[t][0], far: true,
      cloud: cloudFor(t, idx), rot: [round(Math.acos(1 - 2 * rnd())), round(2 * Math.PI * rnd())] };
  });
  out.push(blackHole(LY(17.7611, -29.0078, 26670)));
  return out;
};

export const stars = ({ plain = false, extras = true } = {}) => {
  const objects = [];
  for (const [name, x, y, z, absmag, spect, ci, lumField] of plain ? STARS5000.slice(0, 300) : STARS) {
    const k = klass(spect, ci);
    const lum = lumField > 0 ? lumField : Math.pow(10, (4.85 - absmag) / 2.5);
    const T = ci != null && k !== 'D' ? temp(ci) : TYPICAL[k];
    const rSun = k === 'D' ? 0.012 : Math.sqrt(lum) / Math.pow(Math.max(T, 1500) / 5772, 2); // R/R_sun from L and T
    const r = Math.max(FLOOR, SUN * rSun);
    const halo = r + 0.04 + 0.16 * Math.log10(1 + lum * 100) / 2; // grows slowly with luminosity
    objects.push({
      name: name === 'Sol' ? 'Sun' : name,
      proto: 'star',
      at: [round(x * LY_PER_PC), round(z * LY_PER_PC), round(-y * LY_PER_PC)], // equatorial z is up; flip y so it is not mirrored
      ...(plain ? { glow: round(halo) } : {}),
      scale: plain ? round(r) : { core: round(r), halo: round(halo) },
      mats: plain ? { core: `star-${k}` } : { core: `star-${k}`, halo: `halo-${k}` },
      color: tint(ci, k),
    });
  }
  // the eye starts next to the Sun, looking at it, so you are among the stars and not outside the cloud
  const eye = [0.25, 0.06, 0.6];
  const start = { eye, yaw: Math.round((Math.atan2(-eye[0], eye[2]) * 180) / Math.PI * 10) / 10, pitch: Math.round((Math.asin(eye[1] / Math.hypot(...eye)) * 180) / Math.PI * 10) / 10 };
  if (plain && extras) objects.push(...galaxies());
  return plain ? { palette: [...palette.filter((p) => p.name.startsWith('star-')), ...GALAXY_PALETTE], prototypes: { ...PLAIN, ...GALAXY_PROTOS }, cloudProtos: CLOUD_PROTOS, start, objects } : { palette, prototypes: PROTOTYPES, start, objects };
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const scene = stars();
  const bad = PROTOTYPES.star.lods.filter((m) => !validate(m).ok).length;
  console.log(scene.objects.length, 'stars,', PROTOTYPES.star.lods.map((m) => m.faces.length).join('/'), 'faces per level,', bad, 'invalid levels');
  writeFileSync(new URL('./stars.scene.json', import.meta.url), JSON.stringify({ format: '3draft-scene', version: 2, ...scene }));
  writeFileSync(new URL('./stars-plain.scene.json', import.meta.url), JSON.stringify({ format: '3draft-scene', version: 2, ...stars({ plain: true }) }));
}
