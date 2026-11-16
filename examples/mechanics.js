// Mechanics: groups and joints, made with the MCP scene tools (the way an AI makes them). A hinged door in its frame (0…110°),
// a cart on a rail with a lamp glued to it, a lever on a pivot (limited), a weight hanging on a spring (with a coil stretched
// between its ends) and a grouped table. `node examples/mechanics.js` writes mechanics.scene.json.

import { writeFileSync } from 'node:fs';
import { createScene } from '../mcp/scene.js';

export const mechanics = () => {
  const s = createScene();
  const run = (tool, args) => {
    const r = s.call(tool, args);
    if (r.isError) throw new Error(`${tool}: ${r.text}`);
    return JSON.parse(r.text);
  };
  run('add_box', { name: 'floor', size: [12, 0.1, 8], at: [0, -0.05, 0], color: '#5a5f66' });
  // the door: a frame post and the door leaf, hinged on the leaf's left vertical edge
  run('add_box', { name: 'door post', size: [0.12, 2.2, 0.16], at: [-4, 1.1, -2], color: '#6b4a2b' });
  run('add_box', { name: 'door', size: [0.9, 2.05, 0.05], at: [-3.49, 1.05, -2], color: '#c79a5b' });
  run('add_box', { name: 'door knob', size: [0.06, 0.06, 0.12], at: [-3.15, 1.0, -2], color: '#e0c060' });
  run('connect', { type: 'glue', a: 'door', b: 'door knob', contact: [[-3.15, 1.0, -1.975]], name: 'knob glue' });
  run('connect', { type: 'hinge', a: 'door post', b: 'door', axis: [[-3.94, 0, -2], [-3.94, 2.2, -2]], limit: [0, 110], name: 'door hinge' });
  // the rail: a long base with a cart that slides along it, and a lamp glued on the cart
  run('add_box', { name: 'rail', size: [3, 0.08, 0.2], at: [0, 0.04, 1.5], color: '#8a9099' });
  run('add_box', { name: 'cart', size: [0.4, 0.2, 0.36], at: [-1, 0.18, 1.5], color: '#d9a441' });
  run('add_box', { name: 'lamp post', size: [0.05, 0.6, 0.05], at: [-1, 0.58, 1.5], color: '#33373c' });
  run('add_box', { name: 'lamp', size: [0.2, 0.12, 0.2], at: [-1, 0.94, 1.5], color: '#ffe9a8' });
  run('connect', { type: 'glue', a: 'cart', b: 'lamp post', contact: [[-1, 0.28, 1.5]] });
  run('connect', { type: 'glue', a: 'lamp post', b: 'lamp', contact: [[-1, 0.88, 1.5]] });
  run('connect', { type: 'rail', a: 'rail', b: 'cart', path: [[-1.5, 0.08, 1.5], [1.5, 0.08, 1.5]], slider: [-1, 0.08, 1.5], limit: [0.2, 2.8], name: 'cart rail' });
  // the lever: a block with an arm on a ball joint, limited
  run('add_box', { name: 'stand', size: [0.3, 1.2, 0.3], at: [3, 0.6, -1.5], color: '#4d6a8a' });
  run('add_box', { name: 'lever', size: [0.06, 0.9, 0.06], at: [3, 1.65, -1.5], color: '#c0392b' });
  run('add_box', { name: 'grip', size: [0.14, 0.14, 0.14], at: [3, 2.1, -1.5], color: '#222' });
  run('connect', { type: 'glue', a: 'lever', b: 'grip', contact: [[3, 2.1, -1.5]] });
  run('connect', { type: 'pivot', a: 'stand', b: 'lever', at: [3, 1.2, -1.5], limits: { x: [-45, 45], y: [-180, 180], z: [-45, 45] }, name: 'lever pivot' });
  // the spring: a gallows, a weight and a coil between them (the weight sits 0.3 below its rest: it swings at start)
  run('add_box', { name: 'gallows post', size: [0.12, 2.6, 0.12], at: [4.6, 1.3, 1.6], color: '#6b4a2b' });
  run('add_box', { name: 'gallows arm', size: [0.9, 0.1, 0.12], at: [4.2, 2.55, 1.6], color: '#6b4a2b' });
  run('connect', { type: 'glue', a: 'gallows post', b: 'gallows arm', contact: [[4.6, 2.55, 1.6]] });
  run('add_box', { name: 'weight', size: [0.3, 0.3, 0.3], at: [3.9, 0.9, 1.6], color: '#9b59b6' });
  run('add_box', { name: 'coil', size: [0.06, 1.4, 0.06], at: [3.9, 1.8, 1.6], color: '#bdc3c7' });
  run('connect', { type: 'spring', a: 'gallows arm', b: 'weight', at: [3.9, 2.5, 1.6], at_b: [3.9, 1.05, 1.6], rest_length: 1.15, stiffness: 30, damping: 1.2, spring_object: 'coil', name: 'spring' });
  // a table: five boxes in one group
  run('add_box', { name: 'table top', size: [1.4, 0.08, 0.8], at: [0, 0.76, -2], color: '#a0703c' });
  for (const [n, x, z] of [['leg 1', -0.62, -0.32], ['leg 2', 0.62, -0.32], ['leg 3', -0.62, 0.32], ['leg 4', 0.62, 0.32]]) run('add_box', { name: `table ${n}`, size: [0.07, 0.72, 0.07], at: [x, 0.36, -2 + z], color: '#7a5230' });
  run('group', { name: 'table', objects: ['table top', 'table leg 1', 'table leg 2', 'table leg 3', 'table leg 4'] });
  run('move_joint', { name: 'door hinge', angle: 35 });
  const scene = JSON.parse(s.call('export', {}).text);
  return {
    ...(scene.json ? JSON.parse(scene.json) : scene),
    name: 'mechanics',
    view: { light: true, smooth: false, edges: true },
    start: { eye: [0.5, 2.6, 6.2], yaw: 0, pitch: 18 },
  };
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const scene = mechanics();
  console.log(scene.objects.length, 'objects,', scene.joints.length, 'joints');
  writeFileSync(new URL('./mechanics.scene.json', import.meta.url), JSON.stringify(scene));
}
