// EX-27 "Expedition Module": 42.8 m x 14.6 m x 11.9 m, two decks, built from a few repeatable prototypes (examples/kit.js):
// one hull section (stretched to each module's length), one landing leg (mirrored, six times, and again 0.3x on the
// landers), one window, one engine pod, one bunk ... Materials are slots, so a copy can be re-skinned without touching
// the shape. The nose points to -z, y is up, the ground is y = 0. `node examples/ex27.js` writes ex27.scene.json.

import { writeFileSync } from 'node:fs';
import { validate } from '../dist/index.js';
import { box, capsule, clip, cylinder, face, hullSection, inset, mesh, merge, model, octagon, place, prism, strut } from './kit.js';

const mat = (name, color, rough = 0.6, metal = 0.2, extra = {}) => ({ name, color, rough, metal, alpha: 1, emit: 0, soft: 0, ...extra });
export const PALETTE = [
  mat('hullWhite', '#c9c2b2', 0.74, 0.3), mat('hullOrange', '#d9741a', 0.6, 0.35), mat('hullDark', '#33373c', 0.55, 0.6),
  mat('rust', '#7b5236', 0.85, 0.3), mat('metal', '#70767d', 0.4, 0.85), mat('darkMetal', '#25282c', 0.5, 0.7),
  mat('tank', '#1c1d1f', 0.45, 0.7), mat('glass', '#86b8d8', 0.05, 0.1, { alpha: 0.24 }),
  mat('pane', '#ffb45e', 0.4, 0, { emit: 1 }), mat('screen', '#4ab0ff', 0.3, 0, { emit: 1 }),
  mat('orangeGlow', '#ff8a1f', 0.4, 0, { emit: 1 }), mat('lightStrip', '#fff1da', 0.4, 0, { emit: 1 }),
  mat('floor', '#3b3e43', 0.6, 0.6), mat('wall', '#8a8d8f', 0.7, 0.2), mat('ceil', '#a5a8a8', 0.8, 0.2),
  mat('fabric', '#3c5266', 0.95), mat('bedding', '#cfc8b8', 1), mat('wood', '#a97c50', 0.75), mat('hazard', '#d9a519', 0.6, 0.2),
  mat('black', '#121314', 0.6, 0.4),
];

// the default material of every slot; a copy overrides what it wants
const SLOTS = {
  skin: 'hullWhite', accent: 'hullOrange', dark: 'hullDark', metal: 'metal', deep: 'darkMetal', glass: 'glass', pane: 'pane',
  screen: 'screen', glow: 'orangeGlow', light: 'lightStrip', floor: 'floor', wall: 'wall', ceil: 'ceil', rim: 'darkMetal',
  fabric: 'fabric', bedding: 'bedding', wood: 'wood', hazard: 'hazard', tank: 'tank', black: 'black',
};

const HULL = octagon(9.0, 6.4, 1.7, 2.4); // the hull cross section: x +-4.5, y 2.4 .. 8.8
const INNER = inset(HULL, 0.25);
const DECK1 = 2.65, DECK2 = 5.68, CEIL = 8.55, H = 2.87; // floor of deck 1, floor of deck 2, ceiling, deck height

// ---------- prototypes ----------

// a hull section of unit length along z: stretch it with scale [1, 1, length]
const SECTION = hullSection({ poly: HULL, z0: -0.5, z1: 0.5 });

// the nose: the section tapers to a smaller octagon, the upper facets are glass, the front is glass too
const BOW_END = octagon(6.2, 3.9, 1.2, 3.5);
const BOW = (() => {
  const m = hullSection({ poly: HULL, z0: -0.5, z1: 0.5, end: BOW_END, skinSlots: [, , 'glass', 'glass', , 'glass', 'glass'] });
  face(m, BOW_END.map(([x, y]) => [x, y, -0.5]), 'glass', [0, 6, 0]);
  return m;
})();

