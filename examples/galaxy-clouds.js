// Density-function models of galaxies, as point sets in a unit frame: radius 1, the disc in the x-z plane (normal = y).
// Every point stands for millions of stars; the viewer scales, turns and places one copy per galaxy (see `cloud` on a scene
// object). Four kinds, a few variants each, all sampled from a fixed seed so the files never change by themselves.
// Stored as integers: positions and radii in thousandths of the galaxy radius, colours as 0xRRGGBB, brightness in hundredths.

let seed = 8675309;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const expo = (s) => -s * Math.log(1 - rnd());
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => (c[0] << 16) | (c[1] << 8) | c[2];
const BLUE = [170, 195, 255], WHITE = [255, 240, 225], GOLD = [255, 205, 140], RED = [255, 170, 105], PINK = [255, 190, 215];

const build = (fill) => {
  const pts = [];
  fill((x, y, z, r, c, l = 1) => pts.push([x, y, z, r, c, l]));
  const out = { n: pts.length, unit: 0.001, p: [], r: [], c: [], l: [] };
  for (const [x, y, z, r, c, l] of pts) {
    out.p.push(Math.round(x * 1000), Math.round(y * 1000), Math.round(z * 1000));
    out.r.push(Math.round(r * 1000));
    out.c.push(c);
    out.l.push(Math.round(l * 100));
  }
  return out;
};

// spiral: bulge + exponential disc + logarithmic arms
const spiral = ({ arms, pitch, armShare, n = 1800 }) =>
  build((add) => {
    const tan = Math.tan((pitch * Math.PI) / 180);
    for (let i = 0; i < n * 0.16; i++) add(gauss() * 0.1, gauss() * 0.06, gauss() * 0.1, 0.04, hex(mix(GOLD, RED, rnd() * 0.5)), 1.4);
    for (let i = 0; i < n * 0.84; i++) {
      const r = 0.06 + expo(0.3);
      if (r > 1) { i--; continue; }
      const y = gauss() * 0.02;
      if (rnd() < armShare) {
        const k = Math.floor(rnd() * arms);
        const th = Math.log(r / 0.35) / tan + (k * 2 * Math.PI) / arms + (gauss() * (0.04 + 0.07 * r)) / r;
        add(r * Math.cos(th), y, r * Math.sin(th), 0.035, hex(rnd() < 0.55 ? mix(BLUE, WHITE, rnd() * 0.5) : mix(WHITE, GOLD, rnd() * 0.5)), 1.1);
      } else {
        const th = rnd() * 2 * Math.PI;
        add(r * Math.cos(th), y, r * Math.sin(th), 0.037, hex(mix(WHITE, GOLD, rnd() * 0.7)), 0.8);
      }
    }
  });
// elliptical: a Plummer-like ball with axis ratios b (y) and c (z)
const elliptical = ({ b, c, n = 1400 }) =>
  build((add) => {
    for (let i = 0; i < n; i++) {
      const u = rnd() ** (1 / 3);
      const s = 0.3 / Math.sqrt(Math.max(1e-6, Math.pow(Math.max(u, 1e-3), -2) - 1)); // the radius of a Plummer sphere (scale 0.3)
      if (s > 1) { i--; continue; }
      const v = [gauss(), gauss(), gauss()], l = Math.hypot(...v);
      add((v[0] / l) * s, ((v[1] / l) * s) * b, ((v[2] / l) * s) * c, 0.04, hex(mix(GOLD, RED, rnd() * 0.7)), 1);
    }
  });
// irregular: a handful of clumps and a diffuse part, blue and pink (star formation)
const irregular = ({ clumps, n = 700 }) =>
  build((add) => {
    const centres = Array.from({ length: clumps }, () => [gauss() * 0.3, gauss() * 0.08, gauss() * 0.3, 0.07 + rnd() * 0.12]);
    for (let i = 0; i < n; i++) {
      const [cx, cy, cz, s] = centres[Math.floor(rnd() * clumps)];
      const x = cx + gauss() * s, y = cy + gauss() * s * 0.5, z = cz + gauss() * s;
      if (Math.hypot(x, y, z) > 1) { i--; continue; }
      add(x, y, z, 0.05, hex(rnd() < 0.2 ? mix(PINK, WHITE, rnd()) : mix(BLUE, WHITE, rnd() * 0.6)), 1);
    }
  });
// dwarf spheroidal: a sparse, pale ball
const dwarf = ({ n = 350 }) =>
  build((add) => {
    for (let i = 0; i < n; i++) {
      const x = gauss() * 0.28, y = gauss() * 0.22, z = gauss() * 0.28;
      if (Math.hypot(x, y, z) > 1) { i--; continue; }
      add(x, y, z, 0.07, hex(mix(WHITE, GOLD, rnd())), 0.7);
    }
  });

export const CLOUD_PROTOS = {
  'spiral-a': spiral({ arms: 2, pitch: 17, armShare: 0.7 }),
  'spiral-b': spiral({ arms: 3, pitch: 24, armShare: 0.5 }),
  'ellip-a': elliptical({ b: 0.9, c: 0.95 }),
  'ellip-b': elliptical({ b: 0.55, c: 0.8 }),
  'irr-a': irregular({ clumps: 5 }),
  'irr-b': irregular({ clumps: 9 }),
  'dwarf-a': dwarf({}),
};
// which prototype a galaxy of this type uses (the variant follows the index)
export const cloudFor = (type, index) =>
  type === 'S' ? (index % 3 === 0 ? 'spiral-b' : 'spiral-a') : type === 'E' ? (index % 2 ? 'ellip-b' : 'ellip-a') : type === 'I' ? (index % 2 ? 'irr-b' : 'irr-a') : 'dwarf-a';
