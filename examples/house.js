// The renovated house, converted from Blender (tools/blend/exp2.py -> examples/house.raw.json).
// This step repairs what the converter cannot know: closed solids that came out inside-out are
// flipped, and faces the engine rejects (not planar / not convex) are split into triangles.
// `node examples/house.js` writes examples/house.scene.json (one object per Blender object).
import { readFileSync, writeFileSync } from 'node:fs';
import { validate, merge, bounds } from '../dist/index.js';

const raw = JSON.parse(readFileSync(new URL('./house.raw.json', import.meta.url)));

const fan = (f) => f.v.slice(1, -1).map((_, i) => ({ v: [f.v[0], f.v[i + 1], f.v[i + 2]], color: f.color }));

const repair = (mesh) => {
  let m = mesh;
  let v = validate(m);
  if (v.closed && v.inside_out) m = { ...m, faces: m.faces.map((f) => ({ ...f, v: [...f.v].reverse() })) };
  v = validate(m);
  const bad = new Set([...(v.nonPlanarFaces ?? []), ...(v.nonConvexFaces ?? [])]);
  if (bad.size) m = { ...m, faces: m.faces.flatMap((f, i) => (bad.has(i) ? fan(f) : [f])) };
  return m;
};

export const house = () => raw.objects.map((o) => ({ name: o.name, mesh: repair(o.mesh) }));

if (import.meta.url === `file://${process.argv[1]}`) {
  const objects = house();
  const open = objects.filter((o) => !validate(o.mesh).ok).map((o) => o.name);
  writeFileSync(new URL('./house.scene.json', import.meta.url), JSON.stringify({ objects }));
  console.log(`${objects.length} objects, ${objects.reduce((n, o) => n + o.mesh.faces.length, 0)} faces`);
  console.log('bounds', bounds(merge(...objects.map((o) => o.mesh))));
  console.log('not clean (open or odd):', open.join(', ') || 'none');
}