// a round module of radius 4.4 (a 20-gon ring)
const RING = hullSection({ poly: Array.from({ length: 20 }, (_, i) => [4.4 * Math.cos((i / 20) * Math.PI * 2), 5.6 + 4.4 * Math.sin((i / 20) * Math.PI * 2)]), z0: -0.5, z1: 0.5, lining: () => 'wall' });

// a landing leg, hip at the origin, foot 3.1 m below, reaching outwards (+x); mirror it with scale x = -1
const LEG = (() => {
  const m = box(1.3, 1.1, 2.0, 'dark');
  merge(m, strut([0.3, -0.2], [1.15, -1.75], 0.85, 1.3, 'skin'));
  merge(m, strut([0.05, -0.55], [0.85, -2.3], 0.16, 0.3, 'metal'));
  merge(m, strut([1.15, -1.75], [1.4, -2.95], 0.62, 1.1, 'dark'));
  merge(m, place(box(3.0, 0.24, 3.2, 'dark', { top: 'dark' }), { at: [1.5, -2.98, 0] }));
  merge(m, place(box(1.4, 0.05, 0.12, 'light'), { at: [1.4, -2.88, 1.28] }));
  merge(m, place(box(0.35, 0.3, 0.5, 'accent'), { at: [1.2, -1.2, 0.5] }));
  return m;
})();

const WINDOW = (() => {
  const m = box(0.14, 1.15, 2.1, 'dark');
  merge(m, place(box(0.2, 0.95, 1.9, 'pane'), { at: [0.03, 0, 0] }));
  merge(m, place(box(0.2, 0.95, 0.07, 'dark'), { at: [0.04, 0, 0] }));
  return m;
})();

// an engine pod along z: nose cone, body, bell and glowing nozzle
const POD = (() => {
  const m = cylinder(0.8, 1.7, -4, -2.7, 18, 'skin');
  merge(m, cylinder(1.7, 1.7, -2.7, 3.2, 18, 'dark'));
  merge(m, cylinder(1.74, 1.74, -1.9, -1.4, 18, 'accent'));
  merge(m, cylinder(1.74, 1.74, 1.4, 1.9, 18, 'accent'));
  merge(m, cylinder(1.7, 1.2, 3.2, 4.2, 18, 'deep'));
  merge(m, cylinder(1.05, 1.05, 4.2, 4.27, 18, 'glow'));
  return m;
})();

// a front thruster pod: a short cylinder with a dark intake
const THRUSTER = (() => {
  const m = cylinder(1.0, 1.0, -2.2, 2.2, 14, 'dark');
  merge(m, cylinder(1.06, 1.06, -2.2, -1.9, 14, 'accent'));
  merge(m, cylinder(0.7, 0.7, -2.28, -2.2, 14, 'black'));
  return m;
})();

const TANK = (() => {
  const m = capsule(1.25, -4.2, 4.2, 14, 3, 'tank');
  for (const z of [-2.2, 2.2]) merge(m, cylinder(1.3, 1.3, z - 0.18, z + 0.18, 14, 'accent'));
  return m;
})();

const CONSOLE = (() => {
  const m = box(1.8, 0.85, 0.75, 'dark', { top: 'metal' });
  merge(m, place(box(1.6, 0.05, 0.55, 'screen'), { at: [0, 0.65, 0.12], rot: [-0.7, 0, 0] }));
  return place(m, { at: [0, 0.425, 0] });
})();

const CHAIR = (() => {
  const m = place(box(0.5, 0.08, 0.5, 'fabric'), { at: [0, 0.48, 0] });
  merge(m, place(box(0.5, 0.6, 0.08, 'fabric'), { at: [0, 0.8, 0.25] }));
  merge(m, place(box(0.08, 0.46, 0.08, 'metal'), { at: [0, 0.23, 0] }));
  return m;
})();

const TABLE = (() => {
  const m = place(box(2.6, 0.07, 1.0, 'wood'), { at: [0, 0.8, 0] });
  for (const x of [-1.1, 1.1]) merge(m, place(box(0.1, 0.77, 0.7, 'metal'), { at: [x, 0.385, 0] }));
  return m;
})();

