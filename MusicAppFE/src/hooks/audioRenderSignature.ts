import type { EqBand } from './audioTypes';

export type AudioRenderParams = {
  preampGain: number;
  eqBands: EqBand[];
  bassGain: number;
  trebleGain: number;
  compThreshold: number;
  compRatio: number;
  compKnee: number;
  compAttack: number;
  compRelease: number;
  compRmsSize: number;
  compMakeupGain: number;
  reverbMix: number;
  reverbTime: number;
  stereoWidth: number;
  panValue: number;
  useOversample: boolean;
  loudnessNormalization: boolean;
};

export type FxEnabledFlags = Partial<Record<
  'preamp' | 'eq' | 'tone' | 'comp' | 'reverb' | 'stereo' | 'master' | 'limiter' | 'interpolate',
  boolean
>>;

export const createRenderSignature = (
  params: AudioRenderParams,
  enabled: FxEnabledFlags = {}
) => JSON.stringify({
  fxEnabled: {
    preamp: Boolean(enabled.preamp),
    eq: Boolean(enabled.eq),
    tone: Boolean(enabled.tone),
    comp: Boolean(enabled.comp),
    reverb: Boolean(enabled.reverb),
    stereo: Boolean(enabled.stereo),
    master: Boolean(enabled.master),
    limiter: Boolean(enabled.limiter),
    interpolate: Boolean(enabled.interpolate),
  },
  preampGain: params.preampGain,
  eqBands: Array.isArray(params.eqBands)
    ? params.eqBands.map((band: EqBand) => ({
      frequency: band.frequency,
      gain: band.gain,
      q: band.q,
      channel: band.channel,
      type: band.type || 'peaking',
    }))
    : [],
  bassGain: params.bassGain,
  trebleGain: params.trebleGain,
  compThreshold: params.compThreshold,
  compRatio: params.compRatio,
  compKnee: params.compKnee,
  compAttack: params.compAttack,
  compRelease: params.compRelease,
  compRmsSize: params.compRmsSize,
  compMakeupGain: params.compMakeupGain,
  reverbMix: params.reverbMix,
  reverbTime: params.reverbTime,
  stereoWidth: params.stereoWidth,
  panValue: params.panValue,
  useOversample: Boolean(params.useOversample),
  loudnessNormalization: Boolean(params.loudnessNormalization),
});
