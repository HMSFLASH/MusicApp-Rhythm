import decodeAac from '@audio/decode-aac';

export const decodeAacToAudioBuffer = async (
  ctx: BaseAudioContext,
  data: Uint8Array,
) => {
  // @audio/decode-aac automatically detects M4A or ADTS
  const { channelData, sampleRate } = await decodeAac(data);

  if (!channelData || channelData.length === 0) {
    throw new Error('AAC decoder returned no channel data');
  }

  const numChannels = channelData.length;
  const numSamples = channelData[0].length;

  const audioBuffer = ctx.createBuffer(
    Math.max(1, numChannels),
    Math.max(1, numSamples),
    sampleRate
  );

  channelData.forEach((channel: any, index: number) => {
    audioBuffer.copyToChannel(channel, index);
  });

  return audioBuffer;
};
