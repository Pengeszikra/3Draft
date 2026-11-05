// WebGPU renderer: flat-colored faces, one simple lit material, one global light.
// It draws the same scene through the same camera as the SVG renderer, so picking,
// the cross marks and the framing all stay valid. The pure helpers (viewProjection,
// buildVertices) need no GPU and are unit tested; createGpu() needs a browser.
import { dot, norm } from './vec.js';
import { bounds, faceNormal } from './mesh.js';
import { makeCamera } from './camera.js';
import { surfaceOf } from './material.js';
const FLOATS = 14; // position(3) normal(3) color(3) material(4: metal, rough, alpha, emit) soft(1)
/**
 * Column-major 4x4 matrix (for WebGPU, z in 0..1) that maps world points exactly
 * like camera.project(): the same pixels, plus a depth between near and far.
 */
export const viewProjection = (cam, near = 0.03, far = 1000) => {
    const kk = cam.k / (cam.size / 2);
    const row = (v, s) => [v[0] * s, v[1] * s, v[2] * s, -dot(v, cam.eye) * s];
    const a = cam.ortho ? 1 / (far - near) : far / (far - near);
    const zr = row(cam.f, a);
    zr[3] -= a * near;
    const rows = [row(cam.r, kk), row(cam.u, kk), zr, cam.ortho ? [0, 0, 0, 1] : row(cam.f, 1)];
    const m = new Float32Array(16);
    rows.forEach((r, i) => r.forEach((v, j) => (m[j * 4 + i] = v)));
    return m;
};
const rgb = (color) => {
    const h = String(color ?? '').replace('#', '');
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    if (!/^[0-9a-f]{6}$/i.test(full))
        return [0.78, 0.78, 0.78];
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};
/**
 * Smooth shading: a normal for every corner of every face. The faces that meet at a point (welded by position, so a
 * crack in the indices does not break it) are averaged, weighted by area, but only those within `crease` degrees of
 * this face: a 90 degree box corner stays sharp, a faceted fuselage becomes round.
 */
export const cornerNormals = (mesh, crease) => {
    const cosC = Math.cos((crease * Math.PI) / 180);
    const area = mesh.faces.map((f) => faceNormal(f.v.map((k) => mesh.positions[k]))); // length = area
    const unit = area.map((n) => (Math.hypot(...n) > 0 ? norm(n) : [0, 1, 0]));
    const q = (bounds(mesh).radius || 1) * 1e-6;
    const key = (p) => `${Math.round(p[0] / q)},${Math.round(p[1] / q)},${Math.round(p[2] / q)}`;
    const at = new Map();
    mesh.faces.forEach((f, i) => f.v.forEach((k) => {
        const id = key(mesh.positions[k]);
        const list = at.get(id) ?? [];
        if (list[list.length - 1] !== i)
            list.push(i);
        at.set(id, list);
    }));
    return mesh.faces.map((f, i) => f.v.map((k) => {
        const sum = [0, 0, 0];
        for (const j of at.get(key(mesh.positions[k])) ?? []) {
            if (dot(unit[i], unit[j]) < cosC)
                continue;
            for (let c = 0; c < 3; c++)
                sum[c] += area[j][c];
        }
        return Math.hypot(...sum) > 0 ? norm(sum) : unit[i];
    }));
};
/**
 * Triangle list for the GPU: face normals (flat, or smoothed with `smooth` degrees), face colors and materials.
 * Float32Array, 14 floats per vertex.
 */
export const buildVertices = (mesh, palette, { smooth = 0 } = {}) => {
    let tris = 0;
    for (const f of mesh.faces)
        tris += Math.max(0, f.v.length - 2);
    const out = new Float32Array(tris * 3 * FLOATS);
    const corners = smooth > 0 ? cornerNormals(mesh, smooth) : null;
    let o = 0;
    mesh.faces.forEach((face, fi) => {
        const pts = face.v.map((k) => mesh.positions[k]);
        const flat = norm(faceNormal(pts));
        const s = surfaceOf(face, palette);
        const c = rgb(s.color);
        const mat = [s.metal, s.rough, s.alpha, s.emit];
        for (let j = 1; j < pts.length - 1; j++) {
            for (const k of [0, j, j + 1]) {
                out.set([...pts[k], ...(corners ? corners[fi][k] : flat), ...c, ...mat, s.soft], o);
                o += FLOATS;
            }
        }
    });
    return out;
};
const INSTANCE_FLOATS = 15; // at(3) ex(3) ey(3) ez(3) color(3)
/**
 * Per-instance data for drawInstances: one entry { at, axes: [ex, ey, ez], color } per copy of a
 * prototype mesh (modelled around the origin). Float32Array, 15 floats per instance.
 */
