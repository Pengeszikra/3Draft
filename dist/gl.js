// WebGL2 renderer: the same picture as the WebGPU one (gpu.ts), for browsers and devices that have no WebGPU.
// Same options, same vertices (buildVertices), same light model: the shader below is a line-by-line port of the WGSL.
// It also runs on a software GL (SwiftShader), so a frame can be checked on a machine without a GPU.
import { norm } from './vec.js';
import { makeCamera } from './camera.js';
import { buildVertices, viewProjection, defaultLight, defaultMaterial } from './gpu.js';
const GL_FLOATS = 14; // position(3) normal(3) color(3) material(4: metal, rough, alpha, emit) soft(1)
const GL_INSTANCE_FLOATS = 15; // at(3) ex(3) ey(3) ez(3) color(3)
const GL_COMMON = /* glsl */ `#version 300 es
precision highp float;
uniform mat4 uVp;
out vec3 vN; out vec3 vC; out vec3 vW; out vec4 vM; out float vS;
`;
const GL_VERT = `${GL_COMMON}
layout(location = 0) in vec3 aPos; layout(location = 1) in vec3 aNrm; layout(location = 2) in vec3 aCol;
layout(location = 3) in vec4 aMat; layout(location = 4) in float aSoft;
void main() {
  vec4 p = uVp * vec4(aPos, 1.0);
  gl_Position = vec4(p.xy, p.z * 2.0 - p.w, p.w); // WebGPU depth is 0..1, GL wants -1..1
  vN = aNrm; vC = aCol; vW = aPos; vM = aMat; vS = aSoft;
}`;
// the same prototype drawn many times: its frame (ex, ey, ez; scaled axes scale it) and position come per instance
const GL_VERT_INST = `${GL_COMMON}
layout(location = 0) in vec3 aPos; layout(location = 1) in vec3 aNrm;
layout(location = 5) in vec3 aAt; layout(location = 6) in vec3 aEx; layout(location = 7) in vec3 aEy; layout(location = 8) in vec3 aEz;
layout(location = 9) in vec3 aCol;
void main() {
  vec3 w = aAt + aEx * aPos.x + aEy * aPos.y + aEz * aPos.z;
  vec4 p = uVp * vec4(w, 1.0);
  gl_Position = vec4(p.xy, p.z * 2.0 - p.w, p.w);
  vN = normalize(aEx) * aNrm.x + normalize(aEy) * aNrm.y + normalize(aEz) * aNrm.z;
  vC = aCol; vW = w; vM = vec4(0.0, 0.7, 1.0, 0.0); vS = 0.0;
}`;
const GL_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform vec4 uLight; uniform vec4 uSky; uniform vec4 uGround; uniform vec4 uEye; uniform vec4 uMat;
uniform vec4 uFx; uniform vec4 uFill; uniform vec4 uRim;
in vec3 vN; in vec3 vC; in vec3 vW; in vec4 vM; in float vS;
out vec4 outColor;

vec3 toLinear(vec3 c) { return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, vec3(lessThanEqual(c, vec3(0.04045)))); }
vec3 toSrgb(vec3 c) { return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
// ACES filmic curve (Narkowicz fit): highlights roll off softly instead of clipping
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3(0.0), vec3(1.0)); }

// Direct light, shared by both looks: x diffuse, y highlight, z scattered light (soft materials).
vec3 lights(vec3 n, vec3 v, float shin, float soft) {
  vec3 key = normalize(uLight.xyz);
  float ndl = dot(n, key);
  float diff = max((ndl + soft) / (1.0 + soft), 0.0);
  vec3 h = normalize(key + v);
  float spec = pow(max(dot(n, h), 0.0), shin) * step(0.0, ndl);
  float scat = soft * exp(-ndl * ndl * 5.0);
  if (uFx.w > 0.5) {
    diff = diff * 0.85;
    vec3 fl = normalize(uFill.xyz);
    diff = diff + max((dot(n, fl) + soft) / (1.0 + soft), 0.0) * uFill.w;
    vec3 rl = normalize(uRim.xyz);
    float edge = pow(1.0 - max(dot(n, v), 0.0), 2.5);
    diff = diff + max(dot(n, rl), 0.0) * edge * uRim.w * 2.0;
    vec3 rh = normalize(rl + v);
    spec = spec + pow(max(dot(n, rh), 0.0), shin) * step(0.0, dot(n, rl)) * uRim.w * 0.6 * edge;
  }
  return vec3(diff, spec, scat);
}

