// Deep sky: a stress test of a big scene. The Milky Way stays a stored point cloud (milkyway.js); every other galaxy is only a
// recipe (`galaxy`: kind, seed, shape) that the viewer samples on the fly when it is big on screen (engine: galaxyPoints).
//   1000 galaxies   the curated nearby list (real distances) + the brightest OpenNGC galaxies (distance from the recession velocity),
//                   turned by their catalogue axis ratio and position angle
//   400 black holes Sagittarius A*, the known stellar ones of the Milky Way and the LMC, and the central black holes of the
//                   biggest galaxies of the list (every big galaxy has one)
//   3000 stars      the nearest 1000 (HYG) and 2000 notable ones farther out (named first, then by brightness, out to ~3000 ly),
//                   + the few constellation stars the list lacked (figures.js)
//   89 figures      the constellations as seen from Earth (d3-celestial's lines matched to HYG stars: build-figures.mjs)
// Lengths are light years, the Sun at the origin, equatorial x y z -> [x, z, -y] like the other star scenes.
// Data: examples/data/deepsky-data.js (build-deepsky.mjs), stars5000.js, galaxies.js.
import { writeFileSync } from 'node:fs';
import { STARS as NEAR } from './data/stars5000.js';
import { FAR_STARS, NGC, AXES } from './data/deepsky-data.js';
import { GALAXIES } from './data/galaxies.js';
import { FIGURE_STARS, FIGURES } from './data/figures.js';
import { starObject, STAR_PALETTE, PLAIN, GALAXY_PROTOS, GALAXY_PALETTE, LY, blackHole, SUN_START } from './stars.js';
import { cloud, centre, start } from './milkyway.js';

const round = (v) => Math.round(v * 1e4) / 1e4;
const rad = (d) => (d * Math.PI) / 180;
const hash = (s) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 2147483646 + 1; };
let seed = 424242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---- the disc's normal from the catalogue: the galaxy at (ra, dec), inclined by acos(axis ratio), its major axis at the
// position angle (from north through east). Returns the scene `rot` [tilt about x, turn about y] that puts local y there.
const rotFor = (raH, dec, q, pa) => {
  const a = (raH * Math.PI) / 12, d = rad(dec);
  const L = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  const E = [-Math.sin(a), Math.cos(a), 0];
  const N = [-Math.sin(d) * Math.cos(a), -Math.sin(d) * Math.sin(a), Math.cos(d)];
  let n;
  if (q == null || pa == null) {
    const z = 2 * rnd() - 1, t = 2 * Math.PI * rnd(), s = Math.sqrt(1 - z * z);
    n = [s * Math.cos(t), s * Math.sin(t), z];
  } else {
    const inc = Math.acos(Math.min(1, Math.max(0.12, q))); // a disc is never thinner than ~0.12 of its width
    const p = rad(pa);
    const minor = [0, 1, 2].map((i) => -N[i] * Math.sin(p) + E[i] * Math.cos(p));
    const side = rnd() < 0.5 ? 1 : -1; // which side faces us is not in the catalogue
    n = [0, 1, 2].map((i) => L[i] * Math.cos(inc) + side * minor[i] * Math.sin(inc));
  }
  let s = [n[0], n[2], -n[1]]; // to scene axes
  if (s[1] < 0) s = s.map((v) => -v);
  return [round(Math.acos(Math.min(1, s[1]))), round(Math.atan2(s[0], s[2]))];
};

