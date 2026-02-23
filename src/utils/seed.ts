/**
 * Hashes a string into a deterministic 32-bit unsigned integer.
 * @param input String to hash.
 * @returns Unsigned 32-bit hash.
 */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Builds a deterministic pseudo-random number generator.
 * @param seed Initial generator seed.
 * @returns Function that yields values in the [0, 1) range.
 */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Derives a room-specific deterministic seed from run seed and room id.
 * @param runSeed Global run seed.
 * @param roomId Stable room identifier.
 * @returns Unsigned 32-bit derived seed.
 */
export function seedFromRoom(runSeed: number, roomId: string): number {
  return hashString(`${runSeed}:${roomId}`);
}
