// Flat SVG preview: points, edges, faces. No shading, no textures.
// Faces are painter-sorted (far first), back faces culled. The polygon stroke
// is the edge layer, so hidden edges stay hidden. Output is deterministic.

import { sub, dot } from './vec.js';
import { faceNormal } from './mesh.js';
import { VIEW_ORDER, makeCamera, project } from './camera.js';

const defaults = {
  size: 400,
  cull: true,
  points: true,
  stroke: '#1d1d1f',
  pointColor: '#d6336c',
  background: '#fafafa',
};

const num = (n) => String(Math.round(n * 100) / 100 + 0); // +0 turns -0 into 0

const panel = (mesh, name, o, x = 0, y = 0) => {
  const cam = makeCamera(name, mesh, o.size);
  const proj = mesh.positions.map((p) => project(cam, p));
  const items = [];

  mesh.faces.forEach((face, i) => {
    const world = face.v.map((k) => mesh.positions[k]);
    const screen = face.v.map((k) => proj[k]);
    if (screen.some((s) => s.depth <= 0.01)) return; // behind the camera
    const dir = cam.ortho ? cam.f : sub(world[0], cam.eye);
    if (o.cull && dot(faceNormal(world), dir) >= 0) return; // back face
    items.push({
      i,
      vs: face.v,
      color: face.color ?? '#c8c8c8',
      depth: screen.reduce((s, p) => s + p.depth, 0) / screen.length,
      pts: screen.map((p) => `${num(p.x)},${num(p.y)}`).join(' '),
    });
  });

  items.sort((a, b) => b.depth - a.depth || a.i - b.i); // far first

  // A point is drawn right after the nearest painted face that holds it, so
  // faces painted later (closer to the camera) still cover it.
  const last = new Map();
  items.forEach((it, idx) => it.vs.forEach((k) => last.set(k, idx)));

  const body = items.flatMap((it, idx) => {
    const polygon =
      `<polygon data-face="${it.i}" data-depth="${num(it.depth)}" points="${it.pts}" ` +
      `fill="${it.color}" stroke="${o.stroke}" stroke-width="1.5" stroke-linejoin="round"/>`;
    const dots = o.points
      ? it.vs
          .filter((k) => last.get(k) === idx)
          .sort((a, b) => a - b)
          .map(
            (k) =>
              `<circle data-v="${k}" cx="${num(proj[k].x)}" cy="${num(proj[k].y)}" r="3" fill="${o.pointColor}"/>`,
          )
      : [];
    return [polygon, ...dots];
  });

  return [
    `<g data-view="${name}" transform="translate(${x} ${y})">`,
    `<rect width="${o.size}" height="${o.size}" fill="${o.background}" stroke="#cfcfd4"/>`,
    `<text x="10" y="20" font-family="monospace" font-size="13" fill="#555">${name}</text>`,
    ...body,
    '</g>',
  ].join('\n');
};

const root = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${body}\n</svg>\n`;

/** One standalone SVG for a single view ('front' | 'side' | 'top' | 'persp'). */
export const renderView = (mesh, name, opts = {}) => {
  const o = { ...defaults, ...opts };
  return root(o.size, o.size, panel(mesh, name, o));
};

/** The four views one after another: [{ name, svg }, ...]. */
export const renderViews = (mesh, opts = {}) =>
  VIEW_ORDER.map((name) => ({ name, svg: renderView(mesh, name, opts) }));

/** All four views on one 2x2 sheet: front, side / top, persp. */
export const renderSheet = (mesh, opts = {}) => {
  const o = { ...defaults, ...opts };
  const body = VIEW_ORDER.map((name, i) =>
    panel(mesh, name, o, (i % 2) * o.size, Math.floor(i / 2) * o.size),
  ).join('\n');
  return root(o.size * 2, o.size * 2, body);
};
