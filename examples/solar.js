// The Solar System at its true scale, in the deep sky's frame: 1 unit = 1 light year, the Sun at the origin, equatorial z up
// (scene [x, z, -y]). The planets (and Pluto, the Moon) stand where they are on a given date, from the JPL approximate
// Keplerian elements (E. M. Standish, "Keplerian Elements for Approximate Positions of the Major Planets", valid 1800-2050;
// the Moon: a mean circular orbit tilted 5.1° with its regressing node), with their real radii (Saturn with its rings, tilted
// with its pole). Every orbit is also a path: a closed polyline the viewer draws as a thin line (the sky group's orbits switch).

const AU = 1.58125074e-5; // light years
const KM = 1 / 9.4607304725808e12; // light years
const D = Math.PI / 180;
const EPS = 23.43928 * D; // the obliquity of the ecliptic (J2000)

// [name, a (AU), e, I, L, long. of perihelion, long. of node (degrees) and their rates per Julian century; radius km; colour; glow colour]
const PLANETS = [
  ['Mercury', [0.38709927, 0.00000037], [0.20563593, 0.00001906], [7.00497902, -0.00594749], [252.2503235, 149472.67411175], [77.45779628, 0.16047689], [48.33076593, -0.12534081], 2439.7, '#9c9690', '#cfc8c0'],
  ['Venus', [0.72333566, 0.0000039], [0.00677672, -0.00004107], [3.39467605, -0.0007889], [181.9790995, 58517.81538729], [131.60246718, 0.00268329], [76.67984255, -0.27769418], 6051.8, '#e8d3a2', '#fff1c8'],
  ['Earth', [1.00000261, 0.00000562], [0.01671123, -0.00004392], [-0.00001531, -0.01294668], [100.46457166, 35999.37244981], [102.93768193, 0.32327364], [0, 0], 6371.0, '#3d6fb6', '#a9cbff'],
  ['Mars', [1.52371034, 0.00001847], [0.0933941, 0.00007882], [1.84969142, -0.00813131], [-4.55343205, 19140.30268499], [-23.94362959, 0.44441088], [49.55953891, -0.29257343], 3389.5, '#c1440e', '#ff9a6e'],
  ['Jupiter', [5.202887, -0.00011607], [0.04838624, -0.00013253], [1.30439695, -0.00183714], [34.39644051, 3034.74612775], [14.72847983, 0.21252668], [100.47390909, 0.20469106], 69911, '#c9a77c', '#ffe2b8'],
  ['Saturn', [9.53667594, -0.0012506], [0.05386179, -0.00050991], [2.48599187, 0.00193609], [49.95424423, 1222.49362201], [92.59887831, -0.41897216], [113.66242448, -0.28867794], 58232, '#d8c08a', '#fff0c6'],
  ['Uranus', [19.18916464, -0.00196176], [0.04725744, -0.00004397], [0.77263783, -0.00242939], [313.23810451, 428.48202785], [170.9542763, 0.40805281], [74.01692503, 0.04240589], 25362, '#a6d8e0', '#d6f6ff'],
  ['Neptune', [30.06992276, 0.00026291], [0.00859048, 0.00005105], [1.77004347, 0.00035372], [-55.12002969, 218.45945325], [44.96476227, -0.32241464], [131.78422574, -0.00508664], 24622, '#4b70dd', '#a8bcff'],
  ['Pluto', [39.48211675, -0.00031596], [0.2488273, 0.0000517], [17.14001206, 0.00004818], [238.92903833, 145.20780515], [224.06891629, -0.04062942], [110.30393684, -0.01183482], 1188.3, '#c9b39a', '#efe2d2'],
];
// the north poles (RA, Dec in degrees, IAU): Saturn's tilts its rings
const SATURN_POLE = [40.589, 83.537];