// ---- the recipe from the Hubble type
const recipe = (kind, type, q, name) => {
  const t = type.replace(/[?:]/g, '');
  const g = { kind, seed: hash(name) };
  if (kind === 'S') {
    const stage = /S[AB]?[ab]?(0|a|b|c|d|m)/.exec(t)?.[1] ?? 'b';
    Object.assign(g, { a: 0, b: 1, c: 2, d: 3, m: 3 }[stage] !== undefined ? {
      arms: stage === 'd' || stage === 'm' ? 3 + (g.seed % 2) : 2 + (g.seed % 4 === 0 ? 1 : 0),
      pitch: { a: 10, b: 15, c: 22, d: 27, m: 30 }[stage] ?? 16,
      armShare: { a: 0.5, b: 0.6, c: 0.65, d: 0.45, m: 0.35 }[stage] ?? 0.6,
    } : {});
    if (/SB/.test(t)) g.bar = 0.3 + (g.seed % 10) / 50;
  } else if (kind === 'E') {
    if (/S0/.test(t)) Object.assign(g, { b: 0.3, c: 1 }); // lenticular: a fat lens, turned like a disc
    else { const e = /E(\d)/.exec(t); const r = e ? 1 - Number(e[1]) / 10 : q ?? 0.8; Object.assign(g, { b: round(Math.max(0.35, r)), c: round(Math.max(0.45, (1 + r) / 2)) }); }
  } else if (kind === 'I') g.clumps = 3 + (g.seed % 7);
  return g;
};
const kindOf = (type) => (/^S0|^E|^cD/.test(type) ? 'E' : /^S/.test(type) ? 'S' : /^I/.test(type) ? 'I' : 'E');
const GLOW = { S: '#bcd0ff', E: '#ffd9a0', I: '#a9c4ff', D: '#ffe2b8' };
const galaxyObject = (name, raH, dec, mly, kly, kind, type, q, pa) => {
  const radius = kly * 500; // ly
  const g = recipe(kind, type, q, name);
  // as many points as the Milky Way's cloud (29 650 for ~90 kly) at the same size, in proportion to the diameter: Andromeda
  // gets ~50 000; the viewer draws only part of them while a galaxy is small on screen
  g.n = Math.round(Math.min(60000, Math.max(300, (30000 * kly) / 90 * { S: 1, E: 1, I: 0.6, D: 0.4 }[kind])));
  const flat = kind === 'S' || (kind === 'E' && /S0/.test(type)) || kind === 'I';
  return { name, proto: 'ghost', at: LY(raH, dec, mly * 1e6), scale: round(radius), mats: { core: 'gal-ghost' }, glow: round(radius * 4), glowColor: GLOW[kind], far: true,
    galaxy: g, rot: flat ? rotFor(raH, dec, q, pa) : rotFor(raH, dec, null, null) };
};

