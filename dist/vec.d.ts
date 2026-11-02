import type { Vec3 } from './types.js';
export declare const add: (a: Vec3, b: Vec3) => Vec3;
export declare const sub: (a: Vec3, b: Vec3) => Vec3;
export declare const scale: (a: Vec3, s: number) => Vec3;
export declare const dot: (a: Vec3, b: Vec3) => number;
export declare const cross: (a: Vec3, b: Vec3) => Vec3;
export declare const len: (a: Vec3) => number;
export declare const norm: (a: Vec3) => Vec3;
/** `a |> plus(b)` is a + b. */
export declare const plus: (b: Vec3) => (a: Vec3) => Vec3;
/** `a |> minus(b)` is a - b. */
export declare const minus: (b: Vec3) => (a: Vec3) => Vec3;
/** `a |> times(s)` is a * s. */
export declare const times: (s: number) => (a: Vec3) => Vec3;
