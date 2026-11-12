import type { Mesh, Vec3 } from './types.js';
export interface Joint {
    name: string;
    /** Name of the joint this one hangs on; null for the root. Parents come before their children in a rig. */
    parent: string | null;
    /** The point the joint turns about, in the bind pose. */
    at: Vec3;
}
/** The joints that move one vertex: [index into `joints`, share]. The shares add up to 1. */
export type Weights = [joint: number, weight: number][];
export interface Rig {
    joints: Joint[];
    /** `skin[m][i]` belongs to vertex i of mesh m (the meshes the rig was made of, in that order). */
    skin: Weights[][];
}
/** Joint name -> [rx, ry, rz], relative to the bind pose, applied x, then y, then z in the parent's space. */
export type Pose = {
    [joint: string]: Vec3 | undefined;
};
export interface PoseOptions {
    /** Shifts the whole figure. */
    move?: Vec3;
    /** Puts the lowest point back on the height the bind pose stands on. */
    ground?: boolean;
}
/**
 * The meshes in a pose. `meshes` are the ones the rig was made of. Every vertex goes where its joints take it,
 * mixed by its weights; faces stay as they are unless the move bends them.
 */
export declare const posed: (meshes: Mesh[], rig: Rig, pose?: Pose, { move, ground }?: PoseOptions) => Mesh[];
/** Where the joints are in a pose (the same order as `rig.joints`). */
export declare const posedJoints: (rig: Rig, pose?: Pose, { move }?: PoseOptions) => Vec3[];
/**
 * The joint moves of a pose for a GPU skin: 12 floats per joint (`rig.joints` order), the three rows of the 3x4 matrix
 * [cols | shift], so a vertex goes to (dot(row0, [p, 1]), dot(row1, [p, 1]), dot(row2, [p, 1])). The same moves as posed().
 */
export declare const boneMatrices: (rig: Rig, pose?: Pose, { move }?: PoseOptions) => Float32Array;
/**
 * How much a posed figure must be lifted so that its lowest point stays where the bind pose's was (what `ground: true`
 * does in posed()), without building the posed meshes: only the heights of the points are mixed.
 */
export declare const poseLift: (meshes: Mesh[], rig: Rig, pose?: Pose) => number;
export declare const HUMANOID_JOINTS: readonly ["root", "spine", "head", "shoulderL", "elbowL", "wristL", "hipL", "kneeL", "ankleL", "shoulderR", "elbowR", "wristR", "hipR", "kneeR", "ankleR"];
/**
 * The skeleton and the weights of a standing figure, read off its shape. It must stand on two feet joined in one
 * mesh, look to +z, and its arms must hang (a relaxed or A pose; a T pose is not understood). Other meshes and loose
 * shells (hair, a hat, a watch) follow the nearest point of the body. Throws with the reason when no figure is found.
 *
 * Joints: root (hips), spine, head, and per side (L is +x) shoulder, elbow, wrist, hip, knee, ankle.
 */
export declare const humanoidRig: (meshes: Mesh[]) => Rig;
export declare const HUMANOID_POSES: Record<string, Pose>;
/** One frame of a walk on the spot (with `run`: a run); `t` goes from 0 to 1 round the loop. Use it with `ground: true`. */
export declare const walkPose: (t: number, { stride, run }?: {
    stride?: number;
    run?: boolean;
}) => Pose;
