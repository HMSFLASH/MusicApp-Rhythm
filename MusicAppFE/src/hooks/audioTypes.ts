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
  'BASS': {
    name: 'Bass',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.7, 4.8, 3.8, 2.7, 1.9, 0.7, -0.2, -0.6, -1.2, -1.5, -1.5, -1.5, -1.3, -0.8, -0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bassGain: 2.3,
    trebleGain: 0,
    preampGain: 0
  },
  'BASS_TREBLE': {
    name: 'Bass & Treble',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.7, 4.8, 3.8, 2.7, 1.9, 0.7, -0.2, -0.6, -1.2, -1.5, -1.5, -1.5, -1.3, -0.8, -0.2, 0.3, 0.7, 1.3, 2.4, 3.8, 5.6, 5.8, 5.8, 5.8, 5.8],
    bassGain: 2.3,
    trebleGain: 3,
    preampGain: 0
  },
  'PARAMETRIC_BASS_TREBLE': {
    name: 'Parametric Bass & Treble',
    isParametric: true,
    bands: [
      {
        id: 'param_bass_treble_1',
        frequency: 100,
        gain: 7,
        q: 1.03,
        channel: 'L+R' as const,
        type: 'lowshelf' as const
      },
      {
        id: 'param_bass_treble_2',
        frequency: 8000,
        gain: 6.2,
        q: 0.83,
        channel: 'L+R' as const,
        type: 'highshelf' as const
      }
    ],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'BASS_EXTREME': {
    name: 'Bass Extreme',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 5.9, 5.6, 5.2, 4.5, 3.1, 1.2, -0.2, -0.6, -1.2, -1.5, -1.5, -1.5, -1.3, -0.8, -0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bassGain: 9,
    trebleGain: 0,
    preampGain: -2.4
  },
  'CLARITY': {
    name: 'Clarity',
    isParametric: true,
    bands: [
      {
        id: 'param_clarity_1',
        frequency: 3350,
        gain: 6,
        q: 1.25,
        channel: 'L+R' as const,
        type: 'highshelf' as const
      }
    ],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  }
};

export function expandResonantEqBands(bands: EqBand[]): EqBand[] {
  return bands.flatMap(band => {
    if ((band.type === 'lowshelf' || band.type === 'highshelf') && band.q && band.q > 0.707) {
      const q = Number(band.q);
      const gain = Number(band.gain) || 0;
      if (Math.abs(gain) < 0.001) return [band];

      const qExcess = Math.max(0, q - 0.707);

      let peakGain = Math.sign(gain) * qExcess * Math.abs(gain) * 1.0;

      const offset = 1 + qExcess * 0.15;
      const peakFreq = band.type === 'lowshelf'
        ? band.frequency / offset
        : band.frequency * offset;

      return [
        { ...band, q: 1, id: `${band.id}_shelf` },
        { ...band, type: 'peaking', frequency: peakFreq, gain: peakGain, id: `${band.id}_peak` }
      ];
    }
    return [band];
  });
}

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
  presetMode?: 'custom' | 'parametric';
  preampGain?: number;
  bassGain?: number;
  trebleGain?: number;
};

export interface Track {
  id: string;
  fileName: string;
  sourceType: 'DRIVE' | 'LOCAL';
  driveFileId?: string;
  localFile?: File;
  imageUrl?: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  durationSeconds?: number;
  playCount?: number;
  bitrate?: number;
  numberOfChannels?: number;
  sampleRate?: number;
  bitsPerSample?: number;
  fileFormat?: string;
  codec?: string;
  fileSize?: number;
  lyrics?: string;
  coverChecked?: boolean;
}

export type SongEndMode = 'stop' | 'preload' | 'next' | 'repeat_one';
export type QueueEndMode = 'stop' | 'next' | 'repeat';
