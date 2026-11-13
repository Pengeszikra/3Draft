// The Milky Way: ~30 000 "super-stars" sampled from a density model (each stands for millions of real stars), drawn by the
// viewer as one GPU point layer (`cloud`), plus the real nearest stars as objects, Sagittarius A* and the nearest big galaxies.
// Components: nucleus, bulge, bar, thin disc with four logarithmic spiral arms, thick disc, halo, globular clusters.
// Lengths are light years, the frame is the one of the other star scenes (Sun at the origin, equatorial x y z -> [x, z, -y]).
import { writeFileSync } from 'node:fs';
import { stars, PLAIN, GALAXY_PROTOS, GALAXY_PALETTE, galaxies, blackHole } from './stars.js';
import { CLOUD_PROTOS } from './galaxy-clouds.js';

const R0 = 26670; // Sun - galactic centre, ly
const rad = (d) => (d * Math.PI) / 180;
const unit = (ra, dec) => [Math.cos(rad(dec)) * Math.cos(rad(ra)), Math.cos(rad(dec)) * Math.sin(rad(ra)), Math.sin(rad(dec))];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const GC = unit(266.405, -28.936); // direction of the galactic centre (equatorial)
const e3 = unit(192.8595, 27.1283); // north galactic pole
const e1 = norm(GC.map((v, i) => -v - dot([-GC[0], -GC[1], -GC[2]], e3) * e3[i])); // from the centre towards the Sun
const e2 = cross(e3, e1); // counter-clockwise seen from the north pole
const CENTRE = [0, 1, 2].map((i) => -(R0 * e1[i] + 20 * e3[i])); // the Sun floats 20 ly above the plane
// galactic frame (centre, in-plane x towards the Sun, y, z north) -> scene coordinates
export const toScene = (x, y, z) => {
  const q = [0, 1, 2].map((i) => CENTRE[i] + x * e1[i] + y * e2[i] + z * e3[i]);
  return [q[0], q[2], -q[1]];
};

let seed = 20261109;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const expo = (scale) => -scale * Math.log(1 - rnd());
const mixc = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => (c[0] << 16) | (c[1] << 8) | c[2];
const BLUE = [175, 200, 255], WHITE = [255, 240, 225], GOLD = [255, 205, 140], RED = [255, 175, 110];

const pts = []; // [x, y, z (galactic frame), radius, colour, brightness]
const add = (x, y, z, r, c, l = 1) => pts.push([x, y, z, r, c, l]);

