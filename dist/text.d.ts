import type { Mesh, Vec3 } from './types.js';
type Pt = [number, number];
/** The font: x 0..2, y 0..4 (the centre line of the strokes); accents rise above 4. */
export declare const GLYPHS: Record<string, Pt[][]>;
/** Grid units: the centre line is 4 high, the stroke 1: the letter is 5 high, so the stroke is 20 % of it. */
export declare const STROKE = 0.2;
export interface TextFrame {
    /** The lower left corner of the first letter. */
    origin: Vec3;
    /** The reading direction, the up direction and the outward normal of the face (a right-handed frame: right × up = normal). */
    right: Vec3;
    up: Vec3;
    normal: Vec3;
    /** The letter height: also the face height it was taken from. */
    height: number;
}
/** The frame of a face: it starts in the lower left corner (up = world up on the face; on a floor or ceiling: away from the viewer), and its height is the face's height. */
export declare const faceFrame: (mesh: Mesh, face: number) => TextFrame;
export interface TextOptions {
    mat?: string;
    color?: string;
}
/**
 * Faces that lie in one plane and touch along an edge become one face (the boolean cuts the big sides into pieces; a letter wants
 * plain sides). Only when the result stays convex and the two have the same material. `edge(u, v)`, when given, must accept every
 * shared edge of a pair (the viewer's mirror joins only along its plane).
 */
export declare const mergeFlat: (mesh: Mesh, { edge }?: {
    edge?: (u: number, v: number) => boolean;
}) => Mesh;
/** The text as one mesh: every stroke a bar of stroke × stroke section standing out of the face by the stroke width. */
export declare const textMesh: (text: string, frame: TextFrame, { mat, color }?: TextOptions) => Mesh;
export {};
