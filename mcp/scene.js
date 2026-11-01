// The model and its tools. One scene of named objects (meshes), edited by tool calls
// and judged by the deterministic SVG preview. No I/O except save/load of JSON files
// under the working directory. The MCP transport is in server.js.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { box, extrude, merge, rotate, bounds, makeCamera, orbit, pick, renderView, renderSheet, validate, VIEW_ORDER } from '../src/index.js';

export class ToolError extends Error {}
const fail = (message) => {
  throw new ToolError(message);
};

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const rv = (v) => v.map(r6);
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

const vec3 = (v, what, fallback) => {
  if (v === undefined) return fallback ?? fail(`${what} is required`);
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(`${what} must be [x, y, z], three numbers`);
  return v;
};
const name = (v) => {
  if (typeof v !== 'string' || !v.trim() || v.length > 64) fail('name must be a non-empty string of at most 64 characters');
  return v;
};
const color = (v, fallback = '#c8c8c8') => {
  if (v === undefined) return fallback;
  if (typeof v !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) fail('color must be #rgb or #rrggbb');
  return v;
};
const number = (v, what, { min = -Infinity, max = Infinity, fallback } = {}) => {
  if (v === undefined) return fallback ?? fail(`${what} is required`);
  if (!isNum(v) || v < min || v > max) fail(`${what} must be a number between ${min} and ${max}`);
  return v;
};

/** Validates raw mesh data from a client: positions [[x,y,z]], faces [{ v: [indices], color? }]. */
const parseMesh = (positions, faces, fallbackColor) => {
  if (!Array.isArray(positions) || positions.length < 3) fail('positions must be a list of at least 3 [x, y, z] points');
  positions.forEach((p, i) => vec3(p, `positions[${i}]`));
  if (!Array.isArray(faces) || !faces.length) fail('faces must be a non-empty list of { v: [indices], color? }');
  const out = faces.map((f, i) => {
    const v = f?.v;
    if (!Array.isArray(v) || v.length < 3) fail(`faces[${i}].v needs at least 3 vertex indices`);
    v.forEach((k) => {
      if (!Number.isInteger(k) || k < 0 || k >= positions.length) fail(`faces[${i}].v has index ${k}, but there are ${positions.length} positions`);
    });
    return { v: [...v], color: color(f.color, fallbackColor) };
  });
  return { positions: positions.map((p) => [...p]), faces: out };
};

const extent = (mesh) => {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.positions) {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], p[a]);
      max[a] = Math.max(max[a], p[a]);
    }
  }
  return { min: rv(min), max: rv(max) };
};

const safePath = (p) => {
  if (typeof p !== 'string' || !p) fail('path must be a string');
  const full = resolve(process.cwd(), p);
  const rel = relative(process.cwd(), full);
  if (rel.startsWith('..') || isAbsolute(rel)) fail('path must stay inside the server working directory');
  if (extname(full) !== '.json') fail('path must end in .json');
  return full;
};

const vec3Schema = { type: 'array', items: { type: 'number' }, minItems: 3, maxItems: 3 };
const nameSchema = { type: 'string', description: 'Object name, unique in the scene.' };
const colorSchema = { type: 'string', description: 'Face color, #rgb or #rrggbb.' };
const replaceSchema = { type: 'boolean', description: 'Overwrite an existing object with this name.' };
const viewProps = {
  view: {
    type: 'string',
    enum: [...VIEW_ORDER, 'sheet', 'orbit'],
    description: "front (eye on +z), side (eye on +x), top (eye on +y, -z is up), persp, orbit (uses yaw/pitch) or sheet (all four views on one 2x2 sheet; render only). Default: sheet for render, persp for pick.",
  },
  yaw: { type: 'number', description: 'orbit view, degrees: 0 looks from +z, 90 from -x, -90 from +x.' },
  pitch: { type: 'number', description: 'orbit view, degrees above the horizon (default 25).' },
  size: { type: 'number', description: 'Panel size in pixels, default 320.' },
};

