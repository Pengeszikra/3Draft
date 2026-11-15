// The 500 best known exoplanets (data/exoplanets.js, from the Open Exoplanet Catalogue) as shader planets round their stars.
// Each gets one of 30 surface recipes by its class: its size (rocky < 1.6 Earth radii, sub-Neptune < 4, Neptune < 8, giant) and
// its equilibrium temperature (lava > 1200 K, hot > 700, warm > 350, temperate > 200, cold > 100, frozen), a variant of the
// class by its name. The orbit's plane and the planet's place on it come from its name (the catalogue's inclinations and
// phases are mostly unknown); the distance from its star is the real semi-major axis.
import { EXO_HOSTS, EXOPLANETS } from './data/exoplanets.js';
import { EXO_RECIPES, exoClass, exoRecipe } from '../dist/index.js';

const AU = 1.58125074e-5; // light years
const R_EARTH = 6371 / 9.4607304725808e12; // light years
const PC = 3.26156; // light years per parsec

// the 30 recipes, the classes and the choice live in the engine (src/sky.ts), shared with sky catalogues
export { EXO_RECIPES, exoClass, exoRecipe };
const hash = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 2166136261);

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