// curated nearby galaxies (real distances); their axes from the catalogue when the id is there
const idOf = (name) => /\b(M\d+|NGC \d+|IC \d+)\b/.exec(name)?.[1];
const curated = GALAXIES.map(([name, ra, dec, mly, kly, t]) => {
  const ax = AXES[idOf(name)];
  const type = ax?.[2] || { S: 'Sb', E: 'E', I: 'I', D: 'dSph' }[t];
  return galaxyObject(name, ra, dec, mly, kly, t, t === 'D' ? 'dSph' : type, ax?.[0] ?? null, ax?.[1] ?? null);
});
const taken = new Set(GALAXIES.flatMap(([name]) => [...name.matchAll(/\b(M\d+|NGC \d+|IC \d+)\b/g)].map((m) => m[1])));
// ---- interacting galaxies: one moment of each pair, sampled by the engine (a restricted N-body run, recipe kind 'P'), every pair
// with its own seed; the parameters are set by hand to look like the observed shape. [name, RA h, Dec deg, distance Mly, system
// radius kly, recipe, the single galaxies of the lists it replaces]
const PAIRS = [
  ['M81 + M82 (interacting)', 9.9286, 69.372, 12, 110, { ratio: 0.3, peri: 2.5, incl1: 30, incl2: 60, time: 6 }, ['Bode (M81)', 'Cigar (M82)']],
  ['Whirlpool M51 + NGC 5195', 13.4989, 47.231, 31, 70, { ratio: 0.3, peri: 1.6, incl1: 15, incl2: 70, time: 2.5 }, ['Whirlpool (M51)']],
  ['Antennae (NGC 4038 + 4039)', 12.0315, -18.877, 65, 250, { ratio: 1, peri: 1.2, incl1: 60, incl2: -60, time: 4 }, ['Antennae Galaxies · NGC 4038', 'Antennae Galaxies · NGC 4039']],
  ['NGC 520 (Arp 157)', 1.4097, 3.792, 100, 90, { ratio: 0.8, peri: 0.8, incl1: 40, incl2: 120, time: 6, merge: 0.6 }, ['NGC 520 NED01', 'NGC 520 NED02']],
  ['NGC 3256 (merger)', 10.4642, -43.904, 100, 120, { ratio: 1, peri: 0.5, incl1: 30, incl2: 80, time: 8, merge: 0.8 }, ['NGC 3256']],
  ['NGC 2207 + IC 2163', 6.2736, -21.374, 114, 110, { ratio: 0.5, peri: 1.5, incl1: 20, incl2: 50, time: 1.5 }, ['NGC 2207', 'IC 2163']],
  ['Atoms for Peace (NGC 7252)', 22.3458, -24.678, 220, 200, { ratio: 1, peri: 0.4, incl1: 20, incl2: 70, time: 12, merge: 3 }, []],
  ['Arp 220', 15.5826, 23.503, 250, 80, { ratio: 1, peri: 0.3, incl1: 40, incl2: 100, time: 10, merge: 3 }, []],
  ["Stephan's Quintet (NGC 7319 + 7318B)", 22.6003, 33.971, 290, 150, { ratio: 0.6, peri: 0.6, incl1: 50, incl2: 100, time: 1 }, []],
  ['Mice (NGC 4676 A + B)', 12.7696, 30.727, 300, 180, { ratio: 1, peri: 1, incl1: 15, incl2: 60, time: 1.5 }, []],
  ['Penguin and Egg (Arp 142, NGC 2936 + 2937)', 9.6291, 2.754, 326, 100, { ratio: 0.4, peri: 1.2, incl1: 20, kind2: 'E', time: 1.5 }, []],
];
const pairObject = (name, ra, dec, mly, kly, rec, at) => {
  const radius = kly * 1000;
  return { name, proto: 'ghost', at: at ?? LY(ra, dec, mly * 1e6), scale: round(radius), mats: { core: 'gal-ghost' }, glow: round(radius * 2), glowColor: '#c9d6ff', far: true,
    galaxy: { kind: 'P', seed: hash(name), n: 3000, ...rec }, rot: rotFor(ra, dec, null, null) };
};
const pairs = PAIRS.map(([name, ra, dec, mly, kly, rec]) => pairObject(name, ra, dec, mly, kly, rec));
// Stephan's Quintet's other members (two small ellipticals) and NGC 7320, which only looks like one of them (it is 40 Mly away)
const extras = [
  galaxyObject('NGC 7317 (Stephan)', 22.5977, 33.945, 290, 70, 'E', 'E', null, null),
  galaxyObject('NGC 7318A (Stephan)', 22.5991, 33.966, 290, 120, 'E', 'E', null, null),
  galaxyObject('NGC 7320 (in front of Stephan)', 22.6009, 33.948, 39, 29, 'S', 'Scd', 0.55, 132),
];
// the Sagittarius dwarf's stream round the Milky Way: only the dwarf's particles, the frame on the Milky Way's middle
const sgr = pairObject('Sagittarius stream', 17.76, -29.0, 0, 160, { ratio: 0.003, peri: 0.4, ecc: 0.6, size2: 0.08, kind2: 'E', first: false, time: 25, n: 1600 }, blackHole(centre).at);
sgr.glow = 1; // (no big haze over the Milky Way: the stream shows by its points)
const replaced = new Set([...PAIRS.flatMap((x) => x[6]), 'Sagittarius dSph']);
const kept = curated.filter((g) => !replaced.has(g.name));
const special = [...pairs, ...extras, sgr];
const fromCatalogue = NGC.filter(([name]) => !name.split(' · ').some((x) => taken.has(x)))
  .map(([name, ra, dec, mly, kly, type, q, pa]) => galaxyObject(name, ra, dec, mly, kly, kindOf(type), type, q, pa))
  .filter((g) => !replaced.has(g.name))
  .slice(0, 1000 - kept.length - special.length);
