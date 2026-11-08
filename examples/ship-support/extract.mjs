// Bakes the redneck-wreck ship (github.com/Pengeszikra/redneck-wreck, src/ship) into a 3Draft scene without three.js:
// the TypeScript is desugared (|> pipes), compiled, and run against three-shim.mjs, which only records world-space
// triangles and material names. Textures are dropped; every material becomes a plain palette entry.
//   node examples/ship-support/extract.mjs /path/to/redneck-wreck   ->  examples/data/ship-mesh.js

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { desugarPipes } from '../../scripts/pipe.mjs';
import { findTypeScript } from '../../scripts/build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rw = resolve(process.argv[2] ?? '../redneck-wreck');
const work = join(here, '.work');
rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, 'ship'), { recursive: true });
mkdirSync(join(work, 'core'), { recursive: true });

const ts = (await import(pathToFileURL(findTypeScript()).href)).default;
const compile = (from, to) => {
  const src = desugarPipes(ts, readFileSync(from, 'utf8'), from);
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
    .replace(/from "three"/g, 'from "../../three-shim.mjs"')
    .replace(/from "\.\.\/core\/materials"/g, 'from "../../materials-mock.mjs"')
    .replace(/from "\.\.\/core\/textures"/g, 'from "../../textures-mock.mjs"')
    .replace(/from "(\.\.?\/[^"]+?)"/g, (m, p) => (p.endsWith('.mjs') ? m : `from "${p}.mjs"`));
  writeFileSync(to, js);
};
for (const f of readdirSync(join(rw, 'src/ship'))) if (f.endsWith('.ts')) compile(join(rw, 'src/ship', f), join(work, 'ship', f.replace('.ts', '.mjs')));
compile(join(rw, 'src/core/pipe.ts'), join(work, 'core/pipe.mjs'));

// the label decals draw on a 2D canvas; only the (texture-less) quad matters here
const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop }) };
const THREE = await import('./three-shim.mjs');
const { makeMaterials } = await import('./materials-mock.mjs');
const { buildShip } = await import(pathToFileURL(join(work, 'ship/ship.mjs')).href);

const M = makeMaterials();
const { ctx } = buildShip(M, () => {}, () => {});
// settle every mechanism: doors shut (player far away), ramp / crane / gear in their start poses
for (let i = 0; i < 3; i++) for (const tick of ctx.ticks) tick(100, 0, new THREE.Vector3(999, 999, 999));
ctx.root.updateMatrixWorld();

const palette = new Map();
const objects = [];
const r3 = (v) => Math.round(v * 1000) / 1000;
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const matName = (m) => {
  if (!m || m.params.visible === false) return null;
  const name = m.name || 'material';
  if (!palette.has(name)) {
    const p = m.params;
    const glow = p.emissive != null && p.emissive !== 0;
    palette.set(name, {
      name,
      color: hex(glow ? p.emissive : (p.color ?? 0xcccccc)),
      metal: p.metalness ?? 0,
      rough: p.roughness ?? 0.6,
      alpha: p.transparent ? (p.opacity ?? 1) : 1,
      emit: glow ? 1 : 0,
      soft: 0,
    });
  }
  return name;
};

const visibleDeep = (o) => {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
};

// a few objects instead of ~370 loose parts: the hull plating, the interior, the cargo, the glass and the lights
const GROUPS = {
  glass: ['glass'],
  lights: ['lightBlue', 'lightRed', 'lightGreen', 'lightStrip', 'headlight', 'reactorCore', 'screen', 'buttons'],
  interior: ['floor', 'ceiling', 'interior', 'fabric', 'fabricRed', 'mattress', 'wood', 'white', 'label'],
  cargo: ['container'],
};
const groupOf = (name) => (name.startsWith('crate-') ? 'cargo' : (Object.entries(GROUPS).find(([, l]) => l.includes(name)) ?? ['hull'])[0]);
const bins = new Map(['hull', 'interior', 'cargo', 'glass', 'lights'].map((k) => [k, { positions: [], index: new Map(), faces: [] }]));

