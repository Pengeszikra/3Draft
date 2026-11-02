// WebGPU is used through duck typing: the engine does not depend on @webgpu/types.
// These ambient declarations keep the compiler quiet without pretending to describe the whole API.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const GPUBufferUsage: any;
declare const GPUTextureUsage: any;
declare const GPUMapMode: any;
interface Navigator {
  gpu?: any;
}
