export const EQ_PRESETS = {
  '5_BANDS': [63, 250, 1000, 4000, 16000],
  '10_BANDS': [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
  '12_BANDS': [63, 125, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000],
  '15_BANDS': [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000],
  '16_BANDS': [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000, 20000],
  '24_BANDS': [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1600, 2500, 4000, 6300, 10000, 16000],
  '31_BANDS': [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000],
};

export const STYLISTIC_PRESETS = {
  'BASS_BOOST': {
    name: 'Bass Boost',
    eqBands: [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    gains: [3, 4, 3, 1, 0, -1, 0, 1, 1, 1],
    bassGain: 4,
    trebleGain: 1,
    preampGain: -2
  },
  'VOCAL_CLEAR': {
    name: 'Vocal Clear',
    eqBands: [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    gains: [-2, -1, 0, 1, 2, 3, 3, 2, 1, 0],
    bassGain: -1,
    trebleGain: 2,
    preampGain: -1
  },
  'TREBLE_BRIGHT': {
    name: 'Treble Bright',
    eqBands: [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    gains: [-1, -1, 0, 0, 0, 1, 2, 3, 4, 4],
    bassGain: 0,
    trebleGain: 4,
    preampGain: -2
  },
  'NIGHT_MODE': {
    name: 'Night Mode',
    eqBands: [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    gains: [-4, -3, -2, -1, 1, 2, 1, -1, -2, -3],
    bassGain: -4,
    trebleGain: -3,
    preampGain: 1
  }
};

export type CompressorSettings = {
  threshold: number;
  ratio: number;
  knee: number;
  attack: number;
  release: number;
  rmsSize: number;
  makeupGain: number;
};

export const COMPRESSOR_DEFAULTS: CompressorSettings = {
  threshold: -18,
  ratio: 3,
  knee: 12,
  attack: 5,
  release: 180,
  rmsSize: 5,
  makeupGain: 2
};

export const COMPRESSOR_RESET_SETTINGS: CompressorSettings = {
  threshold: 0,
  ratio: 1,
  knee: 0,
  attack: 0,
  release: 250,
  rmsSize: 5,
  makeupGain: 0
};

export interface EqBand {
  id: string; // unique id for React key
  frequency: number;
  gain: number;
  q: number; // Q-Factor
  channel: 'L+R' | 'L' | 'R'; // Target channel
  type: BiquadFilterType; // Filter shape
}

export type CustomEqPreset = {
  name: string;
  bands: EqBand[];
  isCustomOrigin?: boolean;
  preampGain?: number;
  bassGain?: number;
  trebleGain?: number;
};

export interface Track {
  id: string | number;
  fileName: string;
  sourceType: 'DRIVE' | 'LOCAL';
  localFile?: File;
  imageUrl?: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  durationSeconds?: number;
  bitrate?: number;
  numberOfChannels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  fileFormat?: string;
  codec?: string;
  fileSize?: number;
}

export type SongEndMode = 'stop' | 'preload' | 'next' | 'repeat_one';
export type QueueEndMode = 'stop' | 'next' | 'repeat';