export const createScene = () => {
  const objects = new Map();

  const need = (n) => objects.get(name(n)) ?? fail(`no object named "${n}". Use list to see the objects.`);
  const put = (n, mesh, replace) => {
    name(n);
    if (objects.has(n) && !replace) fail(`"${n}" already exists; pass replace: true to overwrite it, or pick another name.`);
    objects.set(n, mesh);
    return summary(n, mesh);
  };
  const summary = (n, mesh) => ({ name: n, vertices: mesh.positions.length, faces: mesh.faces.length, ...extent(mesh) });

  const combined = () => {
    const names = [...objects.keys()];
    const meshes = names.map((n) => objects.get(n));
    const owners = [];
    let start = 0;
    names.forEach((n, i) => {
      owners.push({ name: n, start, end: start + meshes[i].faces.length });
      start += meshes[i].faces.length;
    });
    return { mesh: merge(...meshes), owners };
  };

  const viewOf = (args, fallback) => {
    const v = args.view ?? fallback;
    if (v === 'orbit') {
      const yaw = (number(args.yaw, 'yaw', { fallback: 35 }) * Math.PI) / 180;
      const pitch = (number(args.pitch, 'pitch', { min: -90, max: 90, fallback: 25 }) * Math.PI) / 180;
      return orbit({ yaw, pitch });
    }
    if (VIEW_ORDER.includes(v) || v === 'sheet') return v;
    return fail(`unknown view "${v}"`);
  };

  const tools = [
    {
      name: 'add_box',
      description: 'Add an axis-aligned box. `at` is the CENTER, so its bottom is at at[1] - size[1] / 2. Y is up, the ground is y = 0. Units are arbitrary but keep them consistent.',
      inputSchema: {
        type: 'object',
        properties: { name: nameSchema, size: { ...vec3Schema, description: '[width x, height y, depth z], default [1,1,1].' }, at: { ...vec3Schema, description: 'center, default [0,0,0].' }, color: colorSchema, replace: replaceSchema },
        required: ['name'],
      },
      run: (a) => put(name(a.name), box({ size: vec3(a.size, 'size', [1, 1, 1]), at: vec3(a.at, 'at', [0, 0, 0]), color: color(a.color) }), a.replace),
    },
    {
      name: 'add_extrusion',
      description: 'Add a prism: a CONVEX footprint polygon on the ground plane, given as [[x, z], ...] in any winding, extruded up by `height` from `y`. Use it for triangles, hexagons, wedges, roofs, columns. Concave shapes must be split into several convex extrusions.',
      inputSchema: {
        type: 'object',
        properties: { name: nameSchema, polygon: { type: 'array', items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 }, minItems: 3, description: '[[x, z], ...]' }, height: { type: 'number' }, y: { type: 'number', description: 'bottom, default 0' }, color: colorSchema, replace: replaceSchema },
        required: ['name', 'polygon', 'height'],
      },
      run: (a) => {
        if (!Array.isArray(a.polygon) || a.polygon.length < 3 || !a.polygon.every((p) => Array.isArray(p) && p.length === 2 && p.every(isNum))) fail('polygon must be [[x, z], ...] with at least 3 points');
        let mesh;
        try {
          mesh = extrude({ polygon: a.polygon, height: number(a.height, 'height', { min: 1e-9 }), y: number(a.y, 'y', { fallback: 0 }), color: color(a.color) });
        } catch (e) {
          fail(e.message);
        }
        return put(name(a.name), mesh, a.replace);
      },
    },
    {
      name: 'add_mesh',
      description: 'Add a raw mesh: `positions` [[x,y,z],...] and `faces` [{ v: [indices], color }]. Each face must be planar, convex and listed COUNTER-CLOCKWISE seen from outside (right-hand rule: the normal points out). Run inspect afterwards.',
      inputSchema: {
        type: 'object',
        properties: {
          name: nameSchema,
          positions: { type: 'array', items: vec3Schema },
          faces: { type: 'array', items: { type: 'object', properties: { v: { type: 'array', items: { type: 'integer' }, minItems: 3 }, color: colorSchema }, required: ['v'] } },
          color: { ...colorSchema, description: 'Default color for faces without one.' },
          replace: replaceSchema,
        },
        required: ['name', 'positions', 'faces'],
      },
      run: (a) => put(name(a.name), parseMesh(a.positions, a.faces, color(a.color)), a.replace),
    },
    {
      name: 'transform',
      description: 'Scale, then rotate around the Y axis, then move an object. Scale and rotation are about the center of its bounding box.',
      inputSchema: {
        type: 'object',
        properties: { name: nameSchema, scale: { description: 'Positive number, or [sx, sy, sz].', oneOf: [{ type: 'number' }, vec3Schema] }, rotate_y: { type: 'number', description: 'degrees, counter-clockwise seen from above' }, move: { ...vec3Schema, description: 'translation [dx, dy, dz]' } },
        required: ['name'],
      },
      run: (a) => {
        let mesh = need(a.name);
        const { min, max } = extent(mesh);
        const c = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
        if (a.scale !== undefined) {
          const s = isNum(a.scale) ? [a.scale, a.scale, a.scale] : vec3(a.scale, 'scale');
          if (!s.every((v) => v > 0)) fail('scale must be positive');
          mesh = { ...mesh, positions: mesh.positions.map((p) => p.map((v, i) => c[i] + (v - c[i]) * s[i])) };
        }
        if (a.rotate_y !== undefined) {
          const yaw = (number(a.rotate_y, 'rotate_y') * Math.PI) / 180;
          mesh = rotate(mesh, { yaw }, c);
        }
        if (a.move !== undefined) {
          const d = vec3(a.move, 'move');
          mesh = { ...mesh, positions: mesh.positions.map((p) => p.map((v, i) => v + d[i])) };
        }
        objects.set(a.name, mesh);
        return summary(a.name, mesh);
      },
    },
    {
      name: 'recolor',
      description: 'Change the color of a whole object, or of one face when `face` is given.',
      inputSchema: { type: 'object', properties: { name: nameSchema, color: colorSchema, face: { type: 'integer', description: 'face index inside the object' } }, required: ['name', 'color'] },
      run: (a) => {
        const mesh = need(a.name);
        const c = color(a.color);
        if (a.face !== undefined && (!Number.isInteger(a.face) || a.face < 0 || a.face >= mesh.faces.length)) fail(`face must be 0..${mesh.faces.length - 1}`);
        objects.set(a.name, { ...mesh, faces: mesh.faces.map((f, i) => (a.face === undefined || a.face === i ? { ...f, color: c } : f)) });
        return summary(a.name, objects.get(a.name));
      },
    },
    {
      name: 'remove',
      description: 'Remove one object.',
      inputSchema: { type: 'object', properties: { name: nameSchema }, required: ['name'] },
      run: (a) => {
        need(a.name);
        objects.delete(a.name);
        return { removed: a.name, objects: objects.size };
      },
    },
    { name: 'clear', description: 'Remove every object.', inputSchema: { type: 'object', properties: {} }, run: () => {
      const n = objects.size;
      objects.clear();
      return { removed: n };
    } },
    {
      name: 'list',
      description: 'List the objects with their face counts and axis-aligned bounds (min / max corners).',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      run: () => ({ objects: [...objects].map(([n, m]) => summary(n, m)), scene: objects.size ? extent(combined().mesh) : null }),
    },
    {
      name: 'inspect',
      description: 'Check an object (or all when name is omitted): closed shell, faces CCW from outside, planar, convex. Returns plain-text notes about what to fix. Run it after add_mesh.',
      inputSchema: { type: 'object', properties: { name: nameSchema } },
      annotations: { readOnlyHint: true },
      run: (a) => {
        const names = a.name === undefined ? [...objects.keys()] : [name(a.name)];
        return { checked: names.map((n) => ({ name: n, ...validate(need(n)) })) };
      },
    },
    {
      name: 'render',
      description: 'Render the scene as a flat-colored SVG with edges and points (text, deterministic). Default is a 2x2 sheet of front, side, top and perspective. Each <polygon data-face=".."> is one face, <circle data-v=".."> a vertex. Look at it to judge the model, then fix and render again.',
      inputSchema: { type: 'object', properties: { ...viewProps, points: { type: 'boolean', description: 'draw vertices, default true' } } },
      annotations: { readOnlyHint: true },
      run: (a) => {
        const { mesh } = combined();
        const view = viewOf(a, 'sheet');
        const opts = { size: number(a.size, 'size', { min: 64, max: 2000, fallback: 320 }), points: a.points ?? true };
        return { text: view === 'sheet' ? renderSheet(mesh, opts) : renderView(mesh, view, opts) };
      },
    },
    {
      name: 'pick',
      description: 'What is at pixel (x, y) of a render? Uses the same camera and size as render. Returns the object, its face index, the 3D point, the surface normal and the distance. Use it to find coordinates to place or stack things.',
      inputSchema: { type: 'object', properties: { ...viewProps, x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
      annotations: { readOnlyHint: true },
      run: (a) => {
        const { mesh, owners } = combined();
        const view = viewOf(a, 'persp');
        if (view === 'sheet') fail('pick needs a single view, not the sheet');
        const size = number(a.size, 'size', { min: 64, max: 2000, fallback: 320 });
        const hit = pick(mesh, makeCamera(view, mesh, size, bounds(mesh)), number(a.x, 'x'), number(a.y, 'y'));
        if (!hit) return { hit: null };
        const o = owners.find((w) => hit.face >= w.start && hit.face < w.end);
        return { hit: { object: o.name, face: hit.face - o.start, point: rv(hit.point), normal: rv(hit.normal), distance: r6(hit.distance), color: hit.color } };
      },
    },
    {
      name: 'export',
      description: 'Return the scene as JSON, or write it to `path` (relative, inside the server working directory, must end in .json).',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      annotations: { readOnlyHint: true },
      run: (a) => {
        const data = { format: '3draft-scene', version: 1, objects: [...objects].map(([n, mesh]) => ({ name: n, mesh })) };
        if (a.path === undefined) return { text: JSON.stringify(data) };
        writeFileSync(safePath(a.path), JSON.stringify(data));
        return { written: a.path, objects: objects.size };
      },
    },
    {
      name: 'import',
      description: 'Replace the scene with a JSON scene, given as `json` text or read from `path` (same rules as export).',
      inputSchema: { type: 'object', properties: { json: { type: 'string' }, path: { type: 'string' } } },
      run: (a) => {
        if ((a.json === undefined) === (a.path === undefined)) fail('give exactly one of json or path');
        let data;
        try {
          data = JSON.parse(a.json ?? readFileSync(safePath(a.path), 'utf8'));
        } catch (e) {
          fail(`could not read the scene: ${e.message}`);
        }
        if (data?.format !== '3draft-scene' || !Array.isArray(data.objects)) fail('not a 3draft scene (format, objects)');
        const next = new Map();
        for (const o of data.objects) {
          name(o?.name);
          next.set(o.name, parseMesh(o.mesh?.positions, o.mesh?.faces));
        }
        objects.clear();
        for (const [k, v] of next) objects.set(k, v);
        return { objects: objects.size };
      },
    },
  ];

  /** Runs a tool: { text, isError }. Plain objects come back as JSON text. */
  const call = (toolName, args = {}) => {
    const tool = tools.find((t) => t.name === toolName);
    if (!tool) return { isError: true, text: `unknown tool "${toolName}"` };
    if (args === null || typeof args !== 'object' || Array.isArray(args)) return { isError: true, text: 'arguments must be an object' };
    try {
      const out = tool.run(args);
      return { isError: false, text: out?.text ?? JSON.stringify(out, null, 1) };
    } catch (e) {
      return { isError: true, text: e instanceof ToolError ? e.message : `internal error: ${e.message}` };
    }
  };

  const list = () => tools.map(({ name: n, description, inputSchema, annotations }) => ({ name: n, description, inputSchema, ...(annotations ? { annotations } : {}) }));

  return { call, list, objects };
};
