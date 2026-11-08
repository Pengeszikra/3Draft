import type { Gpu } from './gpu.js';
/**
 * Sets up WebGL2 on a canvas. Rejects when WebGL2 is not available. Same call and options as createGpu:
 * returns { render(mesh, view, options), pixels(...), destroy() }. `device.lost` resolves when the context is lost.
 */
export declare const createGl: (canvas: HTMLCanvasElement, { onError }?: {
    onError?: (message: string) => void;
}) => Promise<Gpu>;
