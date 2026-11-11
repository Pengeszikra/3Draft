// Betterman moves: the scene in betterman.json (one body mesh, the hair as a second object, edited by hand in the
// viewer) has no skeleton stored in it. humanoidRig() reads one off the shape, posed() turns its joints.
// `node examples/betterman.js` writes examples/out/betterman.poses.svg and examples/out/betterman.walk.html
// (the flip book is not committed: it is 1.3 MB of frames).

import { readFileSync, writeFileSync } from 'node:fs';
import { humanoidRig, posed, walkPose, HUMANOID_POSES, renderView, merge, orbit, validate } from '../dist/index.js';

export const betterman = () => {
  const scene = JSON.parse(readFileSync(new URL('./betterman.json', import.meta.url), 'utf8'));
  const meshes = scene.objects.map((o) => o.mesh);
  return { scene, meshes, rig: humanoidRig(meshes) };
};

/** The scene's objects in a pose (same names, same order). */
export const bettermanIn = (pose, { scene, meshes, rig } = betterman()) =>
  posed(meshes, rig, pose, { ground: true }).map((mesh, i) => ({ ...scene.objects[i], mesh }));

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const man = betterman();
  const palette = Object.fromEntries(man.scene.palette.map(({ name, ...m }) => [name, m]));
  console.log(man.rig.joints.map((j) => `${j.name.padEnd(10)} ${j.at.map((v) => v.toFixed(3)).join(' ')}`).join('\n'));

  const figure = (pose, dx = 0) => {
    const objects = bettermanIn(pose, man);
    for (const o of objects) if (!validate(o.mesh).ok) console.warn('not a valid solid in this pose:', o.name);
    const m = merge(...objects.map((o) => o.mesh));
    return { ...m, positions: m.positions.map((p) => [p[0] + dx, p[1], p[2]]) };
  };
  const opts = { points: false, palette, stroke: '#00000030', background: '#6f7072' };
  const line = [HUMANOID_POSES.bind, HUMANOID_POSES.tpose, walkPose(0.02), walkPose(0.27), walkPose(0.1, { stride: 0.9, run: true }), HUMANOID_POSES.phone, HUMANOID_POSES.wave, HUMANOID_POSES.sit];
  writeFileSync(
    new URL('./out/betterman.poses.svg', import.meta.url),
    renderView(merge(...line.map((p, i) => figure(p, (i - 3.5) * 1.35))), orbit({ yaw: -0.4, pitch: 0.12 }), { ...opts, size: 1600, occlude: true }),
  );

  // a walk cycle as a flip book: 16 SVG frames through one fixed camera
  const fit = { center: [0, 0.93, 0], radius: 1.05 };
  const frames = Array.from({ length: 16 }, (_, i) =>
    renderView(figure(walkPose(i / 16)), orbit({ yaw: -0.6, pitch: 0.1 }), { ...opts, size: 520, occlude: true, fit }).replace('<svg ', '<svg class="f" '),
  );
  writeFileSync(
    new URL('./out/betterman.walk.html', import.meta.url),
    `<!doctype html><meta charset="utf-8"><title>3Draft betterman: walk cycle</title>
<style>body{margin:0;background:#6f7072;display:grid;place-items:center;min-height:100vh;font:13px monospace;color:#eee}.f{display:none}.f.on{display:block}</style>
<div>${frames.join('')}<p>betterman: humanoidRig() + walkPose(t), 16 SVG frames. Click: stop / go.</p></div>
<script>const f=[...document.querySelectorAll('.f')];let i=0,go=true;const step=()=>{f.forEach((e,k)=>e.classList.toggle('on',k===i));if(go)i=(i+1)%f.length};step();setInterval(step,70);onclick=()=>go=!go;</script>`,
  );
}
