// Command bridge: two crew at the helm before a curved control desk under a wide open window, and an empty low dais behind
// them where the player (the commander) stands, Space 1999 style: white desk segments, dark sloping instrument plates (buttons, knobs, sliders, small screens,
// a radar scope), a display bank on top. Nothing outside: in a game (examples/fifth-percent.game.json) the universe is drawn first and the
// bridge over it, so the window is an opening. The crew face -z, y is up, the floor is y = 0.
// `node examples/command-bridge.js` writes command-bridge.scene.json.

import { writeFileSync } from 'node:fs';
import { buildCharacter, normalizeCharacter, posed, merge as mergeMeshes, HUMANOID_POSES, CHARACTER_PRESETS, CHARACTER_VERSION, characterPalette } from '../dist/index.js';
import { box, capsule, cylinder, face, mesh, model, place } from './kit.js';

const mat = (name, color, rough = 0.6, metal = 0.2, extra = {}) => ({ name, color, rough, metal, alpha: 1, emit: 0, soft: 0, ...extra });
const glow = (name, color) => mat(name, color, 0.4, 0, { emit: 1 });
export const PALETTE = [
  mat('deskWhite', '#d9d3c5', 0.55, 0.15), mat('deskTrim', '#d9741a', 0.5, 0.3), mat('faceplate', '#2b2e33', 0.45, 0.55),
  mat('knob', '#141517', 0.5, 0.6), mat('chrome', '#9aa0a6', 0.25, 0.9),
  glow('scrBlue', '#4ab0ff'), glow('scrGreen', '#5cf08e'), glow('scrAmber', '#ffb347'),
  glow('btnRed', '#ff4d3d'), glow('btnGreen', '#49e06a'), glow('btnAmber', '#ffc23d'), glow('btnBlue', '#3da2ff'), glow('btnWhite', '#f2eee0'),
  mat('deck', '#3a3d42', 0.6, 0.5), mat('deckLine', '#d9741a', 0.5, 0.3), mat('wallPanel', '#cfcabd', 0.7, 0.15), mat('wallDark', '#5d6166', 0.6, 0.4),
  mat('ceiling', '#bdb9b0', 0.8, 0.1), mat('ceilLight', '#fff3df', 0.4, 0, { emit: 0.35 }), mat('frame', '#25282c', 0.5, 0.7),
  mat('seat', '#b9502a', 0.9, 0), mat('chairMetal', '#70767d', 0.4, 0.85),
  ];

// a seeded random, so the desk comes out the same every time
let seed = 1999;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const choose = (list) => list[Math.floor(rand() * list.length)];

// ---------- the desk ----------
// The desk is an arc of segments round O (the commander's spot); a segment's local +z points at O (the crew side), its front
// face is at local z = 0, it runs back to z = -DEPTH. Each segment widens with the distance from O, so the arc closes.
const O = [0, 0, 1.1], R = 2.15, STEP = (20 * Math.PI) / 180, DEPTH = 0.72;
const PROFILE = [[0, 0], [0, 0.72], [-0.5, 0.92], [-DEPTH, 0.92], [-DEPTH, 0]]; // (z, y), round the side
const EDGE_MATS = ['deskWhite', 'faceplate', 'deskWhite', 'deskWhite', 'deskWhite']; // front, slope, top, back, bottom
const SLOPE = { y0: 0.72, len: Math.hypot(0.5, 0.2), th: Math.atan2(0.2, 0.5) };

const segmentBody = () => {
  const m = mesh();
  const hw = (z) => (R - z) * Math.tan(STEP / 2);
  const L = PROFILE.map(([z, y]) => [-hw(z), y, z]), Rr = PROFILE.map(([z, y]) => [hw(z), y, z]);
  const mid = [0, 0.45, -DEPTH / 2];
  face(m, L, 'deskTrim', mid);
  face(m, Rr, 'deskTrim', mid);
  for (let i = 0; i < PROFILE.length; i++) {
    const j = (i + 1) % PROFILE.length;
    face(m, [L[i], L[j], Rr[j], Rr[i]], EDGE_MATS[i], mid);
  }
  return m;
};

// an item lying on the slope: s along it from the front edge, x across, lifted by half its height
const onSlope = (proto, x, s, lift) => place(proto, {
  rot: [SLOPE.th, 0, 0],
  at: [x, SLOPE.y0 + s * Math.sin(SLOPE.th) + lift * Math.cos(SLOPE.th), -s * Math.cos(SLOPE.th) + lift * Math.sin(SLOPE.th)],
});
const BUTTONS = ['btnRed', 'btnGreen', 'btnAmber', 'btnBlue', 'btnWhite'];
const SCREENS = ['scrBlue', 'scrGreen', 'scrAmber'];