export const buildInstances = (items) => {
    const out = new Float32Array(items.length * INSTANCE_FLOATS);
    items.forEach((it, i) => out.set([...it.at, ...it.axes[0], ...it.axes[1], ...it.axes[2], ...rgb(it.color)], i * INSTANCE_FLOATS));
    return out;
};
export const defaultLight = { direction: norm([0.5, 0.8, 0.6]), sky: [1, 0.97, 0.92], ground: [0.42, 0.38, 0.36] };
export const defaultMaterial = { ambient: 0.62, diffuse: 0.78, specular: 0.2, shininess: 30 };
const SHADER = /* wgsl */ `
struct U {
  vp : mat4x4<f32>,
  light : vec4<f32>,   // xyz: direction towards the light
  sky : vec4<f32>,
  ground : vec4<f32>,
  eye : vec4<f32>,
  mat : vec4<f32>,     // ambient, diffuse, specular, shininess
  fx : vec4<f32>,      // filmic (0 or 1), exposure, emission gain, studio (0 or 1)
  fill : vec4<f32>,    // studio: xyz direction towards the fill light, w intensity
  rim : vec4<f32>,     // studio: xyz direction towards the rim light, w intensity
};
@group(0) @binding(0) var<uniform> u : U;

struct VIn { @location(0) pos : vec3<f32>, @location(1) nrm : vec3<f32>, @location(2) col : vec3<f32>, @location(8) mat : vec4<f32>, @location(9) soft : f32 };
struct VOut {
  @builtin(position) p : vec4<f32>,
  @location(0) n : vec3<f32>,
  @location(1) c : vec3<f32>,
  @location(2) w : vec3<f32>,
  @location(3) m : vec4<f32>,   // metal, rough, alpha, emit
  @location(4) s : f32,         // soft
};

@vertex fn vs(i : VIn) -> VOut {
  var o : VOut;
  o.p = u.vp * vec4<f32>(i.pos, 1.0);
  o.n = i.nrm;
  o.c = i.col;
  o.w = i.pos;
  o.m = i.mat;
  o.s = i.soft;
  return o;
}

struct IIn {
  @location(0) pos : vec3<f32>, @location(1) nrm : vec3<f32>,
  @location(3) at : vec3<f32>, @location(4) ex : vec3<f32>, @location(5) ey : vec3<f32>, @location(6) ez : vec3<f32>,
  @location(7) col : vec3<f32>,
};

// the same prototype drawn many times: its frame (ex, ey, ez, scaled axes scale it) and position come per instance
@vertex fn vsi(i : IIn) -> VOut {
  var o : VOut;
  let w = i.at + i.ex * i.pos.x + i.ey * i.pos.y + i.ez * i.pos.z;
  o.p = u.vp * vec4<f32>(w, 1.0);
  // the axes may be scaled (a thin long bar from the same prototype): normals follow the unit axes
  o.n = normalize(i.ex) * i.nrm.x + normalize(i.ey) * i.nrm.y + normalize(i.ez) * i.nrm.z;
  o.c = i.col;
  o.w = w;
  o.m = vec4<f32>(0.0, 0.7, 1.0, 0.0);
  o.s = 0.0;
  return o;
}

fn toLinear(c : vec3<f32>) -> vec3<f32> {
  return select(pow((c + 0.055) / 1.055, vec3<f32>(2.4)), c / 12.92, c <= vec3<f32>(0.04045));
}
fn toSrgb(c : vec3<f32>) -> vec3<f32> {
  return select(1.055 * pow(c, vec3<f32>(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3<f32>(0.0031308));
}
// ACES filmic curve (Narkowicz fit): highlights roll off softly instead of clipping
fn aces(x : vec3<f32>) -> vec3<f32> {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3<f32>(0.0), vec3<f32>(1.0));
}

// Direct light, shared by both looks: x diffuse, y highlight, z scattered light (soft materials).
// Studio: the key light is u.light (placed by the camera), plus a softer fill and a rim light that only edges the shape.
fn lights(n : vec3<f32>, v : vec3<f32>, shin : f32, soft : f32) -> vec3<f32> {
  let key = normalize(u.light.xyz);
  let ndl = dot(n, key);
  // soft: the light wraps round the form, and a warm band of scattered light sits where light turns to shade
  var diff = max((ndl + soft) / (1.0 + soft), 0.0);
  let h = normalize(key + v);
  var spec = pow(max(dot(n, h), 0.0), shin) * step(0.0, ndl);
  let scat = soft * exp(-ndl * ndl * 5.0);
  if (u.fx.w > 0.5) {
    diff = diff * 0.85; // three lights add up: the key takes a little less
    let fl = normalize(u.fill.xyz);
    diff = diff + max((dot(n, fl) + soft) / (1.0 + soft), 0.0) * u.fill.w;
    let rl = normalize(u.rim.xyz);
    let edge = pow(1.0 - max(dot(n, v), 0.0), 2.5);
    diff = diff + max(dot(n, rl), 0.0) * edge * u.rim.w * 2.0;
    let rh = normalize(rl + v);
    spec = spec + pow(max(dot(n, rh), 0.0), shin) * step(0.0, dot(n, rl)) * u.rim.w * 0.6 * edge;
  }
  return vec3<f32>(diff, spec, scat);
}

// The filmic path: the same light model, but in linear colour with HDR light and emission, then tone mapped.
fn filmic(i : VOut, n : vec3<f32>, l : vec3<f32>, v : vec3<f32>) -> vec4<f32> {
  let metal = i.m.x;
  let rough = i.m.y;
  let albedo = toLinear(i.c);
  let hemi = mix(toLinear(u.ground.rgb), toLinear(u.sky.rgb), n.y * 0.5 + 0.5) * u.mat.x * select(1.0, 0.7, u.fx.w > 0.5);
  let shin = mix(u.mat.w * 7.0, u.mat.w * 0.15, rough);
  let lt = lights(n, v, shin, i.s);
  let diff = lt.x * u.mat.y * 1.6;
  let spec = lt.y * mix(u.mat.z, 1.0, metal) * mix(1.0, 0.35, rough) * 2.5;
  let r = reflect(-v, n);
  // Schlick: edges mirror more, metal keeps its tint
  let f0 = mix(vec3<f32>(0.04), albedo, metal);
  let fres = f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - max(dot(n, v), 0.0), 5.0) * (1.0 - rough);
  let env = mix(toLinear(u.ground.rgb) * 1.2, toLinear(u.sky.rgb) * 1.5, smoothstep(-0.25 - rough * 0.5, 0.25 + rough * 0.5, r.y));
  var lit = albedo * (hemi + vec3<f32>(diff)) * (1.0 - metal)
          + albedo * env * metal * (1.0 - 0.6 * rough)
          + env * fres * (1.0 - rough) * 0.5
          + vec3<f32>(spec) * mix(vec3<f32>(1.0), albedo, metal);
  // emission adds light, so a lamp can go above 1.0 and still keep its colour after tone mapping
  lit = lit + albedo * vec3<f32>(1.0, 0.38, 0.26) * lt.z * 0.5 * (1.0 - metal); // soft: the warm scattered band
  lit = lit + albedo * i.m.w * u.fx.z;
  return vec4<f32>(toSrgb(aces(lit * u.fx.y)), i.m.z);
}

@fragment fn fs(i : VOut, @builtin(front_facing) front : bool) -> @location(0) vec4<f32> {
  var n = normalize(i.n);
  if (!front) { n = -n; }
  let l = normalize(u.light.xyz);
  let v = normalize(u.eye.xyz - i.w);
  if (u.fx.x > 0.5) { return filmic(i, n, l, v); }
  let metal = i.m.x;
  let rough = i.m.y;
  let hemi = mix(u.ground.rgb, u.sky.rgb, n.y * 0.5 + 0.5) * u.mat.x * select(1.0, 0.7, u.fx.w > 0.5);
  // roughness widens the highlight; metal makes it strong and tinted by the color
  let shin = mix(u.mat.w * 7.0, u.mat.w * 0.15, rough);
  let lt = lights(n, v, shin, i.s);
  let diff = lt.x * u.mat.y;
  let spec = lt.y * mix(u.mat.z, 1.0, metal) * mix(1.0, 0.35, rough);
  // metal mirrors the sky above and the ground below, blurred by roughness
  let r = reflect(-v, n);
  let env = mix(u.ground.rgb * 1.2, u.sky.rgb * 1.5, smoothstep(-0.25 - rough * 0.5, 0.25 + rough * 0.5, r.y));
  var lit = i.c * (hemi + vec3<f32>(diff)) * (1.0 - metal)
          + i.c * env * metal * (1.0 - 0.6 * rough)
          + vec3<f32>(spec) * mix(vec3<f32>(1.0), i.c, metal)
          + i.c * vec3<f32>(1.0, 0.38, 0.26) * lt.z * 0.25 * (1.0 - metal);
  lit = mix(lit, i.c * 1.15, min(i.m.w, 1.0)); // the plain look: emit 0..1 fades to flat colour, more does not add
  return vec4<f32>(clamp(lit, vec3<f32>(0.0), vec3<f32>(1.0)), i.m.z);
}
`;
/**
 * Sets up WebGPU on a canvas. Rejects when WebGPU is not available.
 * Returns { render(mesh, view, options), destroy() }.
 * render options: size (CSS px, the canvas is made size x size), fit, instances { mesh, data } (many copies of one
 * prototype mesh, data from buildInstances; drawn after the mesh), background [r,g,b] 0..1,
 * light { direction, sky, ground }, material { ambient, diffuse, specular, shininess }, dpr.
 */
