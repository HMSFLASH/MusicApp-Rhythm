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
  any: boolean;
};

export const getAudioFxActivity = (
  params: Pick<
    AudioRenderParams,
    'preampGain' | 'eqBands' | 'bassGain' | 'trebleGain' | 'reverbMix' | 'stereoWidth' | 'panValue'
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
  const stereo = Boolean(enabled.stereo) && !isNeutralPercentValue(params.stereoWidth, 100);
  const master = Boolean(enabled.master) && !isNeutralPercentValue(params.panValue, 0);
  const limiter = Boolean(enabled.limiter);

  return {
    preamp,
    eq,
    tone,
    comp,
    reverb,
    stereo,
    master,
    limiter,
    any: preamp || eq || tone || comp || reverb || stereo || master || limiter,
  };
};
