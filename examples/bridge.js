// A stone arch bridge: banks, water, a 14-stone arch with masonry above it, deck, parapets and posts.
// Built with the engine only. `node examples/bridge.js` checks every object and writes
// examples/bridge.scene.json, a scene file the MCP `import` tool and the viewer's database can load.

import { writeFileSync } from 'node:fs';
import { box, validate, renderView, merge, orbit } from '../dist/index.js';

const STONES = ['#b8b0a0', '#a89f8e', '#c2baa9'];

/** The bridge as named objects: [{ name, mesh }]. */
export const bridgeObjects = () => {
  const out = [];
  const add = (name, mesh) => out.push({ name, mesh });
  const slab = (name, size, at, color) => add(name, box({ size, at, color }));

  slab('bank_w', [3.1, 1, 4], [-3.45, 0.5, 0], '#6a9a3b');
  slab('bank_e', [3.1, 1, 4], [3.45, 0.5, 0], '#6a9a3b');
  slab('water', [3.8, 0.15, 4], [0, 0.075, 0], '#3f7fbf');
  slab('deck', [7.4, 0.15, 1], [0, 1.075, 0], '#9c948a');
  for (const [n, z] of [['parapet_n', -0.43], ['parapet_s', 0.43]]) slab(n, [7.4, 0.22, 0.14], [0, 1.26, z], '#c9c2b4');
  for (let i = 0; i < 8; i++) {
    for (const [s, z] of [['n', -0.43], ['s', 0.43]]) slab(`post_${s}${i}`, [0.16, 0.42, 0.18], [-3.5 + i, 1.36, z], '#b8b0a0');
  }

  // The arch: an elliptical ring cut into N stones, each a prism with a trapezoid section.
  const CY = 0.35; // center height of the ellipse
  const INNER = [1.55, 0.45]; // semi-axes x, y of the opening
  const OUTER = [1.9, 0.65];
  const HALF = 0.5; // half the bridge width
  const N = 14;
  const TOP = 1.0; // the masonry reaches up to the deck
  const at = ([a, b], t) => [a * Math.cos(t), CY + b * Math.sin(t)];
  const FACES = [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
  for (let i = 0; i < N; i++) {
    const t0 = (Math.PI * i) / N;
    const t1 = (Math.PI * (i + 1)) / N;
    const q = [at(INNER, t0), at(INNER, t1), at(OUTER, t1), at(OUTER, t0)];
    const positions = [...q.map(([x, y]) => [x, y, HALF]), ...q.map(([x, y]) => [x, y, -HALF])];
    const color = STONES[i % 3];
    const mesh = (faces) => ({ positions, faces: faces.map((v) => ({ v, color })) });
    let m = mesh(FACES);
    if (validate(m).inside_out) m = mesh(FACES.map((v) => [...v].reverse()));
    add(`arch_${i}`, m);

    // the wall between the stone and the deck
    const [x0, x1] = [q[3][0], q[2][0]];
    const low = Math.min(q[2][1], q[3][1]) - 0.02;
    if (TOP - low > 0.02) slab(`wall_${i}`, [Math.abs(x0 - x1), TOP - low, 2 * HALF], [(x0 + x1) / 2, (TOP + low) / 2, 0], STONES[(i + 1) % 3]);
  }
  return out;
};

/** The same bridge as one mesh. */
export const bridge = () => merge(...bridgeObjects().map((o) => o.mesh));

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const objects = bridgeObjects();
  const bad = objects.filter((o) => !validate(o.mesh).ok);
  if (bad.length) throw new Error(`not ok: ${bad.map((o) => o.name).join(', ')}`);
  const file = new URL('./bridge.scene.json', import.meta.url);
  writeFileSync(file, JSON.stringify({ format: '3draft-scene', version: 1, objects }));
  console.log(`${objects.length} objects, all ok -> examples/bridge.scene.json`);
  writeFileSync(new URL('./out/bridge.svg', import.meta.url), renderView(bridge(), orbit({ yaw: -0.1, pitch: 0.1 }), { size: 700, points: false }));
}