const galaxies = [...kept, ...special, ...fromCatalogue];

// ---- black holes
const hole = (name, at, scale, rot) => ({ name, proto: 'hole', at: at.map(round), scale: round(scale), mats: { core: 'bh-core', disc: 'bh-disc' }, glow: round(scale * 17), glowColor: '#cfd8ff', far: true, rot });
// the known stellar black holes (RA h, Dec deg, distance ly; rounded literature values)
const STELLAR = [
  ['Cygnus X-1', 19.972, 35.2, 7200], ['V404 Cygni', 20.401, 33.87, 7800], ['A0620-00 (V616 Mon)', 6.376, -0.35, 3300],
  ['Gaia BH1', 17.47, -0.58, 1560], ['Gaia BH2', 13.84, -59.53, 3800], ['Gaia BH3', 19.65, 14.93, 1926],
  ['GRS 1915+105', 19.252, 10.95, 28000], ['GRO J1655-40', 16.9, -39.85, 11000], ['XTE J1118+480', 11.3, 48.04, 5700],
  ['GX 339-4', 17.045, -48.79, 26000], ['MAXI J1820+070', 18.34, 7.19, 9600], ['V4641 Sagittarii', 18.32, -25.41, 20000],
  ['GS 2000+25', 20.05, 25.24, 8800], ['Nova Muscae 1991', 11.44, -68.68, 16300], ['4U 1543-47', 15.79, -47.67, 24000],
  ['LMC X-1', 5.665, -69.74, 163000], ['LMC X-3', 5.64, -64.08, 163000],
];
const NAMED_SMBH = { 'Virgo A (M87)': 'M87* (Pōwehi)', 'Andromeda (M31)': 'M31*', 'Centaurus A': 'Centaurus A*', M106: 'M106* (maser disc)', 'Sombrero (M104)': 'M104*' };
const holes = [hole('Sagittarius A* (Milky Way black hole)', blackHole(centre).at, 40, [0.6, 0.4])];
for (const [name, ra, dec, d] of STELLAR) holes.push(hole(name, LY(ra, dec, d), 0.3, [round(rnd() * 3), round(rnd() * 6)]));
const big = galaxies.filter((g) => g.galaxy.kind === 'S' || g.galaxy.kind === 'E').sort((a, b) => b.scale - a.scale).slice(0, 400 - holes.length);
for (const g of big) {
  const named = NAMED_SMBH[g.name] ?? Object.entries(NAMED_SMBH).find(([k]) => g.name.includes(k))?.[1];
  // Sgr A* is drawn 40 ly for a 50 000 ly galaxy: the same ratio, ellipticals' black holes ~4x heavier
  holes.push(hole(named ?? `${g.name} central black hole`, g.at, g.scale * 0.0008 * (g.galaxy.kind === 'E' ? 2 : 1), g.rot));
}

// ---- stars
const near = NEAR.slice(0, 1000).map((row) => starObject(row));
const far = [...FAR_STARS, ...FIGURE_STARS].map((row) => starObject(row, { boost: true })); // (+ the constellation stars the list lacked)

const objects = [...near, ...far, ...holes, ...galaxies];
export const scene = {
  format: '3draft-scene', version: 2,
  palette: [...STAR_PALETTE.filter((p) => p.name.startsWith('star-')), ...GALAXY_PALETTE], prototypes: { ...PLAIN, ...GALAXY_PROTOS },
  start: SUN_START, vehicle: 'starship', cloud, objects,
  // the constellation figures as seen from Earth: polylines between the stars' centres (the viewer draws them, the sky switch)
  figures: FIGURES.map(([id, name, en, lines]) => ({ id, name, en, lines })),
};
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const json = JSON.stringify(scene);
  writeFileSync(new URL('./deepsky.scene.json', import.meta.url), json);
  console.log(galaxies.length, 'galaxies,', holes.length, 'black holes,', near.length + far.length, 'stars,', cloud.n, 'Milky Way points;', (json.length / 1e6).toFixed(2), 'MB');
}
