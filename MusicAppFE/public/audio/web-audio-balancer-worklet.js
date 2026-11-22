const MIN_DB = -120;
const MIN_LIN = Math.pow(10, -120 / 20);
const MIN_PWR = Math.pow(10, -120 / 10);
const DN_CONST = 1e-25;
const LN10 = Math.LN10;
const DB10_SCALE = 10 / LN10;
const DB20_SCALE = 20 / LN10;
const DB2LN = LN10 / 20;
const BUF_SIZE = 8192;
const CTRL_STEP = 16;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

class WebAudioBalancerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'mode', defaultValue: 1, minValue: 0, maxValue: 3, automationRate: 'k-rate' },
      { name: 'enabled', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'loudnessOffset', defaultValue: 0, minValue: -6, maxValue: 6, automationRate: 'k-rate' },
      { name: 'targetDb', defaultValue: -18, minValue: -32, maxValue: -8, automationRate: 'k-rate' },
      { name: 'deadzoneDb', defaultValue: 2.0, minValue: 0, maxValue: 8, automationRate: 'k-rate' },
      { name: 'upwardStrength', defaultValue: 45, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'downwardStrength', defaultValue: 65, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'maxUpwardDb', defaultValue: 9.0, minValue: 0, maxValue: 20, automationRate: 'k-rate' },
      { name: 'maxDownwardDb', defaultValue: -14.0, minValue: -30, maxValue: 0, automationRate: 'k-rate' },
      { name: 'speed', defaultValue: 38, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
      { name: 'noiseFloorDb', defaultValue: -48, minValue: -80, maxValue: -25, automationRate: 'k-rate' },
      { name: 'lookaheadMs', defaultValue: 3.5, minValue: 1, maxValue: 10, automationRate: 'k-rate' },
      { name: 'ceilingDb', defaultValue: -1.0, minValue: -6, maxValue: -0.1, automationRate: 'k-rate' },
      { name: 'useKWeight', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();

    this.sr = Math.max(8000, sampleRate);
    this.ctrlDt = CTRL_STEP / this.sr;
    this.antiDenormal = DN_CONST;

    // Lookahead delay & monotonic min deque buffers (Float64 for sampleCounter avoids overflow)
    this.bufL = new Float32Array(BUF_SIZE);
    this.bufR = new Float32Array(BUF_SIZE);
    this.dqIdx = new Float64Array(BUF_SIZE);
    this.dqVal = new Float64Array(BUF_SIZE);

    this.delayPos = 0;
    this.dqHead = 0;
    this.dqTail = 0;
    this.sampleCounter = 0;
    this.ctrlCounter = 0;
    this.hangCounter = 0;

    // Envelopes & DSP states
    this.rmsEnvelope = 0;
    this.peakEnvelope = 0;
    this.slowPeakEnv = 0;

    this.rmsDb = MIN_DB;
    this.rmsLongDb = -20;
    this.peakDb = MIN_DB;
    this.slowPeakDb = MIN_DB;

    this.levelerGainDb = 0;
    this.heldGainDb = 0;
    this.currentGainDb = 0;
    this.levelerGainLin = 1;
    this.levelerGainStep = 0;

    this.limGain = 1;
    this.winMinGain = 1;
    this.limGrDb = 0;

    // Smart Auto analysis states
    this.estNoiseFloorDb = -52;
    this.avgCrestDb = 12;
    this.activityRatio = 0.7;
    this.musicDenseIdx = 0.5;
    this.smartTargetDb = -17.0;
    this.smartGateDb = -48.0;

    // K-Weighting biquad states (L/R)
    this.hsZ1L = 0; this.hsZ2L = 0;
    this.hsZ1R = 0; this.hsZ2R = 0;
    this.hpZ1L = 0; this.hpZ2L = 0;
    this.hpZ1R = 0; this.hpZ2R = 0;

    this.setupFilters();

    // Fixed sample-rate smoothers
    this.peakAttackCoeff = 1 - Math.exp(-1 / Math.max(1, 0.002 * this.sr));
    this.peakReleaseCoeff = 1 - Math.exp(-1 / Math.max(1, 0.120 * this.sr));
    this.slowPeakAtkCoeff = 1 - Math.exp(-1 / Math.max(1, 0.010 * this.sr));
    this.slowPeakRelCoeff = 1 - Math.exp(-1 / Math.max(1, 1.500 * this.sr));

    this.silenceDecayCoeff = 1 - Math.exp(-this.ctrlDt / 2.5);
    this.bypassCoeff = 1 - Math.exp(-this.ctrlDt / 0.04);

    this.rmsLongCoeff = 1 - Math.exp(-this.ctrlDt / 2.5);
    this.smartSmoothCoeff = 1 - Math.exp(-this.ctrlDt / 2.5);
    this.noiseDownCoeff = 1 - Math.exp(-this.ctrlDt / 1.2);
    this.noiseUpCoeff = 1 - Math.exp(-this.ctrlDt / 8.0);
    this.actCoeff = 1 - Math.exp(-this.ctrlDt / 3.0);

    // Active resolved parameter state
    this.mode = 1;
    this.isEnabled = true;
    this.loudnessOffset = 0;
    this.baseTargetDb = -16.5;
    this.targetDb = -16.5;
    this.deadzoneDb = 3.5;
    this.upwardStrength = 0.25;
    this.downwardStrength = 0.35;
    this.maxUpwardDb = 5.5;
    this.maxDownwardDb = -8.0;
    this.noiseFloorDb = -54.0;
    this.lookaheadTime = 0.004;
    this.ceilingDb = -1.0;
    this.useKWeight = true;

    this.rmsTime = 0.1;
    this.levelerAttackTime = 0.2;
    this.levelerReleaseTime = 0.8;
    this.hangTime = 0.5;
    this.limReleaseTime = 0.1;
    this.rmsCoeff = 0.01;
    this.lookaheadSamples = 192;
    this.limAttackCoeff = 0.02;
    this.limReleaseCoeff = 0.001;
    this.ceilingLinear = 1;
    this.softThresh = 0.96;
    this.softMargin = 0.04;
    this.hangSteps = 1000;

    // Parameter cache key to avoid re-running transcendental math every 128-sample block
    this.lastParamKey = '';

    // Opt-in live telemetry (~10 Hz when UI is mounted)
    this.telemetryEnabled = false;
    this.telemetryIntervalSamples = Math.max(128, Math.round(this.sr * 0.1));
    this.telemetrySampleAcc = 0;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'telemetry') {
        this.telemetryEnabled = Boolean(data.enabled);
        this.telemetrySampleAcc = 0;
      }
    };

    this.applySpeed(78);
    this.recomputeDerivedParams();
  }

  setupFilters() {
    const sr = this.sr;

    // Stage 1: ITU-R BS.1770 High-Shelf (+4 dB @ 1500 Hz)
    const f0Hs = Math.min(1500, sr * 0.4);
    const dBgain = 4.0;
    const qHs = 0.70710678;
    const A = Math.exp((dBgain * LN10) / 40);
    const w0Hs = (2 * Math.PI * f0Hs) / sr;
    const cosHs = Math.cos(w0Hs);
    const sinHs = Math.sin(w0Hs);
    const alphaHs = sinHs / (2 * qHs);
    const sqA = Math.sqrt(A);
    const a0Hs = (A + 1) - (A - 1) * cosHs + 2 * sqA * alphaHs;

    this.hsB0 = (A * ((A + 1) + (A - 1) * cosHs + 2 * sqA * alphaHs)) / a0Hs;
    this.hsB1 = (-2 * A * ((A - 1) + (A + 1) * cosHs)) / a0Hs;
    this.hsB2 = (A * ((A + 1) + (A - 1) * cosHs - 2 * sqA * alphaHs)) / a0Hs;
    this.hsA1 = (2 * ((A - 1) - (A + 1) * cosHs)) / a0Hs;
    this.hsA2 = ((A + 1) - (A - 1) * cosHs - 2 * sqA * alphaHs) / a0Hs;

    // Stage 2: RLB High-Pass (75 Hz, 2nd-order Butterworth)
    const f0Hp = Math.min(75, sr * 0.4);
    const qHp = 0.70710678;
    const w0Hp = (2 * Math.PI * f0Hp) / sr;
    const cosHp = Math.cos(w0Hp);
    const sinHp = Math.sin(w0Hp);
    const alphaHp = sinHp / (2 * qHp);
    const a0Hp = 1 + alphaHp;

    this.hpB0 = ((1 + cosHp) * 0.5) / a0Hp;
    this.hpB1 = (-(1 + cosHp)) / a0Hp;
    this.hpB2 = ((1 + cosHp) * 0.5) / a0Hp;
    this.hpA1 = (-2 * cosHp) / a0Hp;
    this.hpA2 = (1 - alphaHp) / a0Hp;
  }

  applySpeed(spd) {
    const s = clamp(spd / 100.0, 0.0, 1.0);
    this.rmsTime = 0.08 * Math.exp(s * Math.log(1.00 / 0.08));
    this.levelerAttackTime = 0.10 * Math.exp(s * Math.log(1.40 / 0.10));
    this.levelerReleaseTime = 0.40 * Math.exp(s * Math.log(2.60 / 0.40));
    this.hangTime = 0.30 + s * 0.70;
    this.limReleaseTime = 0.05 + s * 0.11;
  }

  recomputeDerivedParams() {
    const sr = this.sr;
    this.targetDb = clamp(this.baseTargetDb + this.loudnessOffset, -40.0, -4.0);
    this.rmsCoeff = 1 - Math.exp(-1 / Math.max(1, this.rmsTime * sr));
    this.lookaheadSamples = clamp(Math.floor(this.lookaheadTime * sr), 1, 4096);
    this.limAttackCoeff = 1 - Math.exp(-4.5 / Math.max(1, this.lookaheadSamples));
    this.limReleaseCoeff = 1 - Math.exp(-1 / Math.max(1, this.limReleaseTime * sr));
    this.ceilingLinear = Math.exp(this.ceilingDb * DB2LN);
    this.softThresh = this.ceilingLinear * 0.96;
    this.softMargin = this.ceilingLinear - this.softThresh;
    this.hangSteps = Math.floor(this.hangTime / this.ctrlDt);
  }

  updateParametersIfNeeded(parameters) {
    const pMode = Math.round(clamp(parameters.mode[0], 0, 3));
    const pEnabled = parameters.enabled[0] >= 0.5 ? 1 : 0;
    const pOffset = clamp(parameters.loudnessOffset[0], -6, 6);
    const pTarget = clamp(parameters.targetDb[0], -32, -8);
    const pDeadzone = clamp(parameters.deadzoneDb[0], 0, 8);
    const pUpStr = clamp(parameters.upwardStrength[0], 0, 100);
    const pDownStr = clamp(parameters.downwardStrength[0], 0, 100);
    const pMaxUp = clamp(parameters.maxUpwardDb[0], 0, 20);
    const pMaxDown = clamp(parameters.maxDownwardDb[0], -30, 0);
    const pSpeed = clamp(parameters.speed[0], 0, 100);
    const pGate = clamp(parameters.noiseFloorDb[0], -80, -25);
    const pLookahead = clamp(parameters.lookaheadMs[0], 1, 10);
    const pCeiling = clamp(parameters.ceilingDb[0], -6, -0.1);
    const pKWeight = parameters.useKWeight[0] >= 0.5 ? 1 : 0;

    const paramKey = pMode === 3
      ? `${pMode}|${pEnabled}|${pOffset}|${pTarget}|${pDeadzone}|${pUpStr}|${pDownStr}|${pMaxUp}|${pMaxDown}|${pSpeed}|${pGate}|${pLookahead}|${pCeiling}|${pKWeight}`
      : `${pMode}|${pEnabled}|${pOffset}`;

    if (paramKey === this.lastParamKey) return;
    this.lastParamKey = paramKey;

    this.mode = pMode;
    this.isEnabled = pEnabled === 1;
    this.loudnessOffset = pOffset;

    let activeSpeed = 38;
    if (pMode === 0) {
      this.baseTargetDb = -18.0;
      this.deadzoneDb = 2.0;
      this.upwardStrength = 0.45;
      this.downwardStrength = 0.65;
      this.maxUpwardDb = 9.0;
      this.maxDownwardDb = -14.0;
      activeSpeed = 38;
      this.noiseFloorDb = -48.0;
      this.lookaheadTime = 0.003;
      this.ceilingDb = -1.0;
      this.useKWeight = true;
    } else if (pMode === 1) {
      this.baseTargetDb = -16.5;
      this.deadzoneDb = 3.5;
      this.upwardStrength = 0.25;
      this.downwardStrength = 0.35;
      this.maxUpwardDb = 5.5;
      this.maxDownwardDb = -8.0;
      activeSpeed = 78;
      this.noiseFloorDb = -54.0;
      this.lookaheadTime = 0.004;
      this.ceilingDb = -1.0;
      this.useKWeight = true;
    } else if (pMode === 2) {
      this.baseTargetDb = -17.5;
      this.deadzoneDb = 2.5;
      this.upwardStrength = 0.40;
      this.downwardStrength = 0.55;
      this.maxUpwardDb = 11.0;
      this.maxDownwardDb = -15.0;
      activeSpeed = 50;
      this.noiseFloorDb = -50.0;
      this.lookaheadTime = 0.0035;
      this.ceilingDb = -1.0;
      this.useKWeight = true;
    } else {
      this.baseTargetDb = pTarget;
      this.deadzoneDb = pDeadzone;
      this.upwardStrength = pUpStr / 100.0;
      this.downwardStrength = pDownStr / 100.0;
      this.maxUpwardDb = pMaxUp;
      this.maxDownwardDb = pMaxDown;
      activeSpeed = pSpeed;
      this.noiseFloorDb = pGate;
      this.lookaheadTime = pLookahead / 1000.0;
      this.ceilingDb = pCeiling;
      this.useKWeight = pKWeight === 1;
    }

    this.applySpeed(activeSpeed);
    this.recomputeDerivedParams();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || !output.length) return true;

    const frameCount = output[0] ? output[0].length : 0;
    if (!input || !input.length) {
      for (let ch = 0; ch < output.length; ch += 1) {
        output[ch].fill(0);
      }
      return true;
    }

    this.updateParametersIfNeeded(parameters);

    const inChanL = input[0];
    const inChanR = input[1] || input[0];
    const outChanL = output[0];
    const outChanR = output[1];

    const isEnabled = this.isEnabled;
    const mode = this.mode;
    const useKWeight = this.useKWeight;

    for (let i = 0; i < frameCount; i += 1) {
      const spl0 = inChanL[i] || 0;
      const spl1 = inChanR[i] || 0;

      // 1. Detector Sidechain with Anti-Denormal Protection
      this.antiDenormal = -this.antiDenormal;
      const scL = spl0 + this.antiDenormal;
      const scR = spl1 + this.antiDenormal;

      let detL;
      let detR;
      if (useKWeight) {
        const tmpL = this.hsB0 * scL + this.hsZ1L;
        this.hsZ1L = this.hsB1 * scL - this.hsA1 * tmpL + this.hsZ2L;
        this.hsZ2L = this.hsB2 * scL - this.hsA2 * tmpL;

        const tmpR = this.hsB0 * scR + this.hsZ1R;
        this.hsZ1R = this.hsB1 * scR - this.hsA1 * tmpR + this.hsZ2R;
        this.hsZ2R = this.hsB2 * scR - this.hsA2 * tmpR;

        detL = this.hpB0 * tmpL + this.hpZ1L;
        this.hpZ1L = this.hpB1 * tmpL - this.hpA1 * detL + this.hpZ2L;
        this.hpZ2L = this.hpB2 * tmpL - this.hpA2 * detL;

        detR = this.hpB0 * tmpR + this.hpZ1R;
        this.hpZ1R = this.hpB1 * tmpR - this.hpA1 * detR + this.hpZ2R;
        this.hpZ2R = this.hpB2 * tmpR - this.hpA2 * detR;
      } else {
        detL = scL;
        detR = scR;
      }

      const instantEnergy = (detL * detL + detR * detR) * 0.5;
      this.rmsEnvelope += this.rmsCoeff * (instantEnergy - this.rmsEnvelope);

      // True raw waveform peak (always unfiltered for Peak Guard & Limiter)
      const peakInput = Math.max(Math.abs(spl0), Math.abs(spl1));
      const peakEnvIn = peakInput + DN_CONST;
      if (peakEnvIn > this.peakEnvelope) {
        this.peakEnvelope += this.peakAttackCoeff * (peakEnvIn - this.peakEnvelope);
      } else {
        this.peakEnvelope += this.peakReleaseCoeff * (peakEnvIn - this.peakEnvelope);
      }

      // Slow peak for Smart Auto Crest Factor
      if (mode === 2) {
        const detPeak = Math.max(Math.abs(detL), Math.abs(detR));
        if (detPeak > this.slowPeakEnv) {
          this.slowPeakEnv += this.slowPeakAtkCoeff * (detPeak - this.slowPeakEnv);
        } else {
          this.slowPeakEnv += this.slowPeakRelCoeff * (detPeak - this.slowPeakEnv);
        }
      }

      // 2. Control-Rate Leveler & Smart Auto Engine (every 16 samples)
      if (this.ctrlCounter === 0) {
        this.rmsDb = this.rmsEnvelope > MIN_PWR ? Math.log(this.rmsEnvelope) * DB10_SCALE : MIN_DB;
        this.peakDb = this.peakEnvelope > MIN_LIN ? Math.log(this.peakEnvelope) * DB20_SCALE : MIN_DB;

        let curTargetDb;
        let curDeadzoneDb;
        let curUpStr;
        let curDownStr;
        let curMaxUp;
        let curMaxDown;
        let activeGateDb;
        let curAtkTime;
        let curRelTime;

        if (mode === 2) {
          // Smart Auto Analyzer
          this.slowPeakDb = this.slowPeakEnv > MIN_LIN ? Math.log(this.slowPeakEnv) * DB20_SCALE : MIN_DB;

          if (this.rmsDb > -85) {
            if (this.rmsDb < this.estNoiseFloorDb) {
              this.estNoiseFloorDb += this.noiseDownCoeff * (this.rmsDb - this.estNoiseFloorDb);
            } else if (this.rmsDb < -35) {
              this.estNoiseFloorDb += this.noiseUpCoeff * (this.rmsDb - this.estNoiseFloorDb);
            }
            this.estNoiseFloorDb = clamp(this.estNoiseFloorDb, -64.0, -42.0);
          }

          activeGateDb = clamp(this.estNoiseFloorDb + 6.0, -56.0, -38.0);
          const isActive = this.rmsDb > activeGateDb ? 1 : 0;
          this.activityRatio += this.actCoeff * (isActive - this.activityRatio);

          if (isActive) {
            this.rmsLongDb += this.rmsLongCoeff * (this.rmsDb - this.rmsLongDb);
            const instCrest = clamp(this.slowPeakDb - this.rmsDb, 3.0, 26.0);
            this.avgCrestDb += this.smartSmoothCoeff * (instCrest - this.avgCrestDb);
          }

          const crestScore = clamp((14.0 - this.avgCrestDb) / 7.0, 0.0, 1.0);
          const actScore = clamp((this.activityRatio - 0.55) / 0.35, 0.0, 1.0);
          const targetDense = 0.65 * crestScore + 0.35 * actScore;
          this.musicDenseIdx += this.smartSmoothCoeff * (targetDense - this.musicDenseIdx);

          const m = this.musicDenseIdx;
          curTargetDb = clamp((-18.0 + m * 2.0) + this.loudnessOffset, -40.0, -4.0);
          curDeadzoneDb = 2.0 + m * 1.8;
          curUpStr = 0.50 - m * 0.25;
          curDownStr = 0.65 - m * 0.25;
          curMaxUp = 11.0 - m * 5.0;
          curMaxDown = -15.0 + m * 6.0;

          const jumpDb = Math.max(0, this.rmsDb - this.rmsLongDb);
          const jumpBoost = 1.0 + Math.max(0, jumpDb - 5.0) * 0.35;
          curAtkTime = (0.32 + m * 0.48) / jumpBoost;
          curRelTime = 0.90 + m * 0.95;

          this.smartTargetDb = curTargetDb;
          this.smartGateDb = activeGateDb;
        } else {
          curTargetDb = this.targetDb;
          curDeadzoneDb = this.deadzoneDb;
          curUpStr = this.upwardStrength;
          curDownStr = this.downwardStrength;
          curMaxUp = this.maxUpwardDb;
          curMaxDown = this.maxDownwardDb;
          activeGateDb = this.noiseFloorDb;

          if (mode === 0 && this.rmsDb > activeGateDb) {
            this.rmsLongDb += this.rmsLongCoeff * (this.rmsDb - this.rmsLongDb);
            const jumpDb = Math.max(0, this.rmsDb - this.rmsLongDb);
            const jumpBoost = 1.0 + Math.max(0, jumpDb - 6.0) * 0.30;
            curAtkTime = this.levelerAttackTime / jumpBoost;
          } else {
            curAtkTime = this.levelerAttackTime;
          }
          curRelTime = this.levelerReleaseTime;
        }

        // Target Gain with Noise Floor Gate & Pause Hold
        if (!isEnabled) {
          this.levelerGainDb = 0;
          this.heldGainDb = 0;
          this.hangCounter = 0;
        } else if (this.rmsDb <= activeGateDb) {
          if (this.hangCounter > 0) {
            this.hangCounter -= 1;
            this.levelerGainDb = this.heldGainDb;
          } else {
            this.heldGainDb += this.silenceDecayCoeff * (0 - this.heldGainDb);
            if (Math.abs(this.heldGainDb) < 0.00001) this.heldGainDb = 0;
            this.levelerGainDb = this.heldGainDb;
          }
        } else {
          this.hangCounter = this.hangSteps;
          const delta = curTargetDb - this.rmsDb;
          if (delta > curDeadzoneDb) {
            this.levelerGainDb = Math.min((delta - curDeadzoneDb) * curUpStr, curMaxUp);
          } else if (delta < -curDeadzoneDb) {
            this.levelerGainDb = Math.max(-((-delta - curDeadzoneDb) * curDownStr), curMaxDown);
          } else {
            this.levelerGainDb = 0;
          }
          this.heldGainDb = this.levelerGainDb;
        }

        // Stage 2: Peak Guard
        if (isEnabled) {
          const peakHeadroom = this.ceilingDb - this.peakDb;
          this.levelerGainDb = Math.min(this.levelerGainDb, peakHeadroom);
        }

        // Fast smooth release on Bypass (A/B), Adaptive Release when Enabled
        let gCoeff;
        if (!isEnabled) {
          gCoeff = this.bypassCoeff;
        } else {
          const absDiff = Math.abs(this.levelerGainDb - this.currentGainDb);
          const relSec = Math.min(curRelTime + absDiff * 0.08, 3.5);
          const atkCoeff = 1 - Math.exp(-this.ctrlDt / Math.max(0.01, curAtkTime));
          const relCoeff = 1 - Math.exp(-this.ctrlDt / Math.max(0.01, relSec));
          gCoeff = this.levelerGainDb < this.currentGainDb ? atkCoeff : relCoeff;
        }

        this.currentGainDb += gCoeff * (this.levelerGainDb - this.currentGainDb);
        if (Math.abs(this.currentGainDb) < 0.00001 && this.levelerGainDb === 0) {
          this.currentGainDb = 0;
        }

        const targetLin = Math.exp(this.currentGainDb * DB2LN);
        this.levelerGainStep = (targetLin - this.levelerGainLin) / CTRL_STEP;

        this.limGrDb = this.limGain > MIN_LIN ? Math.log(this.limGain) * DB20_SCALE : MIN_DB;
      }

      this.levelerGainLin += this.levelerGainStep;

      // 3. Lookahead Delay Buffer
      this.bufL[this.delayPos] = spl0;
      this.bufR[this.delayPos] = spl1;

      let readPos = this.delayPos - this.lookaheadSamples;
      if (readPos < 0) readPos += BUF_SIZE;

      const delayedSpl0 = this.bufL[readPos];
      const delayedSpl1 = this.bufR[readPos];

      this.delayPos += 1;
      if (this.delayPos >= BUF_SIZE) this.delayPos = 0;

      // 4. Stage 3: True Lookahead Brickwall Limiter (Monotonic Sliding-Window Min)
      let reqLimGain = 1.0;
      if (isEnabled) {
        const predPeak = peakInput * this.levelerGainLin;
        if (predPeak > this.ceilingLinear) {
          reqLimGain = this.ceilingLinear / predPeak;
        }
      }

      const expireBefore = this.sampleCounter - this.lookaheadSamples;
      while (this.dqHead !== this.dqTail && this.dqIdx[this.dqHead] < expireBefore) {
        this.dqHead += 1;
        if (this.dqHead >= BUF_SIZE) this.dqHead = 0;
      }

      while (this.dqHead !== this.dqTail) {
        let prevTail = this.dqTail - 1;
        if (prevTail < 0) prevTail += BUF_SIZE;
        if (this.dqVal[prevTail] >= reqLimGain) {
          this.dqTail = prevTail;
        } else {
          break;
        }
      }

      this.dqIdx[this.dqTail] = this.sampleCounter;
      this.dqVal[this.dqTail] = reqLimGain;
      this.dqTail += 1;
      if (this.dqTail >= BUF_SIZE) this.dqTail = 0;

      this.winMinGain = this.dqVal[this.dqHead];

      if (this.winMinGain < this.limGain) {
        this.limGain += this.limAttackCoeff * (this.winMinGain - this.limGain);
      } else {
        this.limGain += this.limReleaseCoeff * (this.winMinGain - this.limGain);
      }

      // 5. Apply Combined Gain & C1 Soft Safety Ceiling
      const totalGain = this.levelerGainLin * this.limGain;
      let out0 = delayedSpl0 * totalGain;
      let out1 = delayedSpl1 * totalGain;

      if (isEnabled) {
        const abs0 = Math.abs(out0);
        if (abs0 > this.softThresh) {
          const ex0 = abs0 - this.softThresh;
          const clipped0 = this.softThresh + (this.softMargin * ex0) / (this.softMargin + ex0);
          out0 = out0 >= 0 ? clipped0 : -clipped0;
        }

        const abs1 = Math.abs(out1);
        if (abs1 > this.softThresh) {
          const ex1 = abs1 - this.softThresh;
          const clipped1 = this.softThresh + (this.softMargin * ex1) / (this.softMargin + ex1);
          out1 = out1 >= 0 ? clipped1 : -clipped1;
        }
      }

      outChanL[i] = out0;
      if (outChanR) {
        outChanR[i] = out1;
      }
      for (let ch = 2; ch < output.length; ch += 1) {
        output[ch][i] = 0;
      }

      this.sampleCounter += 1;
      this.ctrlCounter += 1;
      if (this.ctrlCounter >= CTRL_STEP) this.ctrlCounter = 0;
    }

    if (this.telemetryEnabled) {
      this.telemetrySampleAcc += frameCount;
      if (this.telemetrySampleAcc >= this.telemetryIntervalSamples) {
        this.telemetrySampleAcc = 0;
        this.port.postMessage({
          rmsDb: this.rmsDb,
          currentGainDb: this.currentGainDb,
          limGrDb: this.limGrDb,
          smartTargetDb: this.smartTargetDb,
          smartGateDb: this.smartGateDb,
          musicDenseIdx: this.musicDenseIdx,
        });
      }
    }

    return true;
  }
}

registerProcessor('web-audio-balancer', WebAudioBalancerProcessor);
