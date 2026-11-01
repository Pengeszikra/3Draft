// WebGPU renderer: flat-colored faces, one simple lit material, one global light.
// It draws the same scene through the same camera as the SVG renderer, so picking,
// the cross marks and the framing all stay valid. The pure helpers (viewProjection,
// buildVertices) need no GPU and are unit tested; createGpu() needs a browser.

import { sub, dot, norm } from './vec.js';
import { faceNormal } from './mesh.js';
import { makeCamera } from './camera.js';

const FLOATS = 9; // position(3) normal(3) color(3)

/**
 * Column-major 4x4 matrix (for WebGPU, z in 0..1) that maps world points exactly
 * like camera.project(): the same pixels, plus a depth between near and far.
 */
export const viewProjection = (cam, near = 0.1, far = 1000) => {
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
  if (!/^[0-9a-f]{6}$/i.test(full)) return [0.78, 0.78, 0.78];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};

/** Triangle list for the GPU: flat face normals and face colors. Float32Array, 9 floats per vertex. */
export const buildVertices = (mesh) => {
  let tris = 0;
  for (const f of mesh.faces) tris += Math.max(0, f.v.length - 2);
  const out = new Float32Array(tris * 3 * FLOATS);
  let o = 0;
  for (const face of mesh.faces) {
    const pts = face.v.map((k) => mesh.positions[k]);
    const n = norm(faceNormal(pts));
    const c = rgb(face.color);
    for (let j = 1; j < pts.length - 1; j++) {
      for (const p of [pts[0], pts[j], pts[j + 1]]) {
        out.set([...p, ...n, ...c], o);
        o += FLOATS;
      }
    }
  }
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
};
@group(0) @binding(0) var<uniform> u : U;

struct VIn { @location(0) pos : vec3<f32>, @location(1) nrm : vec3<f32>, @location(2) col : vec3<f32> };
struct VOut {
  @builtin(position) p : vec4<f32>,
  @location(0) n : vec3<f32>,
  @location(1) c : vec3<f32>,
  @location(2) w : vec3<f32>,
};

@vertex fn vs(i : VIn) -> VOut {
  var o : VOut;
  o.p = u.vp * vec4<f32>(i.pos, 1.0);
  o.n = i.nrm;
  o.c = i.col;
  o.w = i.pos;
  return o;
}

@fragment fn fs(i : VOut, @builtin(front_facing) front : bool) -> @location(0) vec4<f32> {
  var n = normalize(i.n);
  if (!front) { n = -n; }
  let l = normalize(u.light.xyz);
  let v = normalize(u.eye.xyz - i.w);
  let hemi = mix(u.ground.rgb, u.sky.rgb, n.y * 0.5 + 0.5) * u.mat.x;
  let diff = max(dot(n, l), 0.0) * u.mat.y;
  let h = normalize(l + v);
  let spec = pow(max(dot(n, h), 0.0), u.mat.w) * u.mat.z * step(0.0, dot(n, l));
  let lit = i.c * (hemi + vec3<f32>(diff)) + vec3<f32>(spec);
  return vec4<f32>(clamp(lit, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`;

/**
 * Sets up WebGPU on a canvas. Rejects when WebGPU is not available.
 * Returns { render(mesh, view, options), destroy() }.
 * render options: size (CSS px, the canvas is made size x size), fit, background [r,g,b] 0..1,
 * light { direction, sky, ground }, material { ambient, diffuse, specular, shininess }, dpr.
 */
export const createGpu = async (canvas, { sampleCount = 4 } = {}) => {
  if (!globalThis.navigator?.gpu) throw new Error('WebGPU is not available in this browser');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter found');
  const device = await adapter.requestDevice();
  device.addEventListener('uncapturederror', (e) => console.error('WebGPU:', e.error?.message ?? e));
  device.lost.then((info) => console.error('WebGPU device lost:', info.reason, info.message));
  const context = canvas.getContext('webgpu');
  if (!context) throw new Error('Could not get a WebGPU canvas context');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque', });

  const module = device.createShaderModule({ code: SHADER });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs',
      buffers: [
        {
          arrayStride: FLOATS * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x3' },
            { shaderLocation: 2, offset: 24, format: 'float32x3' },
          ],
        },
      ],
    },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    multisample: { count: sampleCount },
  });
  const uniforms = device.createBuffer({ size: 144, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniforms } }] });

  let vertexBuffer = null;
  let capacity = 0;
  let px = 0;
  let depth = null;
  let color = null;

  const targets = (n) => {
    if (n === px) return;
    px = n;
    canvas.width = n;
    canvas.height = n;
    depth?.destroy();
    color?.destroy();
    depth = device.createTexture({ size: [n, n], format: 'depth24plus', sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    color = sampleCount > 1 ? device.createTexture({ size: [n, n], format, sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT }) : null;
  };

  const draw = (mesh, view, { size = 400, fit, background = [0.98, 0.98, 0.97], light = {}, material = {}, dpr = globalThis.devicePixelRatio || 1 } = {}, readback = false) => {
    const L = { ...defaultLight, ...light };
    const M = { ...defaultMaterial, ...material };
    const cam = makeCamera(view, mesh, size, fit);
    targets(Math.max(1, Math.round(size * dpr)));

    const verts = buildVertices(mesh);
    if (verts.byteLength > capacity) {
      vertexBuffer?.destroy();
      capacity = Math.max(verts.byteLength, 4096);
      vertexBuffer = device.createBuffer({ size: capacity, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    }
    if (verts.byteLength) device.queue.writeBuffer(vertexBuffer, 0, verts);

    const u = new Float32Array(36);
    u.set(viewProjection(cam), 0);
    u.set([...norm(L.direction), 0], 16);
    u.set([...L.sky, 0], 20);
    u.set([...L.ground, 0], 24);
    u.set([...cam.eye, 0], 28);
    u.set([M.ambient, M.diffuse, M.specular, M.shininess], 32);
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
    if (verts.byteLength) {
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bind);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(verts.length / FLOATS);
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
    depth?.destroy();
    color?.destroy();
    uniforms.destroy();
    device.destroy();
  };

  return { render, pixels, destroy, device, adapter };
};
