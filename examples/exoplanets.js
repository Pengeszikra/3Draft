// The 500 best known exoplanets (data/exoplanets.js, from the Open Exoplanet Catalogue) as shader planets round their stars.
// Each gets one of 30 surface recipes by its class: its size (rocky < 1.6 Earth radii, sub-Neptune < 4, Neptune < 8, giant) and
// its equilibrium temperature (lava > 1200 K, hot > 700, warm > 350, temperate > 200, cold > 100, frozen), a variant of the
// class by its name. The orbit's plane and the planet's place on it come from its name (the catalogue's inclinations and
// phases are mostly unknown); the distance from its star is the real semi-major axis.
import { EXO_HOSTS, EXOPLANETS } from './data/exoplanets.js';

const AU = 1.58125074e-5; // light years
const R_EARTH = 6371 / 9.4607304725808e12; // light years
const PC = 3.26156; // light years per parsec

const ring = { inner: 1.3, outer: 2.3, color: '#cdbb98' };
// the 30 recipes: [class, recipe]
export const EXO_RECIPES = [
  ['rock-lava', { kind: 'lava', colors: ['#2a201c', '#4a3a30', '#ff6a1a'] }],
  ['rock-lava', { kind: 'lava', colors: ['#3a2a22', '#5c4637', '#ffd25a'] }],
  ['rock-hot', { kind: 'rock', colors: ['#6e6258', '#9a8a7a', '#3e3530'] }],
  ['rock-hot', { kind: 'cloud', colors: ['#e3c67c', '#f3e2b0', '#b8913c'], atmosphere: { color: '#f2d08a', size: 0.03 } }],
  ['rock-hot', { kind: 'cloud', colors: ['#d8925a', '#f0c08a', '#9c5a30'], atmosphere: { color: '#f0a86a', size: 0.03 } }],
  ['rock-warm', { kind: 'rock', colors: ['#b08a5c', '#d6b88a', '#7a5a3a'], atmosphere: { color: '#e8c89a', size: 0.012 } }],
  ['rock-warm', { kind: 'cloud', colors: ['#e9dcc0', '#f7f0de', '#c8b48c'], atmosphere: { color: '#f5e8c8', size: 0.025 } }],
  ['rock-temp', { kind: 'earth', colors: ['#1f528f', '#4f7f3a', '#b79a66'], detail: 0.53, atmosphere: { color: '#7fb2ff', size: 0.02 } }],
  ['rock-temp', { kind: 'earth', colors: ['#174a86', '#3e7a46', '#9a8a5a'], detail: 0.7, atmosphere: { color: '#8fc0ff', size: 0.022 } }],
  ['rock-temp', { kind: 'earth', colors: ['#2d5a7a', '#8a7a4a', '#c8a066'], detail: 0.38, atmosphere: { color: '#c0c8ff', size: 0.018 } }],
  ['rock-cold', { kind: 'rock', colors: ['#a5502e', '#c88060', '#6e3420'], detail: 0.1, atmosphere: { color: '#e8a07a', size: 0.01 } }],
  ['rock-cold', { kind: 'rock', colors: ['#8a8c90', '#b8bcc2', '#5c5e62'], detail: 0.18 }],
  ['rock-froz', { kind: 'rock', colors: ['#c8d4e0', '#eef4fa', '#8a9cb0'], detail: 0.3 }],
  ['sub-hot', { kind: 'cloud', colors: ['#a8683a', '#d29a62', '#6a3a20'], atmosphere: { color: '#e09a60', size: 0.04 } }],
  ['sub-hot', { kind: 'cloud', colors: ['#b8b4ac', '#e2ded6', '#8a8680'], atmosphere: { color: '#d8d4cc', size: 0.04 } }],
  ['sub-warm', { kind: 'cloud', colors: ['#cdb894', '#ece0c4', '#9a8664'], atmosphere: { color: '#e8dcc0', size: 0.035 } }],
  ['sub-warm', { kind: 'earth', colors: ['#2e6a9a', '#7a9aa8', '#a8b8c0'], detail: 0.88, atmosphere: { color: '#a8d0ff', size: 0.03 } }],
  ['sub-temp', { kind: 'earth', colors: ['#1e7a8a', '#3a8a7a', '#6aa89a'], detail: 0.94, atmosphere: { color: '#9ae8ff', size: 0.035 } }],
  ['sub-cold', { kind: 'ice', colors: ['#b8dce8', '#d8eef4', '#90bccc'], detail: 4, atmosphere: { color: '#d0f0ff', size: 0.03 } }],
  ['nep-hot', { kind: 'gas', colors: ['#3e5a5a', '#6a8a7a', '#2a3a3a'], detail: 7, atmosphere: { color: '#8ab8a8', size: 0.025 } }],
  ['nep-warm', { kind: 'ice', colors: ['#62b8c8', '#90d8e2', '#3a8a9a'], detail: 5, atmosphere: { color: '#a8eef8', size: 0.025 } }],
  ['nep-cold', { kind: 'ice', colors: ['#3f63d0', '#6f92ee', '#22409c'], detail: 5, atmosphere: { color: '#9fb8ff', size: 0.02 } }],
  ['jup-lava', { kind: 'gas', colors: ['#2a1a16', '#5a2a1e', '#ff5a20'], detail: 9, spot: true, atmosphere: { color: '#ff7a3a', size: 0.02 } }],
  ['jup-lava', { kind: 'gas', colors: ['#3a1e14', '#7a3a22', '#d0402a'], detail: 12, atmosphere: { color: '#e06a3a', size: 0.02 } }],
  ['jup-hot', { kind: 'gas', colors: ['#5a3e2a', '#8a6a4a', '#3a261a'], detail: 11, atmosphere: { color: '#b88a5a', size: 0.015 } }],
  ['jup-warm', { kind: 'gas', colors: ['#b98d62', '#efe2c8', '#c0603a'], detail: 14, spot: true }],
  ['jup-temp', { kind: 'gas', colors: ['#e2dccc', '#f8f4ea', '#b8ae98'], detail: 12, atmosphere: { color: '#f0f0ff', size: 0.012 } }],
  ['jup-temp', { kind: 'gas', colors: ['#bccad8', '#e6eef6', '#8a9cb0'], detail: 10 }],
  ['jup-cold', { kind: 'gas', colors: ['#cfb27a', '#efe0b5', '#b8975c'], detail: 10, ring }],
  ['jup-cold', { kind: 'gas', colors: ['#a8b8cc', '#d8e2ee', '#7a8ca8'], detail: 8, atmosphere: { color: '#c8d8ff', size: 0.012 } }],
];
// a class that has no recipe of its own borrows the nearest one
const FALLBACK = { 'rock-froz': 'rock-froz', 'sub-lava': 'sub-hot', 'sub-froz': 'sub-cold', 'nep-lava': 'nep-hot', 'nep-temp': 'nep-warm', 'nep-froz': 'nep-cold', 'jup-froz': 'jup-cold' };

