// Builds exoplanets.js: the 500 best known exoplanets for the deep sky, from the Open Exoplanet Catalogue (MIT licence).
//   git clone --depth 1 https://github.com/OpenExoplanetCatalogue/oec_gzip
//   node examples/data/build-exoplanets.mjs oec_gzip/systems.xml.gz
// "Best known": the famous ones first (FAMOUS: whole systems by name), then the planets of the nearest systems, until 500.
// Out: EXO_HOSTS, the host stars the deep sky does not have yet (FAR_STARS rows: [name, x, y, z (equatorial, parsec), absMag,
// spect, B-V, luminosity]), and EXOPLANETS: [name, host (a star name of the scene), host x, y, z (parsec), a (AU), radius
// (Earth radii), equilibrium temperature (K), year of discovery]. The surface recipe is picked in exoplanets.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { STARS as NEAR } from './stars5000.js';
import { FAR_STARS } from './deepsky-data.js';
import { FIGURE_STARS } from './figures.js';

const [file] = process.argv.slice(2);
const xml = gunzipSync(readFileSync(file)).toString('utf8');

// a tiny XML reader: elements { tag, kids, text }
const parse = (src) => {
  const root = { tag: '#', kids: [], text: '' };
  const stack = [root];
  for (const m of src.matchAll(/<(\/?)([A-Za-z_][\w.-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    const top = stack.at(-1);
    if (m[5] !== undefined) {
      top.text += m[5];
      continue;
    }
    if (m[1]) {
      stack.pop();
      continue;
    }
    const el = { tag: m[2], kids: [], text: '' };
    top.kids.push(el);
    if (!m[4] && !m[3].endsWith('/')) stack.push(el);
  }
  return root;
};
const root = parse(xml.replace(/<\?xml[^>]*>/, ''));
const kid = (el, tag) => el.kids.find((k) => k.tag === tag);
const val = (el, tag) => {
  const k = kid(el, tag);
  const v = k ? Number(k.text.trim()) : NaN;
  return Number.isFinite(v) ? v : null;
};
const names = (el) => el.kids.filter((k) => k.tag === 'name').map((k) => k.text.trim());
const hms = (t) => {
  const [h, m, s] = t.trim().split(/\s+/).map(Number);
  return (h + (m ?? 0) / 60 + (s ?? 0) / 3600) * 15;
};
const dms = (t) => {
  const s = t.trim();
  const sign = s.startsWith('-') ? -1 : 1;
  const [d, m, sec] = s.replace(/^[+-]/, '').split(/\s+/).map(Number);
  return sign * (d + (m ?? 0) / 60 + (sec ?? 0) / 3600);
};

// whole systems everybody has heard of (a name of the system or of its star)
const FAMOUS = ['TRAPPIST-1', 'Proxima Centauri', 'Alpha Centauri', '51 Peg', 'HD 209458', 'HD 189733', 'Kepler-186', 'Kepler-452', 'Kepler-22', 'Kepler-16', 'Kepler-90', 'Kepler-11', 'Kepler-62', 'Kepler-442', 'Kepler-1649', 'Kepler-10', 'Kepler-7', 'Kepler-69', 'Kepler-47', 'Kepler-444', 'Kepler-20', 'Kepler-37', 'Kepler-138', 'Kepler-1229', 'Kepler-296', 'Kepler-283', 'Kepler-61', 'Kepler-1625', 'WASP-12', 'WASP-121', 'WASP-17', 'WASP-39', 'WASP-43', 'WASP-76', 'WASP-18', 'WASP-33', 'WASP-107', 'WASP-96', 'WASP-80', 'WASP-19', 'HAT-P-7', 'HAT-P-11', 'HAT-P-1', 'HAT-P-26', 'TrES-2', 'TrES-4', 'KELT-9', 'KELT-11', 'CoRoT-7', 'CoRoT-1', '55 Cnc', 'Gliese 581', 'GJ 581', 'Gliese 667 C', 'GJ 667 C', 'Gliese 876', 'GJ 876', 'GJ 1214', 'GJ 436', 'GJ 1132', 'GJ 357', 'GJ 3512', 'GJ 486', 'GJ 9827', 'LHS 1140', 'LHS 3844', 'LTT 1445 A', 'K2-18', 'K2-141', 'K2-3', 'K2-138', 'TOI-700', 'TOI-270', 'TOI-1338', 'TOI-849', 'TOI-178', 'LTT 9779', 'Tau Ceti', 'tau Cet', 'Epsilon Eridani', 'eps Eri', 'Fomalhaut', 'Beta Pictoris', 'beta Pic', 'HR 8799', '2M1207', 'PSR B1257+12', 'PSR B1620-26', 'Upsilon Andromedae', 'ups And', '47 UMa', '14 Her', '70 Vir', 'HD 80606', 'HD 40307', 'HD 69830', 'HD 10180', 'HD 219134', 'HD 149026', 'Barnard', "Barnard's Star", 'Ross 128', 'Wolf 1061', 'Teegarden', "Teegarden's Star", 'Luyten', 'GJ 273', 'YZ Ceti', 'YZ Cet', 'Lacaille 9352', 'Gliese 1061', 'GJ 1061', 'AU Mic', 'Kapteyn', 'Wolf 359', 'Lalande 21185', 'Gliese 411', 'Struve 2398', 'Gliese 1002', 'Gliese 12', 'L 98-59', 'LP 791-18', 'Kepler-1708', 'COCONUTS-2', 'WD 1856+534', 'TOI-1452', 'TOI-715', 'Gamma Cephei', 'gam Cep', 'Pollux', 'bet Gem', 'Iota Draconis', 'iot Dra', 'Mu Arae', 'mu Ara', '61 Vir', '16 Cyg B', 'Gliese 229', 'GJ 229', 'Gliese 832', 'GJ 832', 'HD 95086', '51 Eri', 'HIP 65426', 'AF Lep', 'TYC 8998-760-1', 'YSES 1', 'PDS 70', 'GQ Lup', 'DH Tau', 'kap And', 'HD 106906', 'Ross 458', 'GU Psc', 'VHS 1256-1257', 'Gliese 504', 'GJ 504', 'HD 114762', 'Kepler-78', 'Kepler-9', 'Kepler-36', 'Kepler-1647', 'Kepler-35', 'Kepler-34', 'Kepler-38', 'Kepler-64', 'Kepler-413', 'Kepler-453'];
const famous = new Set(FAMOUS.map((n) => n.toLowerCase()));

// every planet with what the deep sky needs: the system's place, the star, the orbit, the size, the temperature
const all = [];
const walk = (el, sys, star) => {
  for (const k of el.kids) {
    if (k.tag === 'star') walk(k, sys, k);
    else if (k.tag === 'binary') walk(k, sys, star);
    else if (k.tag === 'planet' && star) all.push({ sys, star, planet: k });
  }
};
for (const sys of root.kids.find((k) => k.tag === 'systems')?.kids ?? root.kids) if (sys.tag === 'system') walk(sys, sys, null);

const REARTH_PER_RJ = 11.209;
const R_SUN_AU = 0.00465047;
const rows = [];
for (const { sys, star, planet } of all) {
  const ra = kid(sys, 'rightascension'), dec = kid(sys, 'declination'), dist = val(sys, 'distance');
  const list = kid(planet, 'list')?.text.trim() ?? '';
  if (!ra || !dec || !dist || !/Confirmed/i.test(list)) continue;
  const pn = names(planet)[0];
  if (!pn) continue;
  const Ts = val(star, 'temperature') ?? 5500, Rs = val(star, 'radius') ?? 1, Ms = val(star, 'mass') ?? 1;
  let a = val(planet, 'semimajoraxis');
  const P = val(planet, 'period');
  if (!a && P) a = Math.cbrt(Ms * (P / 365.25) ** 2);
  if (!a) continue;
  let rE = val(planet, 'radius') !== null ? val(planet, 'radius') * REARTH_PER_RJ : null;
  const mJ = val(planet, 'mass');
  if (rE === null && mJ !== null) {
    const mE = mJ * 317.8; // a mass-radius guess (Chen & Kipping like): rocky, Neptunian, giant
    rE = mE < 2 ? mE ** 0.28 : mE < 130 ? 1.08 * mE ** 0.59 * 0.55 : 11.2;
  }
  if (rE === null) rE = 1;
  const teq = val(planet, 'temperature') ?? Ts * Math.sqrt((Rs * R_SUN_AU) / (2 * a)) * 0.9;
  const sysNames = names(sys), starNames = names(star);
  const known = [...sysNames, ...starNames].some((n) => famous.has(n.toLowerCase()));
  const raD = (hms(ra.text) * Math.PI) / 180, decD = (dms(dec.text) * Math.PI) / 180;
  const pos = [dist * Math.cos(decD) * Math.cos(raD), dist * Math.cos(decD) * Math.sin(raD), dist * Math.sin(decD)];
  rows.push({ name: pn, star: starNames[0] ?? sysNames[0], starNames, pos, dist, a, rE, teq, year: val(planet, 'discoveryyear'), known, Ts, Rs, magV: val(star, 'magV'), magB: val(star, 'magB'), spect: kid(star, 'spectraltype')?.text.trim() ?? '' });
}
rows.sort((p, q) => Number(q.known) - Number(p.known) || p.dist - q.dist);
const chosen = rows.slice(0, 500);

// the host stars: the deep sky's own one when it is there (by position), otherwise a new star row
const scene = [...NEAR.slice(0, 1000), ...FAR_STARS, ...FIGURE_STARS].filter((s) => s[0] !== 'Sol');
const near = (s, p, tol) => Math.hypot(s[1] - p[0], s[2] - p[1], s[3] - p[2]) < tol;
// by one of the star's names first (a star of a wider system, Proxima in Alpha Centauri's, has the system's place), then by place
const own = (p) => {
  const ns = new Set(p.starNames.map((n) => n.toLowerCase()));
  return scene.find((s) => ns.has(s[0].toLowerCase()) && near(s, p.pos, Math.max(0.2, p.dist * 0.03))) ?? scene.find((s) => near(s, p.pos, Math.max(0.03, p.dist * 0.003)));
};
const bvOf = (T) => {
  // the inverse of Ballesteros' formula, by bisection
  let lo = -0.4, hi = 2.0;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    const t = 4600 * (1 / (0.92 * m + 1.7) + 1 / (0.92 * m + 0.62));
    if (t > T) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};
const hosts = new Map();
const fmt = (v, d = 4) => String(Math.round(v * 10 ** d) / 10 ** d);
const planets = chosen.map((p) => {
  const mine = own(p);
  let host = mine?.[0];
  if (!host) {
    host = p.star;
    if (!hosts.has(host)) {
      const L = p.Rs ** 2 * (p.Ts / 5772) ** 4;
      const absMag = 4.74 - 2.5 * Math.log10(Math.max(L, 1e-6));
      const bv = p.magB !== null && p.magV !== null ? p.magB - p.magV : bvOf(p.Ts);
      hosts.set(host, `  [${JSON.stringify(host)},${fmt(p.pos[0])},${fmt(p.pos[1])},${fmt(p.pos[2])},${fmt(absMag, 2)},${JSON.stringify(p.spect)},${fmt(bv, 3)},${fmt(L, 5)}],`);
    }
  }
  const hp = mine ? [mine[1], mine[2], mine[3]] : p.pos;
  return `  [${JSON.stringify(p.name)},${JSON.stringify(host)},${fmt(hp[0])},${fmt(hp[1])},${fmt(hp[2])},${fmt(p.a, 5)},${fmt(p.rE, 3)},${Math.round(p.teq)},${p.year ?? 'null'}],`;
});
writeFileSync(
  new URL('./exoplanets.js', import.meta.url),
  [
    '// Generated by build-exoplanets.mjs from the Open Exoplanet Catalogue (MIT licence). Do not edit.',
    '// EXO_HOSTS: host stars the deep sky lacked, as FAR_STARS rows: [name, x, y, z (equatorial, parsec), absMag, spect, B-V, luminosity]',
    'export const EXO_HOSTS = [',
    ...hosts.values(),
    '];',
    '// EXOPLANETS: [name, host star, host x, y, z (parsec), a (AU), radius (Earth radii), equilibrium temperature (K), discovered]',
    'export const EXOPLANETS = [',
    ...planets,
    '];',
    '',
  ].join('\n'),
);
console.log(rows.length, 'usable planets;', chosen.filter((p) => p.known).length, 'famous +', chosen.filter((p) => !p.known).length, 'nearest; farthest', Math.round(Math.max(...chosen.map((p) => p.dist)) * 3.26156), 'ly;', hosts.size, 'new host stars');