const BUNK = (() => {
  const m = mesh();
  for (const y of [0.45, 1.35]) {
    merge(m, place(box(0.95, 0.1, 1.95, 'metal'), { at: [0, y, 0] }));
    merge(m, place(box(0.85, 0.16, 1.8, 'bedding'), { at: [0, y + 0.13, 0.03] }));
  }
  for (const [x, z] of [[-0.46, -0.96], [0.46, -0.96], [-0.46, 0.96], [0.46, 0.96]]) merge(m, place(box(0.06, 1.8, 0.06, 'metal'), { at: [x, 0.9, z] }));
  merge(m, place(box(0.95, 0.5, 0.06, 'dark'), { at: [0, 0.35, 0.99] }));
  return m;
})();

const VENT = (() => {
  const m = box(1.0, 0.18, 0.9, 'dark');
  for (let i = -2; i <= 2; i++) merge(m, place(box(0.9, 0.05, 0.05, 'deep'), { at: [0, 0.11, i * 0.17] }));
  return place(m, { at: [0, 0.09, 0] });
})();

const STAIRS = (() => {
  const n = 16, rise = (DECK2 - DECK1) / n, run = 0.26;
  const m = mesh();
  for (let i = 0; i < n; i++) merge(m, place(box(1.3, rise * (i + 1), run, 'metal', { top: 'floor' }), { at: [0, (rise * (i + 1)) / 2, i * run] }));
  return m;
})();

const LIGHT = box(0.3, 0.05, 1.3, 'light');

// a lander: a small octagonal body, glass nose, three of the same legs scaled down
const LANDER = (() => {
  const m = prism(octagon(2.6, 1.5, 0.5, 0.9), -1.7, 1.2, 'skin');
  merge(m, prism(octagon(2.0, 1.1, 0.4, 1.05), -2.1, -1.7, 'glass'));
  merge(m, place(box(2.62, 0.2, 1.0, 'accent'), { at: [0, 1.65, 0.2] }));
  for (const [x, z, s] of [[1.3, -0.9, 1], [1.3, 0.8, 1], [-1.3, -0.9, -1], [-1.3, 0.8, -1]]) merge(m, place(LEG, { at: [x, 1.0, z], scale: [0.3 * s, 0.3, 0.3] }));
  merge(m, place(cylinder(0.4, 0.5, 1.2, 1.7, 10, 'deep'), { at: [0.7, 1.2, 0] }));
  merge(m, place(cylinder(0.4, 0.5, 1.2, 1.7, 10, 'deep'), { at: [-0.7, 1.2, 0] }));
  merge(m, place(cylinder(0.3, 0.3, 1.7, 1.75, 10, 'glow'), { at: [0.7, 1.2, 0] }));
  merge(m, place(cylinder(0.3, 0.3, 1.7, 1.75, 10, 'glow'), { at: [-0.7, 1.2, 0] }));
  return m;
})();

// a bulkhead with a door on each deck, cut from the inner outline: left and right of the door, over it, between the decks
const BULKHEAD = (() => {
  const dw = 0.7, d1 = DECK1 + 2.1, d2 = DECK2 + 2.1;
  const m = mesh();
  const add = (poly) => poly.length >= 3 && merge(m, prism(poly, -0.06, 0.06, 'wall'));
  const centre = clip(clip(INNER, 0, dw, false), 0, -dw, true);
  add(clip(INNER, 0, -dw, false));
  add(clip(INNER, 0, dw, true));
  add(clip(clip(centre, 1, d1, true), 1, DECK2 - 0.02, false));
  add(clip(centre, 1, d2, true));
  return m;
})();

// ---------- assembly ----------

