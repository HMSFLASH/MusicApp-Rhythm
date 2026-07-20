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
  },
  'CLASSICAL': {
    name: 'Classical',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.5, -1.4, -2.6, -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -3.3, -3.8, -4.5, -4.5],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'DANCE': {
    name: 'Dance',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [5.8, 5.8, 5.8, 5.8, 5.0, 4.0, 3.1, 2.8, 2.4, 1.9, 1.3, 0.5, 0, 0, 0, -0.3, -1.2, -2.2, -2.6, -2.3, -2.1, -2.0, -2.1, -2.2, -1.9, -1.4, -0.7, -0.4, -0.2, 0.1, 0.1],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'LIVE': {
    name: 'Live',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [-4.5, -4.5, -4.5, -4.5, -4.3, -4.0, -3.4, -1.6, 0.6, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.2, 2.1, 2.0, 1.8, 1.6, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'MIDDLE': {
    name: 'Middle',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [-4.5, -4.5, -4.5, -4.5, -4.5, -4.5, -4.3, -3.4, -2.3, -1.2, -0.4, 0.8, 1.8, 2.7, 3.8, 4.5, 4.5, 4.5, 4.0, 3.1, 1.9, 1.2, 0.8, 0.2, -0.9, -2.4, -4.2, -4.8, -5.3, -6.0, -6.0],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'POP': {
    name: 'Pop',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [1.5, 1.5, 1.5, 1.6, 2.5, 3.5, 4.6, 5.0, 5.5, 5.6, 4.8, 3.7, 2.8, 2.4, 1.8, 1.3, 0.8, 0.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.8, 1.4, 1.8, 2.3, 3.0, 3.0],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'ROCK': {
    name: 'Rock',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [5.8, 5.8, 5.8, 5.8, 5.0, 4.1, 3.1, 2.5, 1.8, 0.9, -0.3, -1.9, -2.9, -2.7, -2.4, -1.7, -0.3, 1.4, 2.5, 2.9, 3.4, 4.0, 4.7, 5.6, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.8],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'SOFT': {
    name: 'Soft',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [5.5, 5.5, 5.5, 5.4, 4.6, 3.5, 2.4, 1.9, 1.3, 0.6, -0.4, -1.8, -2.9, -3.6, -4.5, -5.7, -7.4, -9.6, -10.9, -11.4, -12.2, -12.6, -12.9, -13.2, -12.8, -11.9, -10.8, -9.7, -8.4, -6.8, -6.7],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'SOFT_BASS': {
    name: 'Soft Bass',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 2.7, 1.9, 0.7, -0.3, -1.2, -2.3, -3.0, -3.0, -3.0, -2.5, -1.6, -0.4, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'SOFT_TREBLE': {
    name: 'Soft Treble',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, -0.3, -1.6, -3.3, -4.5, -4.5, -4.5, -4.5, -4.5, -4.5, -4.5, -4.5, -4.5, -4.3, -3.8, -3.2, -2.5, -1.5, -0.3, 0.9, 2.4, 4.2, 4.5, 4.5, 4.5, 4.5],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'SPEAKER': {
    name: 'Speaker',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [-2.9, -2.9, -2.9, -2.9, -2.9, -2.4, -1.7, -0.8, 0.1, 1.2, 2.5, 3.3, 3.6, 4.0, 4.3, 4.4, 4.6, 4.8, 5.0, 5.4, 5.7, 5.8, 5.9, 5.9, 5.2, 4.3, 3.3, 3.2, 3.1, 3.0, 3.0],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 7.2
  },
  'TECHNO': {
    name: 'Techno',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [5.8, 5.8, 5.8, 5.8, 5.8, 5.8, 5.5, 3.8, 1.6, -0.3, -1.1, -2.1, -2.8, -2.6, -2.3, -1.9, -1.2, -0.4, 0.6, 1.7, 3.1, 4.3, 5.5, 7.0, 7.5, 7.6, 7.7, 7.7, 7.6, 7.5, 7.5],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'TREBLE': {
    name: 'Treble',
    eqBands: [16, 20, 26, 32, 41, 52, 66, 84, 105, 135, 170, 220, 280, 350, 440, 560, 720, 910, 1200, 1500, 1900, 2300, 3000, 3800, 4800, 6100, 7700, 10000, 12500, 16000, 20000],
    gains: [-3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -3.0, -2.8, -2.4, -1.8, -1.5, -1.5, -1.5, -1.3, -0.8, -0.2, 1.1, 3.1, 5.6, 7.0, 8.0, 9.4, 10.2, 11.1, 12.2, 12.3],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'PARAMETRIC_PUNCHY_BASS': {
    name: 'Punchy Bass',
    isParametric: true,
    bands: [
      {
        id: 'param_punchy_bass_1',
        frequency: 142,
        gain: 7,
        q: 2,
        channel: 'L+R' as const,
        type: 'lowshelf' as const
      }
    ],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'PARAMETRIC_SOFT_BASS': {
    name: 'Parametric Soft Bass',
    isParametric: true,
    bands: [
      {
        id: 'param_soft_bass_1',
        frequency: 131,
        gain: 6.3,
        q: 0.97,
        channel: 'L+R' as const,
        type: 'lowshelf' as const
      }
    ],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'PARAMETRIC_VOICE': {
    name: 'Parametric Voice',
    isParametric: true,
    bands: [
      {
        id: 'param_voice_1',
        frequency: 505,
        gain: 3,
        q: 1.32,
        channel: 'L+R' as const,
        type: 'peaking' as const
      },
      {
        id: 'param_voice_2',
        frequency: 1450,
        gain: 6,
        q: 1.02,
        channel: 'L+R' as const,
        type: 'peaking' as const
      },
      {
        id: 'param_voice_3',
        frequency: 56,
        gain: -8.6,
        q: 1.05,
        channel: 'L+R' as const,
        type: 'lowshelf' as const
      },
      {
        id: 'param_voice_4',
        frequency: 8500,
        gain: -5.9,
        q: 0.83,
        channel: 'L+R' as const,
        type: 'highshelf' as const
      }
    ],
    bassGain: 0,
    trebleGain: 0,
    preampGain: 0
  },
  'PARAMETRIC_MIDDLE': {
    name: 'Parametric Middle',
    isParametric: true,
    bands: [
      {
        id: 'param_middle_1',
        frequency: 1500,
        gain: 9,
        q: 0.72,
        channel: 'L+R' as const,
        type: 'peaking' as const
      },
      {
        id: 'param_middle_2',
        frequency: 200,
        gain: -3.8,
        q: 1.01,
        channel: 'L+R' as const,
        type: 'lowshelf' as const
      },
      {
        id: 'param_middle_3',
        frequency: 12000,
        gain: -5.4,
        q: 0.6,
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
