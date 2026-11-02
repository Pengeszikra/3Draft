import type { Camera, Hit, Mesh } from './types.js';
/**
 * Starts the kernel. Resolves a picker { pick(mesh, cam, x, y, options), loaded } or rejects when
 * WebAssembly is not available.
 */
/** The HEXAW kernel (kernel/pick.hexaw compiled to WebAssembly): ray picking with the same results as pick(). */
export interface Kernel {
    pick(mesh: Mesh, camera: Camera, x: number, y: number, options?: {
        cull?: boolean;
    }): Hit | null;
    readonly loaded: Mesh | null;
    instance: WebAssembly.Instance;
}
export declare const initKernel: () => Promise<Kernel>;
