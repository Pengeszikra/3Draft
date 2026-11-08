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
for (const [name, bin] of bins) if (bin.faces.length) objects.push({ name, mesh: { positions: bin.positions, faces: bin.faces } });

const out = { palette: [...palette.values()], objects };
const n = objects.reduce((s, o) => s + o.mesh.faces.length, 0);
console.log(objects.length, 'objects', n, 'faces', palette.size, 'materials');
mkdirSync(join(here, '../data'), { recursive: true });
writeFileSync(join(here, '../data/ship-mesh.js'), `// Baked by examples/ship-support/extract.mjs from github.com/Pengeszikra/redneck-wreck (src/ship). Metres, nose to -Z.\nexport const SHIP = ${JSON.stringify(out)};\n`);
rmSync(work, { recursive: true, force: true });