const sig = (v) => Number(v.toPrecision(6));
// ecliptic (J2000) -> the scene: equatorial by the obliquity, then [x, z, -y]
const toScene = ([x, y, z]) => {
  const ye = y * Math.cos(EPS) - z * Math.sin(EPS), ze = y * Math.sin(EPS) + z * Math.cos(EPS);
  return [x, ze, -ye];
};
const kepler = (M, e) => {
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
};
// heliocentric ecliptic position (AU) of the elements at time T (Julian centuries since J2000), or at eccentric anomaly E
const orbitPoint = (el, T, E) => {
  const [a, e, I, L, w, N] = el.map(([v, r]) => v + r * T);
  const om = (w - N) * D, i = I * D, n = N * D;
  const M = (((L - w) % 360) + 540) % 360 - 180;
  const EE = E ?? kepler(M * D, e);
  const xp = a * (Math.cos(EE) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(EE);
  const co = Math.cos(om), so = Math.sin(om), cn = Math.cos(n), sn = Math.sin(n), ci = Math.cos(i), si = Math.sin(i);
  return [
    (co * cn - so * sn * ci) * xp + (-so * cn - co * sn * ci) * yp,
    (co * sn + so * cn * ci) * xp + (-so * sn + co * cn * ci) * yp,
    so * si * xp + co * si * yp,
  ];
};
// a scene `rot` ([tilt about x, turn about y]) that turns the local y axis onto the unit vector v
const rotTo = ([x, y, z]) => [Math.acos(Math.max(-1, Math.min(1, y))), Math.atan2(x, z)];

/** The Solar System on `date`: objects (proto 'planet' spheres: the plain star's sphere; Saturn's 'ring'), palette and paths (the orbits). */
export const solarSystem = (date = new Date('2026-11-14T00:00:00Z')) => {
  const days = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const T = days / 36525;
  const objects = [];
  const palette = [];
  const paths = [];
  let earth = null;
  for (const [name, a, e, I, L, w, N, km, color, glowColor] of PLANETS) {
    const el = [a, e, I, L, w, N];
    const at = toScene(orbitPoint(el, T)).map((v) => sig(v * AU));
    const mat = `planet-${name.toLowerCase()}`;
    palette.push({ name: mat, color, metal: 0, rough: 0.85, alpha: 1, emit: 0 });
    const r = km * KM;
    objects.push({ name, proto: 'planet', at, scale: sig(r), mats: { core: mat }, color, glow: sig(Math.max(r * 600, a[0] * AU * 0.004)), glowColor });
    if (name === 'Earth') earth = at;
    if (name === 'Saturn') {
      const [ra, dec] = SATURN_POLE.map((v) => v * D);
      const pole = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]; // equatorial
      palette.push({ name: 'saturn-rings', color: '#d9c6a0', metal: 0, rough: 0.9, alpha: 0.75, emit: 0 });
      objects.push({ name: "Saturn's rings", proto: 'ring', at, scale: sig(136775 * KM), mats: { ring: 'saturn-rings' }, rot: rotTo([pole[0], pole[2], -pole[1]]).map(sig), pickable: false });
    }
    const pts = [];
    for (let k = 0; k <= 256; k++) pts.push(toScene(orbitPoint(el, T, (k / 256) * 2 * Math.PI)).map((v) => sig(v * AU)));
    paths.push({ name: `${name} orbit`, kind: 'orbit', color: glowColor, pts });
  }
  // the Moon: a mean circular orbit round the Earth (384 400 km), tilted 5.145° to the ecliptic, its node going round in 18.6 years
  const moonL = (218.316 + 13.176396 * days) * D, node = (125.045 - 0.0529538 * days) * D, inc = 5.145 * D;
  const moonAt = (u) => {
    const rr = 384400 * KM;
    const x = Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc);
    const y = Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc);
    const z = Math.sin(u) * Math.sin(inc);
    return toScene([x * rr, y * rr, z * rr]).map((v, i) => sig(v + earth[i]));
  };
  palette.push({ name: 'planet-moon', color: '#b9b5ad', metal: 0, rough: 0.95, alpha: 1, emit: 0 });
  objects.push({ name: 'Moon', proto: 'planet', at: moonAt(moonL - node), scale: sig(1737.4 * KM), mats: { core: 'planet-moon' }, color: '#b9b5ad', glow: sig(1737.4 * KM * 600), glowColor: '#e8e4dc' });
  paths.push({ name: 'Moon orbit', kind: 'orbit', color: '#e8e4dc', pts: Array.from({ length: 129 }, (_, k) => moonAt((k / 128) * 2 * Math.PI)) });
  return { objects, palette, paths };
};

/** Saturn's rings: a flat annulus (radius 1 = the outer edge of the A ring, the inner edge of the C ring at 0.54), both sides. */
export const ringProto = (n = 96) => {
  const inner = 74500 / 136775;
  const positions = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * 2 * Math.PI;
    positions.push([Math.cos(t), 0, Math.sin(t)], [Math.cos(t) * inner, 0, Math.sin(t) * inner]);
  }
  const faces = [];
  for (let k = 0; k < n; k++) {
    const o0 = 2 * k, i0 = 2 * k + 1, o1 = (2 * k + 2) % (2 * n), i1 = (2 * k + 3) % (2 * n);
    faces.push({ v: [o0, i0, i1, o1], mat: 'ring' }, { v: [o0, o1, i1, i0], mat: 'ring' }); // up and down
  }
  return { positions, faces };
};
