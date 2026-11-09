import type { Mesh } from './types.js';
export type BooleanOp = 'union' | 'subtract' | 'intersect';
/** One connected piece of a mesh (faces joined by shared edges). */
export interface Part {
    /** Indices into mesh.faces. */
    faces: number[];
    closed: boolean;
    insideOut: boolean;
    openEdges: number;
}
export interface Health {
    parts: Part[];
    /** Faces in closed, outward parts: the ones a boolean can work with. */
    usableFaces: number;
    /** Faces in open (or inside-out) parts: a boolean ignores them. */
    skippedFaces: number;
    /** true when at least one part is a closed solid. */
    hasSolid: boolean;
    /** true when every part is a closed solid. */
    allSolid: boolean;
}
/** The connected parts of a mesh as separate meshes (each with its own vertex list), in face order of their first face. */
export declare const splitParts: (mesh: Mesh) => Mesh[];
/** Splits a mesh into connected parts and says which of them are closed solids (the health check). */
export declare const health: (mesh: Mesh) => Health;
/**
 * Boolean of two closed solids (outward CCW faces): 'union', 'subtract' (a minus b) or 'intersect'.
 * Throws with a reason when an input is open or inside out. With `strict: false` the parts that are not closed solids are
 * left out of the calculation instead (see `health`): a union keeps them as they are, a subtract keeps those of `a`,
 * an intersect drops them; it throws only when `a` has no closed part at all.
 */
export declare const boolean: (a: Mesh, b: Mesh, op: BooleanOp, { strict }?: {
    strict?: boolean;
}) => Mesh;
export declare const union: (a: Mesh, b: Mesh) => Mesh;
export declare const subtract: (a: Mesh, b: Mesh) => Mesh;
export declare const intersect: (a: Mesh, b: Mesh) => Mesh;
