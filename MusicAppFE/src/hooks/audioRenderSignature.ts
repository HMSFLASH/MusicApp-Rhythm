import type { EqBand, BalancerMode } from './audioTypes';

export type AudioRenderParams = {
  preampGain: number;
  eqBands: EqBand[];
  bassGain: number;
  trebleGain: number;
  balancerMode: BalancerMode;
  balancerOffset: number;
  balancerTargetDb: number;
  balancerDeadzoneDb: number;
  balancerUpwardStrength: number;
  balancerDownwardStrength: number;
  balancerMaxUpwardDb: number;
  balancerMaxDownwardDb: number;
  balancerSpeed: number;
  balancerNoiseFloorDb: number;
  balancerLookaheadMs: number;
  balancerCeilingDb: number;
  balancerUseKWeight: boolean;
  reverbMix: number;
  reverbTime: number;
  stereoWidth: number;
  stereoCrossoverLow: number;
  stereoCrossoverHigh: number;
  stereoCrossoverMode: 'inside' | 'outside';
  surroundWet?: number;
  surroundDelay?: number;
  speakerMode?: 'stereo' | 'phase-safe-mono' | 'mono-sum';
  monoThreshold?: number;
  monoSideLevel?: number;
  chorusAmount?: number;
  panValue: number;
  loudnessNormalization: boolean;
  useOversample: boolean;
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

  useOversample: Boolean(params.useOversample),
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
  balancerMode: params.balancerMode,
  balancerOffset: params.balancerOffset,
  balancerTargetDb: params.balancerTargetDb,
  balancerDeadzoneDb: params.balancerDeadzoneDb,
  balancerUpwardStrength: params.balancerUpwardStrength,
  balancerDownwardStrength: params.balancerDownwardStrength,
  balancerMaxUpwardDb: params.balancerMaxUpwardDb,
  balancerMaxDownwardDb: params.balancerMaxDownwardDb,
  balancerSpeed: params.balancerSpeed,
  balancerNoiseFloorDb: params.balancerNoiseFloorDb,
  balancerLookaheadMs: params.balancerLookaheadMs,
  balancerCeilingDb: params.balancerCeilingDb,
  balancerUseKWeight: Boolean(params.balancerUseKWeight),
  reverbMix: params.reverbMix,
  reverbTime: params.reverbTime,
  stereoWidth: params.stereoWidth,
  stereoCrossoverLow: params.stereoCrossoverLow,
  stereoCrossoverHigh: params.stereoCrossoverHigh,
  stereoCrossoverMode: params.stereoCrossoverMode,
  surroundWet: params.surroundWet ?? 14,
  surroundDelay: params.surroundDelay ?? 12,
  speakerMode: params.speakerMode || 'stereo',
  monoThreshold: params.monoThreshold ?? 0.985,
  monoSideLevel: params.monoSideLevel ?? 100,
  chorusAmount: params.chorusAmount ?? 0,
  panValue: params.panValue,
  loudnessNormalization: Boolean(params.loudnessNormalization),
});
