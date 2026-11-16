import type { Mesh, Vec3 } from './types.js';
export type JointType = 'glue' | 'pivot' | 'hinge' | 'rail' | 'spring';
export type M3 = [Vec3, Vec3, Vec3];
export interface MeshFrame {
    idx: [number, number, number];
}
export interface Joint {
    name: string;
    type: JointType;
    a: string;
    b: string;
    frameA: [number, number, number];
    frameB: [number, number, number];
    /** b's axes relative to a's at rest (in a's frame), for angles and limits. */
    rest: M3;
    /** glue: the contact (points in a's frame). */
    contact?: Vec3[];
    /** pivot: the point (a's frame); spring: the end on a. */
    at?: Vec3;
    /** hinge: the line (two points in a's frame). */
    axis?: [Vec3, Vec3];
    /** rail: the polyline (a's frame). */
    path?: Vec3[];
    /** rail: the slider point; spring: the end on b (b's frame). */
    bAt?: Vec3;
    /** pivot: the axes the limits are measured round (a's frame, rows x, y, z). */
    basis?: M3;
    /** hinge / rail: [min, max] (degrees / distance along the rail, in world units at creation). */
    limit?: [number, number];
    /** pivot: degrees per axis. */
    limits?: {
        x?: [number, number];
        y?: [number, number];
        z?: [number, number];
    };
    /** spring */
    restLength?: number;
    stiffness?: number;
    damping?: number;
    ends?: ['glue' | 'pivot', 'glue' | 'pivot'];
    /** spring: the object stretched between the ends, its line two of its vertices, and its mesh at rest. */
    spring?: {
        object: string;
        line: [number, number];
        mesh: Mesh;
        ends: [Vec3, Vec3];
    };
    /** rail: its length at creation in a's frame units (so limits scale with the object). */
    scaleA?: number;
}
export declare const v3: {
    add: (a: Vec3, b: Vec3) => Vec3;
    sub: (a: Vec3, b: Vec3) => Vec3;
    mul: (a: Vec3, s: number) => Vec3;
    dot: (a: Vec3, b: Vec3) => number;
    cross: (a: Vec3, b: Vec3) => Vec3;
    len: (a: Vec3) => number;
    norm: (a: Vec3) => Vec3;
};
/** The rotation matrix round the unit axis by angle (radians). */
export declare const axisAngle: (u: Vec3, t: number) => M3;
/** Three well spread vertices of a mesh: the first, the farthest from it, the farthest from their line. */
export declare const pickFrame: (mesh: Mesh) => [number, number, number];
export interface Frame3 {
    o: Vec3;
    R: M3;
    s: number;
}
export declare const frameOf: (mesh: Mesh, idx: [number, number, number]) => Frame3;
export declare const toLocal: (f: Frame3, p: Vec3) => Vec3;
export declare const toWorld: (f: Frame3, l: Vec3) => Vec3;
export declare const dirLocal: (f: Frame3, d: Vec3) => Vec3;
export declare const dirWorld: (f: Frame3, d: Vec3) => Vec3;
export interface JointSpec {
    name: string;
    type: JointType;
    a: string;
    b: string;
    at?: Vec3;
    contact?: Vec3[];
    axis?: [Vec3, Vec3];
    path?: Vec3[];
    slider?: Vec3;
    bAt?: Vec3;
    limit?: [number, number];
    limits?: {
        x?: [number, number];
        y?: [number, number];
        z?: [number, number];
    };
    basis?: M3;
    restLength?: number;
    stiffness?: number;
    damping?: number;
    ends?: ['glue' | 'pivot', 'glue' | 'pivot'];
    spring?: {
        object: string;
        line?: [number, number];
        mesh: Mesh;
    };
}
export declare const makeJoint: (spec: JointSpec, meshA: Mesh, meshB: Mesh) => Joint;
/** The nearest point of a polyline: the point, the distance along the line from its start, the segment's direction. */
export declare const closestOnPath: (path: Vec3[], p: Vec3) => {
    point: Vec3;
    s: number;
    dir: Vec3;
};
export declare const pathLength: (path: Vec3[]) => number;
export declare const pointAlong: (path: Vec3[], s: number) => Vec3;
export interface JointNow {
    type: JointType;
    /** hinge: degrees from rest; pivot: degrees per axis; rail: distance along; spring: length now. */
    angle?: number;
    angles?: Vec3;
    position?: number;
    length?: number;
    point?: Vec3;
    axis?: [Vec3, Vec3];
    path?: Vec3[];
    ends?: [Vec3, Vec3];
}
export declare const jointNow: (j: Joint, meshA: Mesh, meshB: Mesh) => JointNow;
export interface Rigid {
    R: M3;
    about: Vec3;
    t: Vec3;
}
export declare const ID3: M3;
export declare const applyRigid: (m: Rigid, p: Vec3) => Vec3;
export declare const moveMesh: (mesh: Mesh, m: Rigid) => Mesh;
/** Set a hinge to an angle (degrees from rest, clamped to its limit): the move of b. */
export declare const hingeTo: (j: Joint, meshA: Mesh, meshB: Mesh, deg: number) => {
    move: Rigid;
    angle: number;
};
/** Set a pivot to angles (degrees round its basis axes from rest, each clamped). */
export declare const pivotTo: (j: Joint, meshA: Mesh, meshB: Mesh, deg: Vec3) => {
    move: Rigid;
    angles: Vec3;
};
/** Turn a pivot by a world turn (axis, degrees), kept inside its limits. */
export declare const pivotTurn: (j: Joint, meshA: Mesh, meshB: Mesh, axis: Vec3, deg: number) => {
    move: Rigid;
    angles: Vec3;
};
/** Slide a rail's slider to the rail point nearest `p` (world), inside its limit: the move of b. */
export declare const railTo: (j: Joint, meshA: Mesh, meshB: Mesh, s: number) => {
    move: Rigid;
    position: number;
};
export declare const railNear: (j: Joint, meshA: Mesh, meshB: Mesh, p: Vec3) => {
    move: Rigid;
    position: number;
};
/** One step of a spring (b's translation): where its end is pulled towards the rest length; v is its velocity (world units / s). */
export declare const springStep: (j: Joint, meshA: Mesh, meshB: Mesh, v: Vec3, dt: number) => {
    move: Rigid;
    v: Vec3;
    rest: boolean;
};
/** The spring object stretched between the spring's two ends now. */
export declare const springMesh: (j: Joint, meshA: Mesh, meshB: Mesh) => Mesh | null;
export interface Linked {
    name: string;
    group?: string;
}
/**
 * The objects that move rigidly with `roots` when they are moved freely: their groups, everything glued to them (both ways) and
 * everything they hold by a pivot, hinge or rail (and so on down). Springs are not rigid: their held parts follow by the spring.
 */
export declare const carried: (roots: string[], objects: Linked[], joints: Joint[]) => string[];
/** The joint that holds `name` (it is the b of a pivot, hinge or rail), if any. */
export declare const holderOf: (name: string, joints: Joint[]) => Joint | undefined;
