export type V3 = [number, number, number];
export type M4 = ArrayLike<number>;
export type Side = 'left' | 'right';
/** A function a hand can take. `kind` is free for the program (an icon to draw, a material to show...). */
export interface TshFunction {
    id: string;
    label?: string;
    kind?: string;
    /** anything else the program wants to keep with it (a material index, a colour) */
    data?: unknown;
    /** a two-handed skill: chosen on either hand, it takes the other hand too (choosing anything else gives that hand back its
     * own function) */
    both?: boolean;
    /** its place in the grid on the back of the hand (row by row; −1 = the last cell of the last row, out of the way). Functions
     * without one fill the free cells in order. */
    slot?: number;
}
/** One hand as WebXR gives it: joint positions (room, metres) by their WebXR names, and the wrist's pose. */
export interface TshHand {
    joints: Record<string, V3>;
    wrist: M4;
    /** the middle metacarpal's pose, when there is one (its frame gives a steadier palm normal) */
    palm?: M4;
}
export interface TshGestures {
    fist: boolean;
    pinch: boolean;
    point: boolean;
    /** the index straight, whatever the other fingers do: the pointing ray can be aimed (pointing: the others curled too) */
    aim: boolean;
    /** while aiming, the thumb laid along the straight index (on its first two joints, not its tip) */
    thumbOn: boolean;
    /** the index and the ring finger both straight and pointing the same way (within 20°) */
    pair: boolean;
    click: boolean;
    /** the palm's middle (smoothed), the normal out of the BACK of the hand, the way the fingers point */
    palm: V3;
    back: V3;
    forward: V3;
    /** the pointing ray: from the index's knuckle along the index */
    rayFrom: V3 | null;
    rayDir: V3 | null;
    /** how long the fist has been closed (s), 0 when open */
    fistFor: number;
}
export interface TshIcon {
    fn: TshFunction;
    /** the icon's middle and its frame (x right, y up, z out toward the viewer), its size (m) */
    at: V3;
    x: V3;
    y: V3;
    z: V3;
    size: number;
    chosen: boolean;
    hover: boolean;
    /** the big copy of the chosen function, in front of the hand */
    big?: boolean;
}
export type TshEvent = {
    type: 'choose';
    side: Side;
    fn: TshFunction;
} | {
    type: 'fistClose';
    side: Side;
} | {
    type: 'fistOpen';
    side: Side;
    at: V3;
    heldFor: number;
} | {
    type: 'clickDown';
    side: Side;
}
/** the other three fingers curled while the index points: "this one" */
 | {
    type: 'pointStart';
    side: Side;
}
/** the thumb laid on the straight index: "this one" (the workshop's trigger for laying and erasing) */
 | {
    type: 'thumbDown';
    side: Side;
}
/** aiming with the index alone (the ring finger bent), then the ring finger straightened beside it: "lay it here" */
 | {
    type: 'pairStart';
    side: Side;
}
/** thumb and index tips come together */
 | {
    type: 'pinchStart';
    side: Side;
};
export interface TshHandState {
    seen: boolean;
    fn: TshFunction | null;
    g: TshGestures | null;
    icons: TshIcon[];
}
export interface TshFrame {
    left: TshHandState;
    right: TshHandState;
    events: TshEvent[];
}
export declare const TSH_JOINTS: string[];
/** The bones to draw a hand with: chains of joint names from the wrist to each tip. */
export declare const TSH_BONES: string[][];
/** Read both hands from a WebXR frame (joints in `space`). Hands that are not tracked are left out. */
export declare const readHands: (session: {
    inputSources: Iterable<any>;
}, frame: any, space: any) => Partial<Record<Side, TshHand>>;
interface Memory {
    fist?: boolean;
    pinch?: boolean;
    point?: boolean;
    click?: boolean;
    aim?: boolean;
    thumbOn?: boolean;
    pair?: boolean;
    aloneAt?: number;
    palm?: V3;
    back?: V3;
    rayFrom?: V3;
    rayDir?: V3;
    fistSince?: number;
}
/** A hand's gestures, with slack so they do not flicker. `mem` keeps the hand's state between frames. */
export declare const handGestures: (side: Side, h: TshHand, mem: Memory, now: number) => TshGestures;
export interface TshOptions {
    left?: TshFunction[];
    right?: TshFunction[];
    /** the icons' grid on the back of the hand: columns, the cell (m), the height over the skin (m) */
    columns?: number;
    cell?: number;
    lift?: number;
    /** the big copy of the chosen function (only a sign: it does not react to a touch): its size (m), how far out along the
     * fingers from the palm's middle (m) and how high over them (m) */
    bigSize?: number;
    bigAhead?: number;
    bigOut?: number;
    /** how close the other hand's fingertip must come to an icon's middle to choose it (m) */
    reach?: number;
}
/**
 * A VRTSH: the functions of each hand and the choice between them. Call `update` every frame with the hands (readHands) and
 * the head's pose; it returns each hand's function, gestures and icons, and what happened (a choice, a fist closed or opened).
 */
export declare const createTsh: (opts?: TshOptions) => {
    update: (hands: Partial<Record<Side, TshHand>>, head: M4 | null, now: number) => TshFrame;
    /** the function a hand has now */
    fn: (side: Side) => TshFunction | null;
    /** give a hand a function by id (or the first of its list) */
    choose: (side: Side, id: string) => TshFunction | null;
    /** end a two-handed skill: both hands get back what they had before it */
    release: () => void;
    /** change a hand's list (the choice stays if it is still there) */
    setFunctions: (side: Side, list: TshFunction[]) => void;
    functions: (side: Side) => TshFunction[];
};
export {};