// the instruments of one segment, in its local frame
const instruments = (kind, halfWidth) => {
  const parts = [];
  const hw = halfWidth - 0.06;
  if (kind === 'radar') {
    parts.push(onSlope(place(cylinder(0.17, 0.17, 0, 0.02, 32, 'chrome'), { rot: [Math.PI / 2, 0, 0] }), 0, 0.27, 0.0));
    parts.push(onSlope(place(cylinder(0.15, 0.15, 0, 0.012, 32, 'scrGreen'), { rot: [Math.PI / 2, 0, 0] }), 0, 0.27, 0.015));
    for (const x of [-0.27, 0.27]) for (let r = 0; r < 4; r++) parts.push(onSlope(box(0.04, 0.02, 0.03, choose(BUTTONS)), x, 0.12 + r * 0.09, 0.01));
  } else {
    // a small screen, rows of buttons, a row of knobs, two sliders
    const sx = (rand() - 0.5) * hw;
    parts.push(onSlope(box(0.2, 0.012, 0.13, 'frame'), sx, 0.38, 0.006));
    parts.push(onSlope(box(0.17, 0.012, 0.1, choose(SCREENS)), sx, 0.38, 0.012));
    const cols = Math.max(4, Math.floor((hw * 2) / 0.06));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < 0.22) continue;
        parts.push(onSlope(box(0.035, 0.016, 0.03, rand() < 0.55 ? choose(BUTTONS) : 'knob'), -hw + 0.03 + c * ((hw * 2 - 0.06) / (cols - 1)), 0.07 + r * 0.06, 0.008));
      }
    }
    for (let c = 0; c < 4; c++) parts.push(onSlope(place(cylinder(0.018, 0.015, 0, 0.03, 10, 'knob'), { rot: [-Math.PI / 2, 0, 0] }), -hw + 0.08 + c * 0.08, 0.27, 0));
    for (const x of [hw - 0.12, hw - 0.04]) {
      parts.push(onSlope(box(0.012, 0.006, 0.16, 'knob'), x, 0.28, 0.003));
      parts.push(onSlope(box(0.03, 0.02, 0.02, 'chrome'), x, 0.22 + rand() * 0.12, 0.01));
    }
  }
  // the display bank on top: a housing leaning back a little, with its screen
  const bank = (w, h, scr) => {
    const out = [box(w, h, 0.1, 'deskWhite'), place(box(w - 0.06, h - 0.06, 0.012, scr), { at: [0, 0, 0.051] })];
    return out.map((p) => place(p, { rot: [-0.18, 0, 0], at: [0, 0.92 + h / 2, -0.62] }));
  };
  parts.push(...bank(halfWidth * 1.7, kind === 'radar' ? 0.42 : 0.34, kind === 'radar' ? 'scrGreen' : choose(SCREENS)));
  return parts;
};

// ---------- the room ----------
const chair = () => {
  const parts = [
    place(cylinder(0.24, 0.24, 0, 0.03, 18, 'chairMetal'), { rot: [-Math.PI / 2, 0, 0] }), // the foot (a disc on the floor)
    place(cylinder(0.04, 0.04, 0, 0.36, 10, 'chairMetal'), { rot: [-Math.PI / 2, 0, 0] }), // the column
    place(box(0.5, 0.08, 0.46, 'seat'), { at: [0, 0.4, 0.02] }), // the seat (top at 0.44)
    place(box(0.48, 0.55, 0.08, 'seat'), { at: [0, 0.74, 0.29], rot: [-0.12, 0, 0] }), // the back (behind: +z)
  ];
  return parts;
};

export const commandBridge = () => {
  const M = model(PALETTE);
  const put = (group, proto, opts) => M.add(group, proto, opts);

  // the desk segments
  const angles = [-3, -2, -1, 0, 1, 2, 3].map((k) => k * STEP);
  for (const a of angles) {
    const at = [O[0] + R * Math.sin(a), 0, O[2] - R * Math.cos(a)];
    const ry = -a;
    put('desk', segmentBody(), { at, rot: [0, ry, 0] });
    const kind = a === 0 ? 'radar' : 'panel';
    for (const p of instruments(kind, R * Math.tan(STEP / 2))) put('instruments', p, { at, rot: [0, ry, 0] });
  }

  // the floor, the dais and the deck lines
  put('room', box(10, 0.1, 9, 'deck'), { at: [0, -0.05, 0.4] });
  put('room', box(2.4, 0.2, 1.5, 'deck', { top: 'deck' }), { at: [0, 0.1, 1.45] });
  put('room', box(2.4, 0.02, 0.06, 'deckLine'), { at: [0, 0.21, 0.72] });
  for (const x of [-4.2, 4.2]) put('room', box(0.08, 0.01, 7.5, 'deckLine'), { at: [x, 0.005, 0.4] });
  // the walls: the window wall in front (sill, header, struts and glass), the sides and the back
  const FZ = -2.85;
  put('room', box(10, 0.85, 0.3, 'wallPanel'), { at: [0, 0.425, FZ] });
  put('room', box(10, 0.5, 0.3, 'wallPanel'), { at: [0, 2.95, FZ] });
  for (let i = 0; i <= 6; i++) put('window', box(0.16, 1.9, 0.26, 'frame'), { at: [-4.5 + i * 1.5, 1.8, FZ] });
  for (const x of [-5, 5]) put('room', box(0.3, 3.2, 9, 'wallPanel'), { at: [x, 1.6, 0.4] });
  put('room', box(10, 3.2, 0.3, 'wallPanel'), { at: [0, 1.6, 4.9] });
  for (const x of [-4.84, 4.84]) for (let k = 0; k < 4; k++) put('room', box(0.02, 1.4, 1.6, 'wallDark'), { at: [x, 1.6, -1.6 + k * 2.1] });
  // the ceiling and its light panels
  put('room', box(10, 0.12, 9, 'ceiling'), { at: [0, 3.26, 0.4] });
  for (const x of [-2.6, 0, 2.6]) for (const z of [-1.4, 1.2, 3.6]) put('lights', box(1.6, 0.03, 0.9, 'ceilLight'), { at: [x, 3.19, z] });
  // the chairs of the two at the helm
  const helm = [[-0.85, 0, -0.15], [0.85, 0, -0.15]];
  for (const [x, , z] of helm) {
    const ry = Math.atan2(x - O[0], z - O[2]) + Math.PI; // the back towards O
    for (const p of chair()) put('chairs', p, { at: [x, 0, z], rot: [0, ry, 0] });
  }


  const { palette, objects } = M.scene();
  return { palette, objects, helm };
};

