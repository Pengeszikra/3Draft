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
export function bounds(mesh: Mesh): { center: Vec3; radius: number };
export function faceNormal(points: Vec3[]): Vec3;
export function faceCenter(points: Vec3[]): Vec3;

export type ViewName = 'front' | 'side' | 'top' | 'persp';
export const VIEW_ORDER: readonly ViewName[];

export interface Camera {
  name: ViewName;
  eye: Vec3;
  f: Vec3;
  r: Vec3;
  u: Vec3;
  ortho: boolean;
  k: number;
  size: number;
}

export function makeCamera(name: ViewName, mesh: Mesh, size: number): Camera;
export function project(camera: Camera, p: Vec3): { x: number; y: number; depth: number };

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
}

export function renderView(mesh: Mesh, name: ViewName, options?: RenderOptions): string;
export function renderViews(mesh: Mesh, options?: RenderOptions): { name: ViewName; svg: string }[];
export function renderSheet(mesh: Mesh, options?: RenderOptions): string;

export interface Info {
  name: string;
  version: string;
  stage: 'pre-alpha';
  goals: string[];
}

export function info(): Info;
