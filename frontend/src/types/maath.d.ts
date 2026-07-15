declare module 'maath/random/dist/maath-random.esm' {
  export function inSphere(buffer: Float32Array, options?: { radius?: number }): Float32Array;
  export function inBox(buffer: Float32Array, options?: { sides?: number }): Float32Array;
  // Add other maath/random exports here if needed
}
