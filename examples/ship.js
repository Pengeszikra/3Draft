// The RW-7 "Redneck Wreck" from github.com/Pengeszikra/redneck-wreck (src/ship): hull, nacelles, tanks, drive block,
// landing gear, belly ramp, dorsal crane and the interior (cockpit, crew deck, cargo hold, engineering, ops bay),
// baked once by examples/ship-support/extract.mjs. No textures: only plain palette materials. Metres, nose to -Z, y up.
// `node examples/ship.js` writes examples/ship.scene.json.

import { writeFileSync } from 'node:fs';
import { validate } from '../dist/index.js';
import { SHIP } from './data/ship-mesh.js';

export const ship = () => SHIP;

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { palette, objects } = ship();
  const bad = objects.filter((o) => !validate(o.mesh).ok);
  for (const o of bad) console.log('invalid', o.name, validate(o.mesh).errors?.slice?.(0, 3) ?? '');
  console.log(objects.map((o) => `${o.name}:${o.mesh.faces.length}`).join(' '));
  writeFileSync(new URL('./ship.scene.json', import.meta.url), JSON.stringify({ format: '3draft-scene', version: 1, palette, objects }));
}
