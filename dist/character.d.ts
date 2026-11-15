import type { Rig } from './rig.js';
import type { Mesh } from './types.js';
export declare const CHARACTER_VERSION = 1;
export type CharacterBase = 'female' | 'male';
export type FaceShape = 'oval' | 'round' | 'square' | 'long';
export type HairStyle = 'short' | 'curly' | 'bun' | 'bald';
export type BeardStyle = 'none' | 'full' | 'goatee';
export type OutfitKind = 'coat' | 'overall' | 'workwear';
export type PropKind = 'none' | 'tablet' | 'wrench' | 'tomato';
export interface CharacterSpec {
    version: number;
    base: CharacterBase;
    body: {
        height: number;
        build: number;
        shoulders: number;
        head: number;
    };
    face: {
        shape: FaceShape;
        jaw: number;
        nose: number;
        skin: string;
    };
    hair: {
        style: HairStyle;
        color: string;
    };
    glasses: boolean;
    beard: BeardStyle;
    outfit: {
        kind: OutfitKind;
        color: string;
        color2: string;
    };
    prop: PropKind;
    /** the generation seed (curly hair, Variate) */
    seed: number;
    /** the preset it came from, if any */
    role?: string;
}
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
export declare const SKIN_TONES: string[];
export declare const HAIR_COLORS: string[];
/** the parts, in the order buildCharacter() returns them (missing ones are left out) */
export declare const CHARACTER_PARTS: readonly ["body", "outfit", "hair", "beard", "glasses", "prop"];
export type CharacterPartId = (typeof CHARACTER_PARTS)[number];
export declare const CHARACTER_PRESETS: Record<string, CharacterSpec>;
/** A complete, valid spec from anything (missing or bad fields take the defaults; values are clamped to the ranges). */
export declare const normalizeCharacter: (s?: any) => CharacterSpec;
/**
 * Another person in the same role: a different face, hair, build and colours (from `seed`); the outfit's kind and the prop
 * stay, the outfit's colours only shift a little, so the role still reads.
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
 * joints, every point on one joint). Use the rig with posed() / boneMatrices() / walkPose() / HUMANOID_POSES.
 */
export declare const buildCharacter: (input: any) => Character;
