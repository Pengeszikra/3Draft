// WebGPU renderer: flat-colored faces, one simple lit material, one global light.
// It draws the same scene through the same camera as the SVG renderer, so picking,
// the cross marks and the framing all stay valid. The pure helpers (viewProjection,
// buildVertices) need no GPU and are unit tested; createGpu() needs a browser.

import { dot, norm } from './vec.js';
import { faceNormal } from './mesh.js';
import { makeCamera } from './camera.js';
import { surfaceOf } from './material.js';
import type { Palette } from './material.js';
import type { Axes, Camera, Fit, Mesh, Vec3, ViewName, ViewSpec } from './types.js';

type Handle = any; // a GPU object: buffers, textures and pipelines are used through duck typing

export interface GpuLight {
  /** Direction towards the light, world space. */
  direction?: Vec3;
  /** Hemisphere ambient colors (rgb 0..1): up and down. */
  sky?: Vec3;
  ground?: Vec3;
}
export interface GpuMaterial {
  ambient?: number;
  diffuse?: number;
  specular?: number;
  shininess?: number;
}
export interface GpuRenderOptions {
  /** CSS pixels, the canvas becomes size x size (times dpr in device pixels). */
  size?: number;
  fit?: Fit;
  /** Clear color, rgb 0..1. */
  background?: Vec3;
  light?: GpuLight;
  material?: GpuMaterial;
  /** Named materials the faces point at (`face.mat`); pass a new object when an entry changes. */
  palette?: Palette;
  dpr?: number;
  /** Many copies of one prototype mesh (modelled around the origin), drawn after `mesh`. */
  instances?: { mesh: Mesh; data: Float32Array };
  /**
   * Filmic look: lighting in linear colour, HDR light and emission, Fresnel on the edges, ACES tone mapping.
   * `true` for the defaults or { exposure = 1, emit = 3 } (emit: how far above white an `emit: 1` face glows).
   * Off by default (the plain flat look).
   */
  tonemap?: boolean | { exposure?: number; emit?: number };
}
/** One copy of a prototype: its position, orthonormal frame and color. */
export interface Instance {
  at: Vec3;
  axes: Axes;
  color?: string;
}
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export interface Gpu {
  render(mesh: Mesh, view: ViewName | ViewSpec, options?: GpuRenderOptions): void;
  /** Same frame, drawn offscreen and read back as RGBA (tests, thumbnails). */
  pixels(mesh: Mesh, view: ViewName | ViewSpec, options?: GpuRenderOptions): Promise<Pixels>;
  destroy(): void;
  device: Handle;
  adapter: Handle;
}

const FLOATS = 13; // position(3) normal(3) color(3) material(4: metal, rough, alpha, emit)

/**
 * Column-major 4x4 matrix (for WebGPU, z in 0..1) that maps world points exactly
 * like camera.project(): the same pixels, plus a depth between near and far.
 */
export const viewProjection = (cam: Camera, near = 0.03, far = 1000): Float32Array => {
  const kk = cam.k / (cam.size / 2);
  const row = (v: Vec3, s: number): number[] => [v[0] * s, v[1] * s, v[2] * s, -dot(v, cam.eye) * s];
  const a = cam.ortho ? 1 / (far - near) : far / (far - near);
  const zr = row(cam.f, a);
  zr[3] -= a * near;
  const rows = [row(cam.r, kk), row(cam.u, kk), zr, cam.ortho ? [0, 0, 0, 1] : row(cam.f, 1)];
  const m = new Float32Array(16);
  rows.forEach((r, i) => r.forEach((v, j) => (m[j * 4 + i] = v)));
  return m;
};

const rgb = (color?: string): Vec3 => {
  const h = String(color ?? '').replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return [0.78, 0.78, 0.78];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Vec3;
};

/** Triangle list for the GPU: flat face normals, face colors and materials. Float32Array, 13 floats per vertex. */
export const buildVertices = (mesh: Mesh, palette?: Palette): Float32Array => {
  let tris = 0;
  for (const f of mesh.faces) tris += Math.max(0, f.v.length - 2);
  const out = new Float32Array(tris * 3 * FLOATS);
  let o = 0;
  for (const face of mesh.faces) {
    const pts = face.v.map((k) => mesh.positions[k]);
    const n = pts |> faceNormal |> norm;
    const s = surfaceOf(face, palette);
    const c = rgb(s.color);
    const mat = [s.metal, s.rough, s.alpha, s.emit];
    for (let j = 1; j < pts.length - 1; j++) {
      for (const p of [pts[0], pts[j], pts[j + 1]]) {
        out.set([...p, ...n, ...c, ...mat], o);
        o += FLOATS;
      }
    }
  }
  return out;
};

const INSTANCE_FLOATS = 15; // at(3) ex(3) ey(3) ez(3) color(3)

