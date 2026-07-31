/**
 * Cryptographically secure random utilities using Web Crypto API.
 */

/**
 * Returns a pseudo-random floating point number between 0 (inclusive) and 1 (exclusive).
 * Drop-in replacement for Math.random() that satisfies SonarQube typescript:S2245.
 */
export const getSecureRandom = (): number => {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return array[0] / (0xffffffff + 1);
};

/**
 * Returns a cryptographically secure random string ID.
 */
export const getSecureRandomId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const array = new Uint8Array(16);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};
