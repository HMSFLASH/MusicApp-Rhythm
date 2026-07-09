import { FLACDecoder, type FLACDecodedAudio } from '@wasm-audio-decoders/flac';

const readUint24 = (data: Uint8Array, offset: number) => (
  (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
);

const readFlacStreamInfoDuration = (data: Uint8Array) => {
  if (
    data.length < 42 ||
    data[0] !== 0x66 ||
    data[1] !== 0x4c ||
    data[2] !== 0x61 ||
    data[3] !== 0x43
  ) {
    return 0;
  }

  let offset = 4;
  while (offset + 4 <= data.length) {
    const header = data[offset];
    const blockType = header & 0x7f;
    const blockLength = readUint24(data, offset + 1);
    offset += 4;

    if (offset + blockLength > data.length) return 0;
    if (blockType === 0 && blockLength >= 18) {
      const packed =
        (BigInt(data[offset + 10]) << 56n) |
        (BigInt(data[offset + 11]) << 48n) |
        (BigInt(data[offset + 12]) << 40n) |
        (BigInt(data[offset + 13]) << 32n) |
        (BigInt(data[offset + 14]) << 24n) |
        (BigInt(data[offset + 15]) << 16n) |
        (BigInt(data[offset + 16]) << 8n) |
        BigInt(data[offset + 17]);
      const sampleRate = Number((packed >> 44n) & 0xfffffn);
      const totalSamples = Number(packed & 0xfffffffffn);
      return sampleRate > 0 && totalSamples > 0 ? totalSamples / sampleRate : 0;
    }

    offset += blockLength;
    if (header & 0x80) break;
  }

  return 0;
};

const getDecodedSampleCount = (decoded: FLACDecodedAudio) => (
  decoded.samplesDecoded || decoded.channelData[0]?.length || 0
);

const getSilenceInsertOffset = (decoded: FLACDecodedAudio, decodedSamples: number) => {
  const firstErrorOffset = decoded.errors
    ?.map((error) => error.outputSamples)
    .find((offset) => Number.isFinite(offset) && offset >= 0);

  return Math.min(decodedSamples, Math.max(0, firstErrorOffset ?? decodedSamples));
};

const createPaddedChannelData = (
  decoded: FLACDecodedAudio,
  targetSamples: number,
) => {
  const decodedSamples = getDecodedSampleCount(decoded);
  const missingSamples = targetSamples - decodedSamples;
  if (missingSamples <= 0) {
    return decoded.channelData.map((channel) => new Float32Array(channel));
  }

  const insertOffset = getSilenceInsertOffset(decoded, decodedSamples);
  return decoded.channelData.map((channel) => {
    const padded = new Float32Array(targetSamples);
    padded.set(channel.subarray(0, insertOffset), 0);
    padded.set(channel.subarray(insertOffset), insertOffset + missingSamples);
    return padded;
  });
};

export const decodeFlacToAudioBuffer = async (
  ctx: BaseAudioContext,
  data: Uint8Array,
  expectedDurationSeconds?: number,
) => {
  const decoder = new FLACDecoder();
  try {
    await decoder.ready;
    const decoded = await decoder.decodeFile(data);
    const decodedSamples = getDecodedSampleCount(decoded);
    const streamInfoDuration = readFlacStreamInfoDuration(data);
    const targetDurationSeconds = expectedDurationSeconds && Number.isFinite(expectedDurationSeconds)
      ? expectedDurationSeconds
      : streamInfoDuration;
    const expectedSamples = targetDurationSeconds > 0
      ? Math.round(targetDurationSeconds * decoded.sampleRate)
      : 0;
    const targetSamples = Math.max(decodedSamples, expectedSamples);
    const channelData = createPaddedChannelData(decoded, targetSamples);

    const audioBuffer = ctx.createBuffer(
      Math.max(1, channelData.length),
      Math.max(1, targetSamples),
      decoded.sampleRate,
    );

    channelData.forEach((channel, index) => {
      audioBuffer.copyToChannel(channel, index);
    });

    if (decoded.errors?.length) {
      console.warn('[Audio] FLAC WASM decoded with recoverable errors', decoded.errors);
    }

    return audioBuffer;
  } finally {
    decoder.free();
  }
};