vec4 filmic(vec3 n, vec3 v) {
  float metal = vM.x;
  float rough = vM.y;
  vec3 albedo = toLinear(vC);
  vec3 hemi = mix(toLinear(uGround.rgb), toLinear(uSky.rgb), n.y * 0.5 + 0.5) * uMat.x * (uFx.w > 0.5 ? 0.7 : 1.0);
  float shin = mix(uMat.w * 7.0, uMat.w * 0.15, rough);
  vec3 lt = lights(n, v, shin, vS);
  float diff = lt.x * uMat.y * 1.6;
  float spec = lt.y * mix(uMat.z, 1.0, metal) * mix(1.0, 0.35, rough) * 2.5;
  vec3 r = reflect(-v, n);
  vec3 f0 = mix(vec3(0.04), albedo, metal);
  vec3 fres = f0 + (vec3(1.0) - f0) * pow(1.0 - max(dot(n, v), 0.0), 5.0) * (1.0 - rough);
  vec3 env = mix(toLinear(uGround.rgb) * 1.2, toLinear(uSky.rgb) * 1.5, smoothstep(-0.25 - rough * 0.5, 0.25 + rough * 0.5, r.y));
  vec3 lit = albedo * (hemi + vec3(diff)) * (1.0 - metal)
           + albedo * env * metal * (1.0 - 0.6 * rough)
           + env * fres * (1.0 - rough) * 0.5
           + vec3(spec) * mix(vec3(1.0), albedo, metal);
  lit = lit + albedo * vec3(1.0, 0.38, 0.26) * lt.z * 0.5 * (1.0 - metal);
  lit = lit + albedo * vM.w * uFx.z;
  return vec4(toSrgb(aces(lit * uFx.y)), vM.z);
}