/**
 * Per-instance data for drawInstances: one entry { at, axes: [ex, ey, ez], color } per copy of a
 * prototype mesh (modelled around the origin). Float32Array, 15 floats per instance.
 */
export const buildInstances = (items: Instance[]): Float32Array => {
  const out = new Float32Array(items.length * INSTANCE_FLOATS);
  items.forEach((it, i) => out.set([...it.at, ...it.axes[0], ...it.axes[1], ...it.axes[2], ...rgb(it.color)], i * INSTANCE_FLOATS));
  return out;
};

export const defaultLight: Required<GpuLight> = { direction: [0.5, 0.8, 0.6] |> norm, sky: [1, 0.97, 0.92], ground: [0.42, 0.38, 0.36] };
export const defaultMaterial: Required<GpuMaterial> = { ambient: 0.62, diffuse: 0.78, specular: 0.2, shininess: 30 };

const SHADER: string = /* wgsl */ `
struct U {
  vp : mat4x4<f32>,
  light : vec4<f32>,   // xyz: direction towards the light
  sky : vec4<f32>,
  ground : vec4<f32>,
  eye : vec4<f32>,
  mat : vec4<f32>,     // ambient, diffuse, specular, shininess
  fx : vec4<f32>,      // filmic (0 or 1), exposure, emission gain
};
@group(0) @binding(0) var<uniform> u : U;

struct VIn { @location(0) pos : vec3<f32>, @location(1) nrm : vec3<f32>, @location(2) col : vec3<f32>, @location(8) mat : vec4<f32> };
struct VOut {
  @builtin(position) p : vec4<f32>,
  @location(0) n : vec3<f32>,
  @location(1) c : vec3<f32>,
  @location(2) w : vec3<f32>,
  @location(3) m : vec4<f32>,   // metal, rough, alpha, emit
};

@vertex fn vs(i : VIn) -> VOut {
  var o : VOut;
  o.p = u.vp * vec4<f32>(i.pos, 1.0);
  o.n = i.nrm;
  o.c = i.col;
  o.w = i.pos;
  o.m = i.mat;
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

// The filmic path: the same light model, but in linear colour with HDR light and emission, then tone mapped.
fn filmic(i : VOut, n : vec3<f32>, l : vec3<f32>, v : vec3<f32>) -> vec4<f32> {
  let metal = i.m.x;
  let rough = i.m.y;
  let albedo = toLinear(i.c);
  let hemi = mix(toLinear(u.ground.rgb), toLinear(u.sky.rgb), n.y * 0.5 + 0.5) * u.mat.x;
  let diff = max(dot(n, l), 0.0) * u.mat.y * 1.6;
  let h = normalize(l + v);
  let shin = mix(u.mat.w * 7.0, u.mat.w * 0.15, rough);
  let spec = pow(max(dot(n, h), 0.0), shin) * mix(u.mat.z, 1.0, metal) * mix(1.0, 0.35, rough) * step(0.0, dot(n, l)) * 2.5;
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
  let hemi = mix(u.ground.rgb, u.sky.rgb, n.y * 0.5 + 0.5) * u.mat.x;
  let diff = max(dot(n, l), 0.0) * u.mat.y;
  let h = normalize(l + v);
  // roughness widens the highlight; metal makes it strong and tinted by the color
  let shin = mix(u.mat.w * 7.0, u.mat.w * 0.15, rough);
  let spec = pow(max(dot(n, h), 0.0), shin) * mix(u.mat.z, 1.0, metal) * mix(1.0, 0.35, rough) * step(0.0, dot(n, l));
  // metal mirrors the sky above and the ground below, blurred by roughness
  let r = reflect(-v, n);
  let env = mix(u.ground.rgb * 1.2, u.sky.rgb * 1.5, smoothstep(-0.25 - rough * 0.5, 0.25 + rough * 0.5, r.y));
  var lit = i.c * (hemi + vec3<f32>(diff)) * (1.0 - metal)
          + i.c * env * metal * (1.0 - 0.6 * rough)
          + vec3<f32>(spec) * mix(vec3<f32>(1.0), i.c, metal);
  lit = mix(lit, i.c * 1.15, i.m.w);
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
export const createGpu = async (canvas: HTMLCanvasElement, { sampleCount = 4 }: { sampleCount?: number } = {}): Promise<Gpu> => {
  if (!globalThis.navigator?.gpu) throw new Error('WebGPU is not available in this browser');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter found');
  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', (e: any) => console.error('WebGPU:', e.error?.message ?? e));
  device.lost.then((info: any) => console.error('WebGPU device lost:', info.reason, info.message));
  const context = canvas.getContext('webgpu' as string) as Handle;
  if (!context) throw new Error('Could not get a WebGPU canvas context');
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
    ],
  };
  const instanceLayout = {
    arrayStride: INSTANCE_FLOATS * 4,
    stepMode: 'instance',
    attributes: [3, 4, 5, 6, 7].map((loc, k) => ({ shaderLocation: loc, offset: k * 12, format: 'float32x3' })),
  };
  const make = (entry: string, buffers: Handle[]): Handle =>
    device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: entry, buffers },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      // the fragment alpha becomes coverage: a half transparent face covers half of the samples (one pass, no sorting)
      multisample: sampleCount > 1 ? { count: sampleCount, alphaToCoverageEnabled: true } : { count: sampleCount },
    });
  const pipeline = make('vs', [meshLayout]);
  // the instanced pipeline reads position and normal only from the prototype (locations 0, 1)
  const instPipeline = make('vsi', [{ ...meshLayout, attributes: meshLayout.attributes.slice(0, 2) }, instanceLayout]);
  const uniforms = device.createBuffer({ size: 160, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniforms } }] });
  const instBind = device.createBindGroup({ layout: instPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniforms } }] });

  // Geometry that did not change since the last frame is not rebuilt or uploaded again.
  let uploaded: Mesh | null = null; // the mesh now in vertexBuffer
  let uploadedPalette: Palette | undefined; // and the palette it was built with
  let vertexCount = 0;
  let protoMesh: Mesh | null = null;
  let protoBuffer: Handle = null;
  let protoCount = 0;
  let instBuffer: Handle = null;
  let instCapacity = 0;
  let instData: Float32Array | null = null;
  let instCount = 0;

  let vertexBuffer: Handle = null;
  let capacity = 0;
  let px = 0;
  let depth: Handle = null;
  let color: Handle = null;

  const targets = (n: number) => {
    if (n === px) return;
    px = n;
    canvas.width = n;
    canvas.height = n;
    depth?.destroy();
    color?.destroy();
    depth = device.createTexture({ size: [n, n], format: 'depth24plus', sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    color = sampleCount > 1 ? device.createTexture({ size: [n, n], format, sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT }) : null;
  };

  const draw = (
    mesh: Mesh,
    view: ViewName | ViewSpec,
    { size = 400, fit, background = [0.98, 0.98, 0.97], light = {}, material = {}, palette, dpr = globalThis.devicePixelRatio || 1, instances, tonemap = false }: GpuRenderOptions = {},
    readback = false,
  ): Promise<Pixels> | null => {
    const L = { ...defaultLight, ...light };
    const filmic = tonemap ? { exposure: 1, emit: 3, ...(tonemap === true ? {} : tonemap) } : null;
    const M = { ...defaultMaterial, ...material };
    const cam = makeCamera(view, mesh, size, fit);
    targets(Math.max(1, Math.round(size * dpr)));

    if (mesh !== uploaded || palette !== uploadedPalette) {
      const verts = buildVertices(mesh, palette);
      if (verts.byteLength > capacity) {
        vertexBuffer?.destroy();
        capacity = Math.max(verts.byteLength, 4096);
        vertexBuffer = device.createBuffer({ size: capacity, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      }
      if (verts.byteLength) device.queue.writeBuffer(vertexBuffer, 0, verts);
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
      if (d.byteLength) device.queue.writeBuffer(instBuffer, 0, d);
      instData = d;
      instCount = d.length / INSTANCE_FLOATS;
    }
    if (!instances) instCount = 0;

    const u = new Float32Array(40);
    u.set(viewProjection(cam), 0);
    u.set([...(L.direction |> norm), 0], 16);
    u.set([...L.sky, 0], 20);
    u.set([...L.ground, 0], 24);
    u.set([...cam.eye, 0], 28);
    u.set([M.ambient, M.diffuse, M.specular, M.shininess], 32);
    u.set([filmic ? 1 : 0, filmic ? filmic.exposure : 1, filmic ? filmic.emit : 0, 0], 36);
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
    pass.end();
    if (!offscreen) {
      device.queue.submit([encoder.finish()]);
      return null;
    }
    const row = Math.ceil((px * 4) / 256) * 256;
    const out = device.createBuffer({ size: row * px, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    encoder.copyTextureToBuffer({ texture: offscreen }, { buffer: out, bytesPerRow: row }, [px, px]);
    device.queue.submit([encoder.finish()]);
    return out.mapAsync(GPUMapMode.READ).then((): Pixels => {
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
  const render = (mesh: Mesh, view: ViewName | ViewSpec, options?: GpuRenderOptions): void => {
    draw(mesh, view, options);
  };
  /** Draws a frame into an offscreen texture and reads it back: Promise<{ width, height, data: RGBA }>. */
  const pixels = (mesh: Mesh, view: ViewName | ViewSpec, options?: GpuRenderOptions): Promise<Pixels> => draw(mesh, view, options, true) as Promise<Pixels>;

  const destroy = (): void => {
    vertexBuffer?.destroy();
    protoBuffer?.destroy();
    instBuffer?.destroy();
    depth?.destroy();
    color?.destroy();
    uniforms.destroy();
    device.destroy();
  };

  return { render, pixels, destroy, device, adapter };
};