// nucleus and bulge: a flattened gaussian ball
for (let i = 0; i < 400; i++) add(gauss() * 160, gauss() * 160, gauss() * 120, 45, hex(mixc(GOLD, WHITE, rnd() * 0.5)), 2.2);
for (let i = 0; i < 3600; i++) add(gauss() * 1500, gauss() * 1500, gauss() * 1000, 140, hex(mixc(GOLD, RED, rnd() * 0.6)), 1);
// the bar: 27 degrees off the Sun - centre line, about 14 000 ly long
{
  const a = rad(27), c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < 2400; i++) {
    const u = gauss() * 3400, v = gauss() * 1100;
    add(u * c - v * s, u * s + v * c, gauss() * 500, 130, hex(mixc(GOLD, WHITE, rnd() * 0.5)), 1.1);
  }
}
// thin disc: exponential in radius (scale 8500 ly), 300 ly thick; 60 % of it in four spiral arms (pitch ~13.7 degrees)
const TAN = Math.tan(rad(13.7));
const arm = (k, r) => Math.log(r / 33000) / TAN + (k * Math.PI) / 2; // the angle of arm k at radius r (counter-clockwise outwards = trailing)
for (let i = 0; i < 20000; i++) {
  const r = 4500 + expo(8500);
  if (r > 52000) { i--; continue; }
  const z = gauss() * 260;
  if (rnd() < 0.6) {
    const th = arm(Math.floor(rnd() * 4), r) + (gauss() * (1000 + 0.07 * r)) / r; // arms 2000-5000 ly wide, fuzzier outwards
    add(r * Math.cos(th), r * Math.sin(th), z, 125, hex(rnd() < 0.55 ? mixc(BLUE, WHITE, rnd() * 0.5) : mixc(WHITE, GOLD, rnd() * 0.5)), 1.15);
  } else {
    const th = rnd() * 2 * Math.PI;
    add(r * Math.cos(th), r * Math.sin(th), z, 130, hex(mixc(WHITE, GOLD, rnd() * 0.7)), 0.8);
  }
}
// thick disc: older, redder, 1000 ly thick, wider scale
for (let i = 0; i < 2400; i++) {
  const r = 3000 + expo(11000), th = rnd() * 2 * Math.PI;
  if (r > 55000) { i--; continue; }
  add(r * Math.cos(th), r * Math.sin(th), gauss() * 1000, 190, hex(mixc(GOLD, RED, rnd() * 0.7)), 0.55);
}
// halo: sparse old stars, density ~ r^-3.5 between 3000 and 60 000 ly
for (let i = 0; i < 700; i++) {
  const r = 3000 * Math.pow(1 - rnd() * (1 - Math.pow(3000 / 60000, 2.5)), -1 / 2.5);
  const u = 2 * rnd() - 1, ph = rnd() * 2 * Math.PI, s = Math.sqrt(1 - u * u);
  add(r * s * Math.cos(ph), r * s * Math.sin(ph), r * u, 260, hex(mixc(GOLD, RED, rnd())), 0.4);
}
// globular clusters (about 150 are known): bright dots around the halo
for (let i = 0; i < 150; i++) {
  const r = 2500 + expo(14000), u = 2 * rnd() - 1, ph = rnd() * 2 * Math.PI, s = Math.sqrt(1 - u * u);
  add(r * s * Math.cos(ph), r * s * Math.sin(ph), r * u, 90, hex(mixc(GOLD, WHITE, rnd())), 2.5);
}

export const UNIT = 10; // positions are stored in units of 10 ly
export const cloud = { unit: UNIT, n: pts.length, p: [], r: [], c: [], l: [] };
for (const [x, y, z, r, c, l] of pts) {
  cloud.p.push(...toScene(x, y, z).map((v) => Math.round(v / UNIT)));
  cloud.r.push(r);
  cloud.c.push(c);
  cloud.l.push(Math.round(l * 100));
}

// the real neighbourhood (300 nearest stars + the Sun), the black hole in the centre, and the big neighbours
const near = stars({ plain: true, extras: false });
const sc = toScene(0, 0, 0);
const keep = new Set(['LMC', 'SMC', 'Andromeda (M31)', 'Triangulum (M33)']);
const others = galaxies().filter((g) => keep.has(g.name));
export const centre = toScene(0, 0, 0);
const sun = [0, 0, 0];
void sc; void sun;
const objects = [...near.objects, blackHole(centre.map((v) => Math.round(v * 1e4) / 1e4)), ...others];
// the eye starts above the disc, about 150 000 ly out, looking at the centre of the galaxy
const dirUp = [0, 1, 2].map((i) => 0.8 * e3[i] + 0.35 * e1[i] + 0.2 * e2[i]);
const up = norm(dirUp);
const eyeEq = [0, 1, 2].map((i) => CENTRE[i] + 150000 * up[i]);
const eye = [eyeEq[0], eyeEq[2], -eyeEq[1]];
const d = [centre[0] - eye[0], centre[1] - eye[1], centre[2] - eye[2]];
const L = Math.hypot(...d);
export const start = { eye: eye.map(Math.round), yaw: Math.round((Math.atan2(d[0], -d[2]) * 18000) / Math.PI) / 100, pitch: Math.round((-Math.asin(d[1] / L) * 18000) / Math.PI) / 100 };

const scene = {
  format: '3draft-scene', version: 2,
  palette: [...near.palette, ...GALAXY_PALETTE], prototypes: { ...PLAIN, ...GALAXY_PROTOS }, start, cloud, cloudProtos: CLOUD_PROTOS, objects,
};
if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  writeFileSync(new URL('./milkyway.scene.json', import.meta.url), JSON.stringify(scene));
  console.log(cloud.n, 'super-stars,', objects.length, 'objects, start', JSON.stringify(start));
}
