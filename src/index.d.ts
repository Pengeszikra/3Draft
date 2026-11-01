export const name: '3draft';
export const version: string;

export type Vec3 = [number, number, number];

export interface Face {
  /** Point indices, CCW seen from outside. */
  v: number[];
  color?: string;
}

export interface Mesh {
  positions: Vec3[];
  faces: Face[];
}

export interface BoxOptions {
  size?: Vec3;
  at?: Vec3;
  color?: string;
  /** Orthonormal local x/y/z axes (default: the world axes). */
  axes?: [Vec3, Vec3, Vec3];
}

export function box(options?: BoxOptions): Mesh;
/** Prism from a convex footprint [[x, z], ...] (any winding), extruded up from `y` by `height`. */
export function extrude(options: { polygon: [number, number][]; height?: number; y?: number; color?: string }): Mesh;
export function merge(...meshes: Mesh[]): Mesh;
/** Turntable rotation (radians): yaw around Y, then pitch around X, around `center`. */
export function rotate(mesh: Mesh, angles?: { yaw?: number; pitch?: number }, center?: Vec3): Mesh;
export function bounds(mesh: Mesh): { center: Vec3; radius: number };
export function faceNormal(points: Vec3[]): Vec3;
export function faceCenter(points: Vec3[]): Vec3;

export type ViewName = 'front' | 'side' | 'top' | 'persp';
export const VIEW_ORDER: readonly ViewName[];

/** Custom camera: `dir` points from the target towards the eye. */
export interface ViewSpec {
  dir: Vec3;
  up: Vec3;
  ortho?: boolean;
  name?: string;
}

export interface Fit {
  center: Vec3;
  radius: number;
}

export interface Camera {
  name: string;
  eye: Vec3;
  f: Vec3;
  r: Vec3;
  u: Vec3;
  ortho: boolean;
  k: number;
  size: number;
}

export function makeCamera(view: ViewName | ViewSpec, mesh: Mesh, size: number, fit?: Fit): Camera;
export function project(camera: Camera, p: Vec3): { x: number; y: number; depth: number };

/** Ray through a panel pixel, the inverse of `project`. `dir` is a unit vector. */
export function ray(camera: Camera, x: number, y: number): { origin: Vec3; dir: Vec3 };

export interface Hit {
  /** Index into `mesh.faces`. */
  face: number;
  /** Distance along the ray. */
  distance: number;
  point: Vec3;
  /** Unit normal, facing the camera. */
  normal: Vec3;
  /** Whether the face itself faces the camera. */
  front: boolean;
  color?: string;
}

/** The nearest surface under panel pixel (x, y), or null. */
export function pick(
  mesh: Mesh,
  camera: Camera,
  x: number,
  y: number,
  options?: { cull?: boolean },
): Hit | null;

/** A target cross lying on the picked surface: 4 arms and a ring, as 3D polylines. */
export function crosshair(mesh: Mesh, hit: Hit, radius?: number): Vec3[][];

/** 3D polylines drawn on top of the view. */
export interface Mark {
  name?: string;
  lines: Vec3[][];
  color?: string;
  width?: number;
}

/** '26.11.1001' -> '26.11.01.001' */
/** Turntable as a camera: the object stays put, the eye orbits (radians). */
export function orbit(angles?: { yaw?: number; pitch?: number; ortho?: boolean; name?: string }): ViewSpec;

export interface StandOptions {
  /** Square base edge (default 0.15). */
  base?: number;
  /** Height (default 3 x base). */
  height?: number;
  color?: string;
}
/** A prism standing on the picked surface, along its normal. */
export function standOn(mesh: Mesh, hit: Hit, options?: StandOptions): Mesh;

/** Back-to-front paint order of projected faces (plane tests; depth fallback on cycles). */
export function paintOrder(items: unknown[]): number[];

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
  dpr?: number;
}
export interface Gpu {
  render(mesh: Mesh, view: ViewName | ViewSpec, options?: GpuRenderOptions): void;
  /** Same frame, drawn offscreen and read back as RGBA (tests, thumbnails). */
  pixels(mesh: Mesh, view: ViewName | ViewSpec, options?: GpuRenderOptions): Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
  destroy(): void;
}
/** WebGPU renderer on a canvas; rejects when WebGPU is unavailable. Same camera as the SVG renderer. */
export function createGpu(canvas: HTMLCanvasElement, options?: { sampleCount?: number }): Promise<Gpu>;
/** Column-major 4x4 matrix mapping world points to the same pixels as project(). */
export function viewProjection(camera: Camera, near?: number, far?: number): Float32Array;
/** Triangle list: position(3) normal(3) color(3) per vertex. */
export function buildVertices(mesh: Mesh): Float32Array;
export const defaultLight: Required<GpuLight>;
export const defaultMaterial: Required<GpuMaterial>;

export interface Validation {
  vertices: number;
  faces: number;
  /** Every edge is shared by two faces, wound consistently. */
  closed: boolean;
  openEdges: number;
  /** Signed volume; null unless closed. */
  volume: number | null;
  /** Closed, but the faces point inward. */
  inside_out: boolean;
  degenerateFaces: number[];
  nonPlanarFaces: number[];
  nonConvexFaces: number[];
  ok: boolean;
  /** Plain-text findings. */
  notes: string[];
}
/** Geometry checks: closed shell, CCW from outside, planar, convex faces. */
export function validate(mesh: Mesh): Validation;

/** Extrude / taper / inset / dent a face; returns the new mesh, the cap face index and the new side quads. */
export function extrudeFace(mesh: Mesh, face: number, options?: { distance?: number; scale?: number; color?: string }): { mesh: Mesh; cap: number; sides: number[] };
export function moveVertices(mesh: Mesh, indices: number[], delta: Vec3): Mesh;

export function displayVersion(version: string): string;

export interface RenderOptions {
  /** Panel size in px (default 400). */
  size?: number;
  /** Drop back-facing faces (default true). */
  cull?: boolean;
  /** Draw the vertices as circles (default true). */
  points?: boolean;
  stroke?: string;
  pointColor?: string;
  background?: string;
  /** Keep the camera target/framing fixed while the mesh moves. */
  fit?: Fit;
  /** 3D polylines drawn on top, e.g. the surface cursor. */
  marks?: Mark[];
}

export function renderView(mesh: Mesh, view: ViewName | ViewSpec, options?: RenderOptions): string;
export function renderViews(mesh: Mesh, options?: RenderOptions): { name: ViewName; svg: string }[];
export function renderSheet(mesh: Mesh, options?: RenderOptions): string;

export interface Info {
  name: string;
  version: string;
  stage: 'pre-alpha';
  goals: string[];
}

export function info(): Info;
