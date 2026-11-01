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
}

export function box(options?: BoxOptions): Mesh;
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