ctx.root.traverse((o) => {
  if (!(o instanceof THREE.Mesh) || !visibleDeep(o)) return;
  const g = o.geometry;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const e = o.matrixWorld.e;
  const world = g.positions.map(([x, y, z]) => [
    e[0] * x + e[4] * y + e[8] * z + e[12],
    e[1] * x + e[5] * y + e[9] * z + e[13],
    e[2] * x + e[6] * y + e[10] * z + e[14],
  ]);
  // a mirrored scale (negative determinant) flips every face
  const det = e[0] * (e[5] * e[10] - e[6] * e[9]) - e[4] * (e[1] * e[10] - e[2] * e[9]) + e[8] * (e[1] * e[6] - e[2] * e[5]);
  for (const f of g.faces) {
    const name = matName(mats[Math.min(f.g, mats.length - 1)]);
    if (!name) continue;
    const bin = bins.get(groupOf(name));
    const ids = f.v.map((k) => {
      const p = world[k].map(r3);
      const key = p.join();
      if (!bin.index.has(key)) bin.index.set(key, bin.positions.push(p) - 1);
      return bin.index.get(key);
    });
    const v = [...new Set(ids)];
    if (v.length < 3) continue;
    bin.faces.push({ v: det < 0 ? v.reverse() : v, mat: name });
  }
});
// Coplanar faces that cover each other (a wall whose foot is as wide as the base under it, a slab lying on a slab)
// flicker in the depth buffer. Within one plane a face that lies inside another face's extent is dropped; the
// outer skin wins over the interior, then the bigger face.
const RANK = (m) => (/^hull|Paint|hazard|metal|Metal|chrome|radiator|container|rubber/.test(m) ? 0 : /^light|glass/.test(m) ? 1 : 2);
const planeCull = (all) => {
  const info = all.map(({ bin, f }, i) => {
    const P = f.v.map((k) => bin.positions[k]);
    let n = [0, 0, 0];
    for (let k = 1; k < P.length - 1; k++) {
      const a = P[k].map((x, j) => x - P[0][j]), b = P[k + 1].map((x, j) => x - P[0][j]);
      n = [n[0] + a[1] * b[2] - a[2] * b[1], n[1] + a[2] * b[0] - a[0] * b[2], n[2] + a[0] * b[1] - a[1] * b[0]];
    }
    const area = Math.hypot(...n) / 2;
    if (area < 1e-9) return { i, dead: true };
    n = n.map((x) => x / (2 * area));
    const lead = n.find((x) => Math.abs(x) > 1e-6);
    if (lead < 0) n = n.map((x) => -x);
    const d = n[0] * P[0][0] + n[1] * P[0][1] + n[2] * P[0][2];
    const lo = [0, 1, 2].map((j) => Math.min(...P.map((p) => p[j]))), hi = [0, 1, 2].map((j) => Math.max(...P.map((p) => p[j])));
    const ext = [0, 1, 2].map((j) => hi[j] - lo[j]).sort((a, b) => b - a);
    return { i, area, rect: area >= ext[0] * ext[1] * 0.98, key: [...n.map((x) => Math.round(x * 50)), Math.round(d * 100)].join(), lo, hi, rank: RANK(f.mat) };
  });
  const buckets = new Map();
  for (const f of info) if (!f.dead) (buckets.get(f.key) ?? buckets.set(f.key, []).get(f.key)).push(f);
  const drop = new Set(info.filter((f) => f.dead).map((f) => f.i));
  const EPS = 0.012;
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.rank - b.rank || b.area - a.area || a.i - b.i);
    const kept = [];
    for (const f of list) {
      const covered = kept.some((k) => k.rect && [0, 1, 2].every((j) => f.lo[j] >= k.lo[j] - EPS && f.hi[j] <= k.hi[j] + EPS));
      if (covered) drop.add(f.i);
      else kept.push(f);
    }
  }
  return drop;
};
{
  const all = [...bins.values()].flatMap((bin) => bin.faces.map((f) => ({ bin, f })));
  const drop = planeCull(all);
  const gone = new Set([...drop].map((i) => all[i].f));
  for (const bin of bins.values()) bin.faces = bin.faces.filter((f) => !gone.has(f));
  console.log('coplanar faces dropped:', drop.size);
}
for (const [name, bin] of bins) if (bin.faces.length) objects.push({ name, mesh: { positions: bin.positions, faces: bin.faces } });

// Weathering: the hull plating gets a slightly different tone per panel (1.2 m cells, hashed), so large flat
// areas read as bolted-together plates and not as one toy-like colour.
const shade = (c, k) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('');
const hash = (a, b, c) => {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const hull = bins.get('hull');
const PANEL = new Set(['hullYellow', 'hullDark', 'hullRed', 'yellowPaint', 'metal', 'darkMetal']);
for (const f of hull.faces) {
  if (!PANEL.has(f.mat)) continue;
  const c = [0, 1, 2].map((j) => f.v.reduce((s, k) => s + hull.positions[k][j], 0) / f.v.length);
  const cell = c.map((x) => Math.floor(x / 1.2));
  const base = palette.get(f.mat).color;
  f.color = shade(base, 0.82 + hash(...cell) * 0.26);
}

const out = { palette: [...palette.values()], objects };
const n = objects.reduce((s, o) => s + o.mesh.faces.length, 0);
console.log(objects.length, 'objects', n, 'faces', palette.size, 'materials');
mkdirSync(join(here, '../data'), { recursive: true });
writeFileSync(join(here, '../data/ship-mesh.js'), `// Baked by examples/ship-support/extract.mjs from github.com/Pengeszikra/redneck-wreck (src/ship). Metres, nose to -Z.\nexport const SHIP = ${JSON.stringify(out)};\n`);
rmSync(work, { recursive: true, force: true });
