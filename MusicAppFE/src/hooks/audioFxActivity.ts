import type { EqBand } from './audioTypes';
import { isNeutralDbGain, isNeutralPercentValue } from './audioMath';
import type { AudioRenderParams, FxEnabledFlags } from './audioRenderSignature';

const GAIN_BASED_EQ_TYPES = new Set<BiquadFilterType>(['peaking', 'lowshelf', 'highshelf']);

export const isActiveEqBand = (band: EqBand) => {
  const type = (band.type || 'peaking') as BiquadFilterType;
  return !GAIN_BASED_EQ_TYPES.has(type) || !isNeutralDbGain(band.gain);
};

export type AudioFxActivity = {
  preamp: boolean;
  eq: boolean;
  tone: boolean;
  comp: boolean;
  reverb: boolean;
  stereo: boolean;
  master: boolean;
  limiter: boolean;
  needsHeadroom: boolean;
  any: boolean;
};

export const getAudioFxActivity = (
  params: Pick<
    AudioRenderParams,
    'preampGain' | 'eqBands' | 'bassGain' | 'trebleGain' | 'reverbMix' | 'stereoWidth' | 'stereoCrossoverLow' | 'stereoCrossoverHigh' | 'stereoCrossoverMode' | 'panValue' | 'surroundWet' | 'surroundDelay' | 'speakerMode' | 'chorusAmount'
  >,
  enabled: FxEnabledFlags = {}
): AudioFxActivity => {
  const preamp = Boolean(enabled.preamp) && !isNeutralDbGain(params.preampGain);
  const eq = Boolean(enabled.eq) && Array.isArray(params.eqBands) && params.eqBands.some(isActiveEqBand);
  const tone = Boolean(enabled.tone) && (
    !isNeutralDbGain(params.bassGain) ||
    !isNeutralDbGain(params.trebleGain)
  );
  const comp = Boolean(enabled.comp);
  const reverb = Boolean(enabled.reverb) && !isNeutralPercentValue(params.reverbMix, 0);
  const stereo = Boolean(enabled.stereo) && (
    !isNeutralPercentValue(params.stereoWidth, 100) ||
    (Boolean(params.speakerMode) && params.speakerMode !== 'stereo') ||
    (typeof params.chorusAmount === 'number' && params.chorusAmount > 0) ||
    (typeof params.surroundWet === 'number' && params.surroundWet > 0)
  );
  const master = Boolean(enabled.master) && !isNeutralPercentValue(params.panValue, 0);
  const limiter = Boolean(enabled.limiter);
  const needsHeadroom = preamp || eq || tone || reverb || stereo;

  return {
    preamp,
    eq,
    tone,
    comp,
    reverb,
    stereo,
    master,
    limiter,
    needsHeadroom,
    any: needsHeadroom || comp || master || limiter,
  };
};