export const createGpu = async (canvas, { sampleCount = 4 } = {}) => {
    if (!globalThis.navigator?.gpu)
        throw new Error('WebGPU is not available in this browser');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter)
        throw new Error('No WebGPU adapter found');
    const device = await adapter.requestDevice();
    device.addEventListener('uncapturederror', (e) => console.error('WebGPU:', e.error?.message ?? e));
    device.lost.then((info) => console.error('WebGPU device lost:', info.reason, info.message));
    const context = canvas.getContext('webgpu');
    if (!context)
        throw new Error('Could not get a WebGPU canvas context');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'opaque', });
    const module = device.createShaderModule({ code: SHADER });
    const meshLayout = {
        arrayStride: FLOATS * 4,
        attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
            { shaderLocation: 2, offset: 24, format: 'float32x3' },
            { shaderLocation: 8, offset: 36, format: 'float32x4' },
            { shaderLocation: 9, offset: 52, format: 'float32' },
        ],
    };
    const instanceLayout = {
        arrayStride: INSTANCE_FLOATS * 4,
        stepMode: 'instance',
        attributes: [3, 4, 5, 6, 7].map((loc, k) => ({ shaderLocation: loc, offset: k * 12, format: 'float32x3' })),
    };
    const make = (entry, buffers, glass = false) => device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: entry, buffers },
        fragment: {
            module,
            entryPoint: 'fs',
            targets: [
                glass
                    ? {
                        format,
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                        },
                    }
                    : { format },
            ],
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        // see-through faces (alpha < 1) are blended over what is behind them: they test depth but do not write it
        depthStencil: { format: 'depth24plus', depthWriteEnabled: !glass, depthCompare: 'less' },
        multisample: { count: sampleCount },
    });
    const pipeline = make('vs', [meshLayout]);
    const glassPipeline = make('vs', [meshLayout], true);
    // the instanced pipeline reads position and normal only from the prototype (locations 0, 1)
    const instPipeline = make('vsi', [{ ...meshLayout, attributes: meshLayout.attributes.slice(0, 2) }, instanceLayout]);
    const uniforms = device.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniforms } }] });
    const instBind = device.createBindGroup({ layout: instPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniforms } }] });
    // Geometry that did not change since the last frame is not rebuilt or uploaded again.
    let uploaded = null; // the mesh now in vertexBuffer
    let uploadedPalette; // and the palette it was built with
    let uploadedSmooth = 0; // and the smoothing
    let vertexCount = 0;
    let protoMesh = null;
    let protoBuffer = null;
    let protoCount = 0;
    let instBuffer = null;
    let instCapacity = 0;
    let instData = null;
    let instCount = 0;
    let vertexBuffer = null;
    let capacity = 0;
    let glassBuffer = null; // the see-through triangles, sorted far to near for the eye
    let glassCapacity = 0;
    let glassTris = []; // centroid and offset (in floats) in glassSource
    let glassSource = new Float32Array(0);
    let glassCount = 0;
    let glassEye = '';
    let px = 0;
    let depth = null;
    let color = null;
    const targets = (n) => {
        if (n === px)
            return;
        px = n;
        canvas.width = n;
        canvas.height = n;
        depth?.destroy();
        color?.destroy();
        depth = device.createTexture({ size: [n, n], format: 'depth24plus', sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        color = sampleCount > 1 ? device.createTexture({ size: [n, n], format, sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT }) : null;
    };
    const draw = (mesh, view, { size = 400, fit, background = [0.98, 0.98, 0.97], light = {}, material = {}, palette, dpr = globalThis.devicePixelRatio || 1, instances, tonemap = false, smooth = false, studio = false } = {}, readback = false) => {
        const L = { ...defaultLight, ...light };
        const filmic = tonemap ? { exposure: 1, emit: 2, ...(tonemap === true ? {} : tonemap) } : null;
        const M = { ...defaultMaterial, ...material };
        const cam = makeCamera(view, mesh, size, fit);
        targets(Math.max(1, Math.round(size * dpr)));
        const crease = smooth === true ? 40 : smooth || 0;
        if (mesh !== uploaded || palette !== uploadedPalette || crease !== uploadedSmooth) {
            uploadedSmooth = crease;
            const all = buildVertices(mesh, palette, { smooth: crease });
            // split: solid triangles are drawn first; triangles with alpha < 1 are kept apart and blended afterwards
            const tri = 3 * FLOATS;
            const solid = [];
            glassTris = [];
            for (let o = 0; o < all.length; o += tri) {
                if (all[o + 11] < 1) {
                    const c = [0, 1, 2].map((k) => (all[o + k] + all[o + FLOATS + k] + all[o + 2 * FLOATS + k]) / 3);
                    glassTris.push({ c, at: o });
                }
                else
                    for (let k = 0; k < tri; k++)
                        solid.push(all[o + k]);
            }
            glassSource = all;
            glassEye = '';
            const verts = Float32Array.from(solid);
            if (verts.byteLength > capacity) {
                vertexBuffer?.destroy();
                capacity = Math.max(verts.byteLength, 4096);
                vertexBuffer = device.createBuffer({ size: capacity, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            }
            if (verts.byteLength)
                device.queue.writeBuffer(vertexBuffer, 0, verts);
            vertexCount = verts.length / FLOATS;
            uploaded = mesh;
            uploadedPalette = palette;
        }
        if (instances?.mesh && instances.mesh !== protoMesh) {
            const v = buildVertices(instances.mesh);
            protoBuffer?.destroy();
            protoBuffer = device.createBuffer({ size: Math.max(v.byteLength, 256), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            device.queue.writeBuffer(protoBuffer, 0, v);
            protoCount = v.length / FLOATS;
            protoMesh = instances.mesh;
        }
        if (instances?.data && instances.data !== instData) {
            const d = instances.data;
            if (d.byteLength > instCapacity) {
                instBuffer?.destroy();
                instCapacity = Math.max(d.byteLength, 4096);
                instBuffer = device.createBuffer({ size: instCapacity, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            }
            if (d.byteLength)
                device.queue.writeBuffer(instBuffer, 0, d);
            instData = d;
            instCount = d.length / INSTANCE_FLOATS;
        }
        if (!instances)
            instCount = 0;
        const eyeKey = cam.eye.join(',');
        if (glassTris.length && eyeKey !== glassEye) {
            glassEye = eyeKey;
            const [ex, ey, ez] = cam.eye;
            const far = (t) => (t.c[0] - ex) ** 2 + (t.c[1] - ey) ** 2 + (t.c[2] - ez) ** 2;
            const sorted = [...glassTris].sort((a, b) => far(b) - far(a)); // far first
            const out = new Float32Array(sorted.length * 3 * FLOATS);
            sorted.forEach((t, k) => out.set(glassSource.subarray(t.at, t.at + 3 * FLOATS), k * 3 * FLOATS));
            if (out.byteLength > glassCapacity) {
                glassBuffer?.destroy();
                glassCapacity = Math.max(out.byteLength, 4096);
                glassBuffer = device.createBuffer({ size: glassCapacity, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            }
            device.queue.writeBuffer(glassBuffer, 0, out);
            glassCount = sorted.length * 3;
        }
        if (!glassTris.length)
            glassCount = 0;
        // studio rig, relative to the camera: key upper left in front, fill from the right, rim from behind and above
        const rig = (f, r, up) => norm([0, 1, 2].map((k) => -cam.f[k] * f + cam.r[k] * r + cam.u[k] * up));
        const S = studio ? { fill: 0.4, rim: 1, ...(studio === true ? {} : studio) } : null;
        const u = new Float32Array(48);
        u.set(viewProjection(cam), 0);
        u.set([...(S ? rig(0.7, -0.5, 0.6) : norm(L.direction)), 0], 16);
        u.set([...L.sky, 0], 20);
        u.set([...L.ground, 0], 24);
        u.set([...cam.eye, 0], 28);
        u.set([M.ambient, M.diffuse, M.specular, M.shininess], 32);
        u.set([filmic ? 1 : 0, filmic ? filmic.exposure : 1, filmic ? filmic.emit : 0, S ? 1 : 0], 36);
        u.set([...rig(0.6, 0.8, 0.1), S ? S.fill : 0], 40);
        u.set([...rig(-0.8, 0.3, 0.5), S ? S.rim : 0], 44);
        device.queue.writeBuffer(uniforms, 0, u);
        const encoder = device.createCommandEncoder();
        const offscreen = readback
            ? device.createTexture({ size: [px, px], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC })
            : null;
        const target = (offscreen ?? context.getCurrentTexture()).createView();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: color ? color.createView() : target,
                    resolveTarget: color ? target : undefined,
                    clearValue: { r: background[0], g: background[1], b: background[2], a: 1 },
                    loadOp: 'clear',
                    storeOp: color ? 'discard' : 'store',
                },
            ],
            depthStencilAttachment: { view: depth.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' },
        });
        if (vertexCount) {
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bind);
            pass.setVertexBuffer(0, vertexBuffer);
            pass.draw(vertexCount);
        }
        if (instCount && protoCount) {
            pass.setPipeline(instPipeline);
            pass.setBindGroup(0, instBind);
            pass.setVertexBuffer(0, protoBuffer);
            pass.setVertexBuffer(1, instBuffer);
            pass.draw(protoCount, instCount);
        }
        if (glassCount) {
            // after everything solid (and the instances): see-through faces, far to near
            pass.setPipeline(glassPipeline);
            pass.setBindGroup(0, bind);
            pass.setVertexBuffer(0, glassBuffer);
            pass.draw(glassCount);
        }
        pass.end();
        if (!offscreen) {
            device.queue.submit([encoder.finish()]);
            return null;
        }
        const row = Math.ceil((px * 4) / 256) * 256;
        const out = device.createBuffer({ size: row * px, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        encoder.copyTextureToBuffer({ texture: offscreen }, { buffer: out, bytesPerRow: row }, [px, px]);
        device.queue.submit([encoder.finish()]);
        return out.mapAsync(GPUMapMode.READ).then(() => {
            const raw = new Uint8Array(out.getMappedRange());
            const data = new Uint8ClampedArray(px * px * 4);
            const swap = format.startsWith('bgra');
            for (let y = 0; y < px; y++) {
                for (let x = 0; x < px; x++) {
                    const i = y * row + x * 4;
                    const o = (y * px + x) * 4;
                    data[o] = raw[i + (swap ? 2 : 0)];
                    data[o + 1] = raw[i + 1];
                    data[o + 2] = raw[i + (swap ? 0 : 2)];
                    data[o + 3] = 255;
                }
            }
            out.unmap();
            out.destroy();
            offscreen.destroy();
            return { width: px, height: px, data };
        });
    };
    /** Draws a frame onto the canvas. */
    const render = (mesh, view, options) => {
        draw(mesh, view, options);
    };
    /** Draws a frame into an offscreen texture and reads it back: Promise<{ width, height, data: RGBA }>. */
    const pixels = (mesh, view, options) => draw(mesh, view, options, true);
    const destroy = () => {
        vertexBuffer?.destroy();
        glassBuffer?.destroy();
        protoBuffer?.destroy();
        instBuffer?.destroy();
        depth?.destroy();
        color?.destroy();
        uniforms.destroy();
        device.destroy();
    };
    return { render, pixels, destroy, device, adapter };
};
