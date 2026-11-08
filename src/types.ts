// Shared types of the engine. Everything is plain data: arrays and objects.

export type Vec3 = [number, number, number];

export interface Face {
  /** Point indices, CCW seen from outside. */
  v: number[];
  color?: string;
  /** Name of a palette entry (see material.ts); `color` is the fallback. */
  mat?: string;
}

export interface Mesh {
  positions: Vec3[];
  faces: Face[];
}

/** An orthonormal right-handed frame: local x, y and z axes. */
export type Axes = [Vec3, Vec3, Vec3];

export type ViewName = 'front' | 'side' | 'top' | 'persp';

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
  /** Perspective only: distance from the eye to the center. A first-person eye sits almost on the center. */
  dist?: number;
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

/** 3D polylines drawn on top of the view. */
export interface Mark {
  name?: string;
  lines: Vec3[][];
  color?: string;
  width?: number;
  /** 0..1, default 1. */
  opacity?: number;
}