// ---------- the crew ----------
const CHAR_FORMAT = '3draft-character';
const crewSpec = (over) => normalizeCharacter({ ...CHARACTER_PRESETS.crew, ...over, outfit: { ...CHARACTER_PRESETS.crew.outfit, helmet: false, ...over.outfit } });
const yawTurn = (p, yaw) => [p[0] * Math.cos(yaw) + p[2] * Math.sin(yaw), p[1], -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw)];
const charObject = (name, spec, pose, at, yaw) => {
  const c = buildCharacter(spec);
  const local = mergeMeshes(...posed(c.parts.map((p) => p.mesh), c.rig, pose === 'sit' ? HUMANOID_POSES.sit : (HUMANOID_POSES.bind ?? {}), { ground: true }));
  // sitting: the seat carries the figure, so its lowest point under the hips sits on the seat top (0.44)
  const lift = pose === 'sit' ? 0.44 - Math.min(...local.positions.filter((q) => q[2] < 0.08 && q[2] > -0.2 && q[1] > 0.2).map((q) => q[1])) : 0;
  const foot = [at[0], at[1] + lift, at[2]];
  const meshOut = { ...local, positions: local.positions.map((p) => yawTurn(p, yaw).map((v, i) => +(v + foot[i]).toFixed(5))) };
  return { name, mesh: meshOut, character: { format: CHAR_FORMAT, version: CHARACTER_VERSION, spec: c.spec, pose, frame: { at: foot.map((v) => +v.toFixed(5)), yaw: +yaw.toFixed(5), scale: 1 }, parts: c.parts.map((p) => p.id) } };
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { palette, objects, helm } = commandBridge();
  const face0 = (x, z) => Math.atan2(x - O[0], z - O[2]); // looking away from O, towards the desk
  const crew = [
    charObject('pilot', crewSpec({ base: 'female', seed: 41, face: { shape: 'oval', skin: 'skin-1' }, hair: { style: 'long', mat: 'hair-chestnut' }, outfit: { main: 'crew-beige', second: 'teal' }, prop: 'none' }), 'sit', helm[0], face0(helm[0][0], helm[0][2])),
    charObject('navigator', crewSpec({ base: 'male', seed: 43, body: { height: 1.76 }, face: { shape: 'square', skin: 'skin-4' }, hair: { style: 'short', mat: 'hair-black' }, outfit: { main: 'crew-beige', second: 'mustard' }, prop: 'none' }), 'sit', helm[1], face0(helm[1][0], helm[1][2])),
    // (no commander: that is the player)
    // charObject('commander', crewSpec({ base: 'male', seed: 47, body: { height: 1.82, shoulders: 0.2 }, face: { shape: 'long', jaw: 0.2, skin: 'skin-2' }, hair: { style: 'short', mat: 'hair-grey' }, outfit: { main: 'crew-beige', second: 'rust' }, prop: 'commlock' }), 'stand', [0, 0.2, 1.45], Math.PI),
  ];
  const charPal = characterPalette().filter((m) => !palette.some((p) => p.name === m.name));
  const used = new Set(crew.flatMap((o) => o.mesh.faces.map((f) => f.mat)));
  const scene = {
    format: '3draft-scene', version: 1,
    palette: [...palette, ...charPal.filter((m) => used.has(m.name))],
    objects: [...objects, ...crew],
    view: { render: 'webgpu', light: true, studio: true, smooth: true, edges: false, glow: false },
    start: { eye: [0, 1.9, 1.45], yaw: 0, pitch: 4 }, // the commander's place on the dais, over the desk to the window
  };
  const faces = scene.objects.reduce((n, o) => n + o.mesh.faces.length, 0);
  console.log(scene.objects.map((o) => `${o.name}:${o.mesh.faces.length}`).join(' '), '|', faces, 'faces');
  writeFileSync(new URL('./command-bridge.scene.json', import.meta.url), JSON.stringify(scene));
}