void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(uEye.xyz - vW);
  if (uFx.x > 0.5) { outColor = filmic(n, v); return; }
  float metal = vM.x;
  float rough = vM.y;
  vec3 hemi = mix(uGround.rgb, uSky.rgb, n.y * 0.5 + 0.5) * uMat.x * (uFx.w > 0.5 ? 0.7 : 1.0);
  float shin = mix(uMat.w * 7.0, uMat.w * 0.15, rough);
  vec3 lt = lights(n, v, shin, vS);
  float diff = lt.x * uMat.y;
  float spec = lt.y * mix(uMat.z, 1.0, metal) * mix(1.0, 0.35, rough);
  vec3 r = reflect(-v, n);
  vec3 env = mix(uGround.rgb * 1.2, uSky.rgb * 1.5, smoothstep(-0.25 - rough * 0.5, 0.25 + rough * 0.5, r.y));
  vec3 lit = vC * (hemi + vec3(diff)) * (1.0 - metal)
           + vC * env * metal * (1.0 - 0.6 * rough)
           + vec3(spec) * mix(vec3(1.0), vC, metal)
           + vC * vec3(1.0, 0.38, 0.26) * lt.z * 0.25 * (1.0 - metal);
  lit = mix(lit, vC * 1.15, min(vM.w, 1.0));
  outColor = vec4(clamp(lit, vec3(0.0), vec3(1.0)), vM.z);
}`;
/**
 * Sets up WebGL2 on a canvas. Rejects when WebGL2 is not available. Same call and options as createGpu:
 * returns { render(mesh, view, options), pixels(...), destroy() }. `device.lost` resolves when the context is lost.
 */
export const createGl = async (canvas, { onError } = {}) => {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: false });
    if (!gl)
        throw new Error('WebGL2 is not available in this browser');
    const lost = new Promise((resolve) => canvas.addEventListener('webglcontextlost', (e) => (e.preventDefault(), resolve({ reason: 'lost', message: 'WebGL context lost' }))));
    const program = (vs, fs) => {
        const sh = (type, src) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                const message = `shader: ${gl.getShaderInfoLog(s)}`;
                onError?.(message);
                throw new Error(message);
            }
            return s;
        };
        const p = gl.createProgram();
        gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
        gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
            const message = `program: ${gl.getProgramInfoLog(p)}`;
            onError?.(message);
            throw new Error(message);
        }
        return p;
    };
    const meshProg = program(GL_VERT, GL_FRAG);
    const instProg = program(GL_VERT_INST, GL_FRAG);
    const uni = (p) => {
        const g = (n) => gl.getUniformLocation(p, n);
        return { vp: g('uVp'), light: g('uLight'), sky: g('uSky'), ground: g('uGround'), eye: g('uEye'), mat: g('uMat'), fx: g('uFx'), fill: g('uFill'), rim: g('uRim') };
    };
    const meshU = uni(meshProg);
    const instU = uni(instProg);
    const stride = GL_FLOATS * 4;
    const buffer = () => gl.createBuffer();
    const vaoWith = (setup) => {
        const v = gl.createVertexArray();
        gl.bindVertexArray(v);
        setup();
        gl.bindVertexArray(null);
        return v;
    };
    const attr = (loc, size, stride, offset, divisor = 0) => {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
        gl.vertexAttribDivisor(loc, divisor);
    };
    const solidBuf = buffer();
    const glassBuf = buffer();
    const protoBuf = buffer();
    const instBuf = buffer();
    const meshAttrs = (b) => () => {
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        attr(0, 3, stride, 0);
        attr(1, 3, stride, 12);
        attr(2, 3, stride, 24);
        attr(3, 4, stride, 36);
        attr(4, 1, stride, 52);
    };
    const solidVao = vaoWith(meshAttrs(solidBuf));
    const glassVao = vaoWith(meshAttrs(glassBuf));
    const instVao = vaoWith(() => {
        gl.bindBuffer(gl.ARRAY_BUFFER, protoBuf);
        attr(0, 3, stride, 0);
        attr(1, 3, stride, 12);
        gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
        [5, 6, 7, 8, 9].forEach((loc, k) => attr(loc, 3, GL_INSTANCE_FLOATS * 4, k * 12, 1));
    });
    // Geometry that did not change since the last frame is not rebuilt or uploaded again.
    let uploaded = null;
    let uploadedPalette;
    let uploadedSmooth = 0;
    let partCache = new WeakMap();
    let partPalette;
    let partSmooth = 0;
    let vertexCount = 0;
    let protoMesh = null;
    let protoCount = 0;
    let instData = null;
    let instCount = 0;
    let glassTris = [];
    let glassSource = new Float32Array(0);
    let glassCount = 0;
    let glassEye = '';
    let px = 0;
    const upload = (b, data) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    };
    const draw = (mesh, view, { size = 400, fit, background = [0.98, 0.98, 0.97], light = {}, material = {}, palette, dpr = globalThis.devicePixelRatio || 1, instances, parts, tonemap = false, smooth = false, studio = false } = {}) => {
        const L = { ...defaultLight, ...light };
        const filmic = tonemap ? { exposure: 1, emit: 2, ...(tonemap === true ? {} : tonemap) } : null;
        const M = { ...defaultMaterial, ...material };
        const cam = makeCamera(view, mesh, size, fit);
        const n = Math.max(1, Math.round(size * dpr));
        if (n !== px) {
            px = n;
            canvas.width = n;
            canvas.height = n;
        }
        const crease = smooth === true ? 40 : smooth || 0;
        if (mesh !== uploaded || palette !== uploadedPalette || crease !== uploadedSmooth) {
            uploadedSmooth = crease;
            let all;
            if (parts && parts.length) {
                if (palette !== partPalette || crease !== partSmooth) {
                    partCache = new WeakMap();
                    partPalette = palette;
                    partSmooth = crease;
                }
                const built = parts.map((m) => {
                    let v = partCache.get(m);
                    if (!v)
                        partCache.set(m, (v = buildVertices(m, palette, { smooth: crease })));
                    return v;
                });
                all = new Float32Array(built.reduce((s, v) => s + v.length, 0));
                let at = 0;
                for (const v of built) {
                    all.set(v, at);
                    at += v.length;
                }
            }
            else
                all = buildVertices(mesh, palette, { smooth: crease });
            // solid triangles first; triangles with alpha < 1 are kept apart and blended afterwards
            const tri = 3 * GL_FLOATS;
            const solid = new Float32Array(all.length);
            let solidLen = 0;
            glassTris = [];
            for (let o = 0; o < all.length; o += tri) {
                if (all[o + 11] < 1) {
                    const c = [0, 1, 2].map((k) => (all[o + k] + all[o + GL_FLOATS + k] + all[o + 2 * GL_FLOATS + k]) / 3);
                    glassTris.push({ c, at: o });
                }
                else {
                    solid.set(all.subarray(o, o + tri), solidLen);
                    solidLen += tri;
                }
            }
            glassSource = all;
            glassEye = '';
            upload(solidBuf, solid.subarray(0, solidLen));
            vertexCount = solidLen / GL_FLOATS;
            uploaded = mesh;
            uploadedPalette = palette;
        }
        if (instances?.mesh && instances.mesh !== protoMesh) {
            const v = buildVertices(instances.mesh);
            upload(protoBuf, v);
            protoCount = v.length / GL_FLOATS;
            protoMesh = instances.mesh;
        }
        if (instances?.data && instances.data !== instData) {
            upload(instBuf, instances.data);
            instData = instances.data;
            instCount = instances.data.length / GL_INSTANCE_FLOATS;
        }
        if (!instances)
            instCount = 0;
        const eyeKey = cam.eye.join(',');
        if (glassTris.length && eyeKey !== glassEye) {
            glassEye = eyeKey;
            const [ex, ey, ez] = cam.eye;
            const far = (t) => (t.c[0] - ex) ** 2 + (t.c[1] - ey) ** 2 + (t.c[2] - ez) ** 2;
            const sorted = [...glassTris].sort((a, b) => far(b) - far(a)); // far first
            const out = new Float32Array(sorted.length * 3 * GL_FLOATS);
            sorted.forEach((t, k) => out.set(glassSource.subarray(t.at, t.at + 3 * GL_FLOATS), k * 3 * GL_FLOATS));
            upload(glassBuf, out);
            glassCount = sorted.length * 3;
        }
        if (!glassTris.length)
            glassCount = 0;
        // studio rig, relative to the camera: key upper left in front, fill from the right, rim from behind and above
        const rig = (f, r, up) => norm([0, 1, 2].map((k) => -cam.f[k] * f + cam.r[k] * r + cam.u[k] * up));
        const S = studio ? { fill: 0.4, rim: 1, ...(studio === true ? {} : studio) } : null;
        const vp = viewProjection(cam);
        const key = S ? rig(0.7, -0.5, 0.6) : norm(L.direction);
        const fill = rig(0.6, 0.8, 0.1);
        const rim = rig(-0.8, 0.3, 0.5);
        const setU = (u) => {
            gl.uniformMatrix4fv(u.vp, false, vp);
            gl.uniform4f(u.light, key[0], key[1], key[2], 0);
            gl.uniform4f(u.sky, L.sky[0], L.sky[1], L.sky[2], 0);
            gl.uniform4f(u.ground, L.ground[0], L.ground[1], L.ground[2], 0);
            gl.uniform4f(u.eye, cam.eye[0], cam.eye[1], cam.eye[2], 0);
            gl.uniform4f(u.mat, M.ambient, M.diffuse, M.specular, M.shininess);
            gl.uniform4f(u.fx, filmic ? 1 : 0, filmic ? filmic.exposure : 1, filmic ? filmic.emit : 0, S ? 1 : 0);
            gl.uniform4f(u.fill, fill[0], fill[1], fill[2], S ? S.fill : 0);
            gl.uniform4f(u.rim, rim[0], rim[1], rim[2], S ? S.rim : 0);
        };
        gl.viewport(0, 0, px, px);
        gl.clearColor(background[0], background[1], background[2], 1);
        gl.clearDepth(1);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        gl.disable(gl.CULL_FACE);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        if (vertexCount) {
            gl.useProgram(meshProg);
            setU(meshU);
            gl.bindVertexArray(solidVao);
            gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
        }
        if (instCount && protoCount) {
            gl.useProgram(instProg);
            setU(instU);
            gl.bindVertexArray(instVao);
            gl.drawArraysInstanced(gl.TRIANGLES, 0, protoCount, instCount);
        }
        if (glassCount) {
            // after everything solid: see-through faces, far to near; they test depth but do not write it
            gl.useProgram(meshProg);
            setU(meshU);
            gl.enable(gl.BLEND);
            gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
            gl.bindVertexArray(glassVao);
            gl.drawArrays(gl.TRIANGLES, 0, glassCount);
            gl.depthMask(true);
            gl.disable(gl.BLEND);
        }
        gl.bindVertexArray(null);
    };
    const render = (mesh, view, options) => draw(mesh, view, options);
    const pixels = (mesh, view, options) => {
        draw(mesh, view, options);
        const raw = new Uint8Array(px * px * 4);
        gl.readPixels(0, 0, px, px, gl.RGBA, gl.UNSIGNED_BYTE, raw); // read in the same task as the draw, before the buffer is presented
        const data = new Uint8ClampedArray(px * px * 4);
        for (let y = 0; y < px; y++)
            data.set(raw.subarray((px - 1 - y) * px * 4, (px - y) * px * 4), y * px * 4); // GL rows go bottom up
        for (let i = 3; i < data.length; i += 4)
            data[i] = 255;
        return Promise.resolve({ width: px, height: px, data });
    };
    const destroy = () => {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
    return { render, pixels, destroy, device: { lost }, adapter: null };
};