const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 2166136261);
export const exoClass = (rE, teq) => {
  const size = rE < 1.6 ? 'rock' : rE < 4 ? 'sub' : rE < 8 ? 'nep' : 'jup';
  const heat = teq > 1200 ? 'lava' : teq > 700 ? 'hot' : teq > 350 ? 'warm' : teq > 200 ? 'temp' : teq > 100 ? 'cold' : 'froz';
  return `${size}-${heat}`;
};
export const exoRecipe = (name, rE, teq) => {
  const c = exoClass(rE, teq);
  let pool = EXO_RECIPES.filter(([k]) => k === c);
  if (!pool.length) pool = EXO_RECIPES.filter(([k]) => k === FALLBACK[c]);
  if (!pool.length) pool = EXO_RECIPES.filter(([k]) => k.startsWith(c.split('-')[0]));
  return pool[hash(name) % pool.length][1];
};

const sig = (v) => Number(v.toPrecision(6));
const toScene = (x, y, z) => [x * PC, z * PC, -y * PC]; // equatorial parsec -> scene light years

/** The host stars the deep sky lacked (FAR_STARS rows), and `place(stars)`: the planets round the scene's star objects. */
export const exoplanetObjects = () => ({ hosts: EXO_HOSTS, place: (stars) => exoPlace(stars), palette: [{ name: 'exoplanet', color: '#8a8a8a', metal: 0, rough: 0.9, alpha: 1, emit: 0 }] });
// a planet's place is its star object's own (rounded) place plus its orbit, kept with 14 digits: 0.01 AU is 1.6e-7 ly
const fine = (v) => Number(v.toPrecision(14));
const exoPlace = (stars) => {
  const byName = new Map();
  for (const o of stars) (byName.get(o.name) ?? byName.set(o.name, []).get(o.name)).push(o);
  const objects = [];
  for (const [name, host, hx, hy, hz, a, rE, teq, year] of EXOPLANETS) {
    const h = hash(name);
    const want = toScene(hx, hy, hz);
    const star = (byName.get(host) ?? []).sort((p, q) => Math.hypot(...p.at.map((v, i) => v - want[i])) - Math.hypot(...q.at.map((v, i) => v - want[i])))[0];
    if (!star) throw new Error(`exoplanets: no star ${host} for ${name}`);
    const center = star.at;
    // the orbit's plane (its normal from the name) and the place on it
    const u1 = ((h % 1000) / 1000) * 2 - 1, u2 = (((h >>> 10) % 1000) / 1000) * 2 * Math.PI, ph = (((h >>> 20) % 1000) / 1000) * 2 * Math.PI;
    const n = [Math.sqrt(1 - u1 * u1) * Math.cos(u2), u1, Math.sqrt(1 - u1 * u1) * Math.sin(u2)];
    const t1 = (() => {
      const v = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const c = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]];
      const l = Math.hypot(...c);
      return c.map((x) => x / l);
    })();
    const t2 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]];
    const r = a * AU;
    const at = center.map((c, i) => fine(c + r * (Math.cos(ph) * t1[i] + Math.sin(ph) * t2[i])));
    const radius = rE * R_EARTH;
    const rec = exoRecipe(name, rE, teq);
    objects.push({
      name,
      proto: 'planet',
      at,
      scale: sig(radius),
      mats: { core: 'exoplanet' },
      color: rec.colors[1],
      glow: sig(Math.max(radius * 600, r * 0.004)),
      glowColor: rec.colors[1],
      planet: { ...rec, seed: h % 997, pole: n.map(sig), light: [...center] }, // (lit by its own star)
      exo: { host, a, rE, teq, year, class: exoClass(rE, teq) },
    });
  }
  return objects;
};
