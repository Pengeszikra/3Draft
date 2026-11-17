// The VR workshop: a floor and a workbench to carve at with bare hands (VR-WORKSHOP.md). The eye starts where you stand:
// in VR the floor of the room is the scene's floor (y = 0) under the eye, the bench is 0.6 m ahead at 0.9 m.
// `node examples/workshop.js` writes workshop.scene.json.

import { writeFileSync } from 'node:fs';
import { createScene } from '../mcp/scene.js';

export const workshop = () => {
  const s = createScene();
  const run = (tool, args) => {
    const r = s.call(tool, args);
    if (r.isError) throw new Error(`${tool}: ${r.text}`);
    return JSON.parse(r.text);
  };
  run('add_box', { name: 'floor', size: [6, 0.04, 6], at: [0, -0.02, 0], color: '#4a4d52' });
  run('add_box', { name: 'bench top', size: [1.4, 0.05, 0.7], at: [0, 0.875, -0.6], color: '#b88a55' });
  for (const [k, [x, z]] of [[-0.65, -0.3], [0.65, -0.3], [-0.65, -0.9], [0.65, -0.9]].entries()) run('add_box', { name: `bench leg ${k + 1}`, size: [0.06, 0.85, 0.06], at: [x, 0.425, z], color: '#6b4a2b' });
  const scene = JSON.parse(s.call('export', {}).text);
  return {
    ...(scene.json ? JSON.parse(scene.json) : scene),
    name: 'workshop',
    view: { light: true, smooth: false, edges: true },
    start: { eye: [0, 1.6, 0.1], yaw: 0, pitch: 12 },
  };
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const scene = workshop();
  console.log(scene.objects.length, 'objects');
  writeFileSync(new URL('./workshop.scene.json', import.meta.url), JSON.stringify(scene));
}
