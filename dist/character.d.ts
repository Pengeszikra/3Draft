import type { Rig } from './rig.js';
import type { Material, Palette } from './material.js';
import type { Mesh } from './types.js';
export declare const CHARACTER_VERSION = 3;
export type CharacterBase = 'female' | 'male';
export type FaceShape = 'oval' | 'round' | 'square' | 'long';
export type HairStyle = 'short' | 'long' | 'bun' | 'bald';
export type BeardStyle = 'none' | 'full' | 'goatee';
export type OutfitKind = 'coat' | 'overall' | 'workwear' | 'crew' | 'astronaut';
export type PropKind = 'none' | 'tablet' | 'wrench' | 'commlock';
export interface CharacterSpec {
    version: number;
    base: CharacterBase;
    body: {
        height: number;
        build: number;
        shoulders: number;
        head: number;
    };
    /** skin: a palette material */
    face: {
        shape: FaceShape;
        jaw: number;
        nose: number;
        skin: string;
    };
    /** mat: a palette material */
    hair: {
        style: HairStyle;
        mat: string;
    };
    glasses: boolean;
    beard: BeardStyle;
    /** main / second: palette materials (main: the coat, jacket, overall, tunic or suit; second: trousers, the shirt, a crew tunic's left sleeve, a suit's joints); helmet: an astronaut's */
    outfit: {
        kind: OutfitKind;
        main: string;
        second: string;
        helmet: boolean;
    };
    prop: PropKind;
    /** the generation seed (Variate) */
    seed: number;
    /** the preset it came from, if any */
    role?: string;
}
/** The materials characters are made of (palette entries: add the missing ones to a palette). */
export declare const CHARACTER_MATERIALS: Record<string, Material>;
/** The material choices offered for skin, hair and cloth (any palette name works too). */
export declare const CHARACTER_SKINS: string[];
export declare const CHARACTER_HAIRS: string[];
export declare const CHARACTER_CLOTHS: string[];
/** The palette entries characters use, as { name, ...material } (the form a scene file's `palette` has). */
export declare const characterPalette: () => ({
    name: string;
} & Material)[];
/** The slider ranges in which the poses and the clothes still fit. */
export declare const CHARACTER_RANGES: {
    readonly height: readonly [1.45, 2.05];
    readonly build: readonly [-1, 1];
    readonly shoulders: readonly [-1, 1];
    readonly head: readonly [0.85, 1.4];
    readonly jaw: readonly [-1, 1];
    readonly nose: readonly [-1, 1];
};
export declare const FACE_SHAPES: FaceShape[];
export declare const HAIR_STYLES: HairStyle[];
export declare const BEARD_STYLES: BeardStyle[];
export declare const OUTFITS: OutfitKind[];
export declare const PROPS: PropKind[];
/** the parts, in the order buildCharacter() returns them (missing ones are left out) */
export declare const CHARACTER_PARTS: readonly ["body", "arms", "head", "face", "hair", "gear", "prop"];
export type CharacterPartId = (typeof CHARACTER_PARTS)[number];
export declare const CHARACTER_PRESETS: Record<string, CharacterSpec>;
/** A complete, valid spec from anything (missing or bad fields take the defaults; values are clamped; older specs are brought up: colours become materials, curly hair long, a tomato nothing). */
export declare const normalizeCharacter: (s?: any) => CharacterSpec;
/**
 * Another person in the same role: a different face, hair, build, skin and hair materials (from `seed`); the outfit's
 * kind and the prop stay, and so does the main cloth of a uniform (a crew tunic, a lab coat, a suit; a crew member's
 * sleeve, the department, may change).
 */
export declare const variateCharacter: (spec: CharacterSpec, seed: number) => CharacterSpec;
export interface CharacterPart {
    id: CharacterPartId;
    mesh: Mesh;
}
export interface Character {
    spec: CharacterSpec;
    parts: CharacterPart[];
    rig: Rig;
    height: number;
}
/**
 * The figure of a spec: its parts (stable ids, in CHARACTER_PARTS order, the empty ones left out) and its rig (the humanoid
 * joints, blended weights). Faces name palette materials; their colours come from `palette` (else CHARACTER_MATERIALS).
 * Use the rig with posed() / boneMatrices() / walkPose() / HUMANOID_POSES.
 */
export declare const buildCharacter: (input: any, palette?: Palette) => Character;
