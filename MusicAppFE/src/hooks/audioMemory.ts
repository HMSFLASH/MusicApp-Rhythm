/**
 * Utilities for explicit memory management of Web Audio API resources.
 * Large AudioBuffers (30MB - 100MB+ for uncompressed FLAC/WAV/AAC) can cause
 * significant heap retention and memory leaks during long playback sessions.
 * These helpers allow zeroing channel data and breaking reference chains
 * to trigger immediate reclamation by browser engines.
 */

/**
 * Explicitly releases an AudioBuffer by zeroing out its internal Float32Array
 * channel data. This cuts memory retention pressure and signals to V8 / Web Audio
 * engine that the buffer contents are no longer needed.
 */
export const explicitReleaseAudioBuffer = (
  buffer: AudioBuffer | null | undefined
): void => {
  if (!buffer) return;

  try {
    const channelCount = buffer.numberOfChannels;
    for (let i = 0; i < channelCount; i++) {
      const channelData = buffer.getChannelData(i);
      // Zero out the Float32Array to release memory pressure
      channelData.fill(0);
    }
  } catch {
    // Ignore errors if the buffer is already detached, closed, or read-only
  }
};

/**
 * Safely disconnects all connections from an AudioNode to prevent dangling
 * references in the Web Audio graph.
 */
export const explicitReleaseAudioNode = (
  node: AudioNode | null | undefined
): void => {
  if (!node) return;

  try {
    node.disconnect();
  } catch {
    // Ignore errors if the node is already disconnected or in an invalid state
  }
};

/**
 * Explicitly releases and clears all AudioBuffers stored in a Map cache.
 */
export const clearAudioBufferCache = (
  cache: Map<string, AudioBuffer>
): void => {
  for (const buffer of cache.values()) {
    explicitReleaseAudioBuffer(buffer);
  }
  cache.clear();
};