export const ex27 = () => {
  const M = model(PALETTE, { panels: ['hullWhite', 'hullOrange', 'hullDark'], rust: 'rust', rustAmount: 0.07 });
  const put = (group, proto, o = {}) => M.add(group, proto, { ...o, mats: { ...SLOTS, ...o.mats } });
  const both = (group, proto, o = {}) => {
    put(group, proto, o);
    put(group, proto, { ...o, at: [-o.at[0], o.at[1], o.at[2]], scale: [-(o.scale?.[0] ?? 1), o.scale?.[1] ?? 1, o.scale?.[2] ?? 1], rot: o.rot ? [o.rot[0], -o.rot[1], -o.rot[2]] : undefined });
  };
  const z = (z0, z1) => ({ at: [0, 0, (z0 + z1) / 2], scale: [1, 1, z1 - z0] });

  // hull: the same section stretched per module, a different skin on one of them
  put('hull', BOW, z(-21.4, -13));
  put('hull', SECTION, z(-13, -4));
  put('hull', SECTION, { ...z(-4, 4), mats: { skin: 'hullWhite' } });
  put('hull', RING, z(4, 9.5));
  put('hull', SECTION, z(9.5, 15));
  put('hull', SECTION, z(15, 21.4));
  put('hull', prism(HULL, 0, 0.06, 'dark'), { at: [0, 0, 21.4] }); // the hangar door at the tail
  // rings round the drum
  const BAND = hullSection({ poly: Array.from({ length: 20 }, (_, i) => [4.52 * Math.cos((i / 20) * Math.PI * 2), 5.6 + 4.52 * Math.sin((i / 20) * Math.PI * 2)]), z0: -0.5, z1: 0.5, t: 0.12, lining: () => 'wall' });
  for (const zz of [4.35, 9.15]) put('hull', BAND, { at: [0, 0, zz], scale: [1, 1, 0.36] }); // hollow rings: the corridor stays open
  put('hull', BAND, { at: [0, 0, 6.75], scale: [1, 1, 0.5], mats: { skin: 'hullDark' } });
  // the dorsal module
  const DORSAL = octagon(6.4, 2.5, 0.9, 8.7);
  put('hull', hullSection({ poly: DORSAL, z0: -0.5, z1: 0.5, lining: () => 'wall' }), z(-1.5, 12));
  put('hull', prism(DORSAL, 0, 0.08, 'skin'), { at: [0, 0, -1.5] });
  put('hull', prism(DORSAL, 0, 0.08, 'skin'), { at: [0, 0, 11.92] });
  // diagonal orange stripes (one plate, mirrored) and the hull number
  const STRIPE = prism([[0, 4.1], [1.2, 4.1], [2.6, 7.1], [1.4, 7.1]].map(([a, b]) => [a - 1.5, b]), 0, 0.04, 'accent');
  both('hull', STRIPE, { at: [4.52, 0, -7.5], rot: [0, Math.PI / 2, 0] });

  // landing gear: the one leg, three pairs
  for (const zz of [-14.5, -1, 13]) both('gear', LEG, { at: [4.2, 3.1, zz] });
  // front thrusters and the rear engines with their tanks
  both('engines', THRUSTER, { at: [5.5, 5.3, -13.5], scale: [1, 1, 1] });
  both('engines', box(1.2, 0.6, 2.0, 'dark'), { at: [4.9, 5.3, -13.5] });
  both('engines', POD, { at: [5.6, 6.2, 17.2] });
  both('engines', box(1.6, 1.0, 3.0, 'dark'), { at: [4.7, 6.0, 15.5] });
  both('engines', TANK, { at: [5.3, 3.5, 12.6] });
  both('engines', box(0.9, 0.5, 2.4, 'metal'), { at: [4.7, 4.1, 12.6] });

  // windows on the sides: the same one, mirrored
  const win = (zs, y, x = 4.5) => zs.forEach((zz) => both('glass', WINDOW, { at: [x, y, zz] }));
  win([-11, -6.6], 6.9);
  win([-2.2, 1.4], 6.9);
  win([11.8], 6.9);
  win([-10, -2], 4.2, 4.3 + 0.05);
  win([0.6, 3.4, 6.2, 9.0], 10.2, 3.2);

  // top: vents, pipes, the mast and the dish
  for (const [x, zz] of [[-2, -11.5], [-2, -10], [2, -11.5], [2, -10], [-2.5, -2.5], [2.5, -2.5], [-2.5, 13], [2.5, 13], [0, 17]]) put('details', VENT, { at: [x, 8.8, zz] });
  both('details', cylinder(0.16, 0.16, -1, 11, 8, 'metal'), { at: [3.45, 9.0, 0] });
  put('details', cylinder(0.07, 0.07, 0, 0.7, 6, 'metal'), { at: [0, 11.2, -0.6], rot: [-Math.PI / 2, 0, 0] });
  put('details', cylinder(0.02, 0.9, 0, 0.35, 14, 'skin'), { at: [0, 11.2, 8], rot: [-Math.PI / 2 - 0.5, 0, 0] });
  put('details', cylinder(0.05, 0.05, 0, 0.9, 6, 'metal'), { at: [0, 11.35, 8.2], rot: [-Math.PI / 2 - 0.5, 0, 0] });
  // a few crates and plates on the hull so large faces are not blank
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 26; i++) {
    const zz = -12 + rnd() * 32, x = (rnd() - 0.5) * 6.5;
    if (zz > 4 && zz < 9.5) continue;
    put('details', box(0.5 + rnd() * 0.9, 0.1 + rnd() * 0.22, 0.5 + rnd() * 1.2, rnd() > 0.35 ? 'skin' : 'dark'), { at: [x, 8.85, zz] });
  }
  // belly lights and the glowing bar under the nose
  put('lights', box(3.2, 0.08, 0.2, 'glow'), { at: [0, 3.3, -20.1] });
  for (const x of [-3.2, 3.2]) put('lights', box(0.5, 0.2, 0.3, 'light'), { at: [x, 2.6, -14] });

  // an upper cabin over the crew quarters, boxy side modules and armour plates
  const CABIN = octagon(7.0, 1.7, 0.6, 8.7);
  put('hull', hullSection({ poly: CABIN, z0: -0.5, z1: 0.5, lining: () => 'wall' }), { ...z(-12.5, -5.5), mats: { skin: 'hullDark' } });
  for (const zz of [-12.5, -5.5]) put('hull', prism(CABIN, 0, 0.08, 'dark'), { at: [0, 0, zz - (zz < -9 ? 0 : 0.08)] });
  both('hull', box(1.6, 2.1, 7, 'skin', { top: 'accent' }), { at: [5.25, 6.3, 6.7] });
  both('hull', box(1.3, 2.4, 4.2, 'dark', { top: 'dark' }), { at: [5.1, 6.0, -4.2] });
  for (const [zz, len] of [[-9, 3.2], [-0.5, 3.6], [6.5, 3.6], [11.5, 3]]) both('hull', box(0.14, 2.2, len, 'accent'), { at: [4.56, 4.7, zz] });
  for (const [zz, len] of [[-12, 1.6], [-6, 2], [2, 1.8], [13.5, 2.2]]) both('hull', box(0.12, 1.3, len, 'dark'), { at: [4.55, 5.9, zz] });

  // ---- interior ----
  // deck 2 floor with the stair well, bow floor
  put('interior', box(7.0, 0.16, 33, 'floor'), { at: [-0.7, DECK2 - 0.08, 3.5] });
  put('interior', box(1.4, 0.16, 4.5, 'floor'), { at: [3.5, DECK2 - 0.08, -10.75] });
  put('interior', box(1.4, 0.16, 23.5, 'floor'), { at: [3.5, DECK2 - 0.08, 8.25] });
  put('interior', box(5.7, 0.16, 7.6, 'floor'), { at: [0, DECK2 - 0.08, -17.2] });
  put('interior', STAIRS, { at: [3.5, DECK1, -8.0] });
  // bulkheads between the modules (the drum is open)
  for (const zz of [-13, -4, 15]) put('interior', BULKHEAD, { at: [0, 0, zz] });
  // lights under and over the decks
  for (let zz = -11; zz <= 19; zz += 3.2) {
    put('lights', LIGHT, { at: [-1.2, DECK2 - 0.19, zz] });
    put('lights', LIGHT, { at: [-1.2, CEIL - 0.03, zz] });
  }
  put('lights', LIGHT, { at: [0, 7.3, -17.5], scale: [1, 1, 2] });
  // bridge: consoles along the glass, two chairs, a table behind
  for (const x of [-1.8, 0, 1.8]) put('furniture', CONSOLE, { at: [x, DECK2, -19.4] });
  for (const x of [-0.9, 0.9]) put('furniture', CHAIR, { at: [x, DECK2, -18.4], rot: [0, Math.PI, 0] });
  put('furniture', TABLE, { at: [0, DECK2, -16.2] });
  for (const x of [-0.8, 0.8]) put('furniture', CHAIR, { at: [x, DECK2, -15.4] });
  // operations: consoles along the left wall, deck 2
  for (const zz of [-11.2, -9.4, -7.6, -5.8]) put('furniture', CONSOLE, { at: [-3.55, DECK2, zz], rot: [0, Math.PI / 2, 0] });
  for (const zz of [-11.2, -9.4, -7.6, -5.8]) put('furniture', CHAIR, { at: [-2.7, DECK2, zz], rot: [0, -Math.PI / 2, 0] });
  // medbay / lab on deck 2, mess on deck 1
  for (const zz of [-2, 0.4, 2.8]) put('furniture', CONSOLE, { at: [-3.55, DECK2, zz], rot: [0, Math.PI / 2, 0] });
  for (const x of [-1.2, 1.2]) {
    put('furniture', TABLE, { at: [x, DECK1, 0], rot: [0, Math.PI / 2, 0] });
    for (const zz of [-0.9, 0, 0.9]) for (const side of [-0.85, 0.85]) put('furniture', CHAIR, { at: [x + side, DECK1, zz], rot: [0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0] });
  }
  // six bunks along the left wall of the crew quarters
  for (let i = 0; i < 6; i++) put('furniture', BUNK, { at: [-3.45, DECK1, -12.2 + i * 1.3 + 0.2], rot: [0, 0, 0], scale: [1, 1, 0.68] });
  // the hangar: hazard strips and two landers
  for (const x of [-3.4, 3.4]) put('interior', box(0.18, 0.02, 6, 'hazard'), { at: [x, DECK1 + 0.01, 18.2] });
  put('interior', box(8.0, 0.02, 0.18, 'hazard'), { at: [0, DECK1 + 0.01, 15.4] });
  for (const x of [-2.1, 2.1]) put('lander', LANDER, { at: [x, DECK1, 18.2], rot: [0, Math.PI, 0], mats: x > 0 ? { accent: 'hullOrange' } : { accent: 'hullOrange', skin: 'hullWhite' } });
  put('lights', box(6, 0.05, 0.3, 'light'), { at: [0, CEIL - 0.03, 18.2] });
  return M;
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const M = ex27();
  const { palette, objects } = M.scene();
  const faces = objects.reduce((n, o) => n + o.mesh.faces.length, 0);
  console.log(objects.map((o) => `${o.name}:${o.mesh.faces.length}`).join(' '), '|', faces, 'faces,', M.instances, 'instances');
  const all = objects.flatMap((o) => o.mesh.positions);
  const lo = [0, 1, 2].map((j) => Math.min(...all.map((p) => p[j]))), hi = [0, 1, 2].map((j) => Math.max(...all.map((p) => p[j])));
  console.log('size', hi.map((h, j) => +(h - lo[j]).toFixed(2)), 'min', lo.map((v) => +v.toFixed(2)));
  void validate;
  writeFileSync(new URL('./ex27.scene.json', import.meta.url), JSON.stringify({ format: '3draft-scene', version: 1, palette, objects }));
}
