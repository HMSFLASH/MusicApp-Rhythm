const clamp = (value, minVal, maxVal) => (value < minVal ? minVal : value > maxVal ? maxVal : value);

const percentToStereoWidth = (value) => {
  const effectiveValue = value <= 100 ? value : 100 + (value - 100) * 3;
  return clamp(effectiveValue / 100, 0, 4);
};

const percentToStereoBaseWidth = (value) => {
  const width = percentToStereoWidth(value);
  return width <= 1 ? width : clamp(1 + Math.pow(width - 1, 0.85) * 0.45, 1, 2.2);
};

const EXP_NEG_2_2 = Math.exp(-2.2);
const percentToPseudoStereoAmount = (value) => {
  const normalized = clamp((value - 100) / 100, 0, 1);
  return (1 - Math.exp(-normalized * 2.2)) / (1 - EXP_NEG_2_2);
};

const readHermite = (buf, bufLen, bufMask, writePos, delaySamps) => {
  const hmDelay = clamp(delaySamps, 2.0, bufLen - 4.0);
  const hmFloor = Math.floor(hmDelay);
  const hmT = hmDelay - hmFloor;

  const hmI0 = (writePos - hmFloor + bufLen) & bufMask;
  const hmIm1 = (hmI0 + 1) & bufMask;
  const hmI1 = (hmI0 + bufLen - 1) & bufMask;
  const hmI2 = (hmI0 + bufLen - 2) & bufMask;

  const hmYm1 = buf[hmIm1];
  const hmY0 = buf[hmI0];
  const hmY1 = buf[hmI1];
  const hmY2 = buf[hmI2];

  const hmC1 = 0.5 * (hmY1 - hmYm1);
  const hmC2 = hmYm1 - 2.5 * hmY0 + 2.0 * hmY1 - 0.5 * hmY2;
  const hmC3 = 0.5 * (hmY2 - hmYm1) + 1.5 * (hmY0 - hmY1);

  return ((hmC3 * hmT + hmC2) * hmT + hmC1) * hmT + hmY0;
};

class MultibandStereoImagerProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'widthPercent', defaultValue: 100, minValue: 0, maxValue: 200, automationRate: 'k-rate' },
      { name: 'speakerMode', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'crossoverLow', defaultValue: 150, minValue: 20, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'crossoverHigh', defaultValue: 20000, minValue: 20, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'crossoverMode', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'surroundDelayMs', defaultValue: 12, minValue: 5, maxValue: 30, automationRate: 'k-rate' },
      { name: 'surroundWetPercent', defaultValue: 14, minValue: 0, maxValue: 50, automationRate: 'k-rate' },
      { name: 'monoThreshold', defaultValue: 0.985, minValue: 0.7, maxValue: 1.0, automationRate: 'k-rate' },
      { name: 'monoSideLevel', defaultValue: 100, minValue: 0, maxValue: 150, automationRate: 'k-rate' },
      { name: 'chorusAmount', defaultValue: 0, minValue: 0, maxValue: 100, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();

    this.sr = Math.max(8000, sampleRate);
    this.maxFc = 0.45 * this.sr;
    this.minFc = Math.min(20, this.maxFc);

    // Non-overlapping circular buffers (power-of-2 for delayBuf & chorus)
    this.bufLength = 65536;
    this.bufMask = this.bufLength - 1;
    this.delayBuf = new Float32Array(this.bufLength);
    this.delayPos = 0;

    this.ap1MaxLen = 4096;
    this.ap2MaxLen = 4096;
    this.bufAp1 = new Float32Array(this.ap1MaxLen);
    this.bufAp2 = new Float32Array(this.ap2MaxLen);
    this.ap1Pos = 0;
    this.ap2Pos = 0;

    this.chorusBufLen = 8192;
    this.chorusBufMask = this.chorusBufLen - 1;
    this.bufChorusL = new Float32Array(this.chorusBufLen);
    this.bufChorusR = new Float32Array(this.chorusBufLen);
    this.chorusPos = 0;
    this.chorusPhase1 = 0;
    this.chorusPhase2 = 0;

    this.antiDenormal = 1e-25;

    // Correlation detector state
    this.leak = 1 - Math.exp(-1 / (this.sr * 0.300));
    this.sumL2 = 0.0001;
    this.sumR2 = 0.0001;
    this.sumLR = 0.0001;
    this.correlation = 1.0;

    // Parameter smoothers (50 ms)
    this.smoothWet = 1 - Math.exp(-1 / (this.sr * 0.050));
    this.smoothChorus = 1 - Math.exp(-1 / (this.sr * 0.050));
    this.currentSurroundWet = 0;
    this.currentChorusWet = 0;
    this.currentChorusDepthScale = 0.50;
    this.currentWidthComp = 1.0;

    // Linkwitz-Riley 2nd-order TPT SVF & phase-alignment all-pass states
    this.lrLowIc1L = 0; this.lrLowIc2L = 0;
    this.lrLowIc1R = 0; this.lrLowIc2R = 0;
    this.lrHighIc1L = 0; this.lrHighIc2L = 0;
    this.lrHighIc1R = 0; this.lrHighIc2R = 0;
    this.apHighSL = 0;
    this.apHighSR = 0;

    // Surround 240 Hz Butterworth 2nd-order HPF states
    this.surrHpIc1 = 0;
    this.surrHpIc2 = 0;

    // Progressive Air Absorption Damping (TPT 1-pole LPF)
    this.airS2 = 0;
    this.airS3 = 0;
    this.airS4 = 0;

    // Analog BBD Bandpass filter states for Chorus Wet (200 Hz -> 9000 Hz)
    this.chorusHpSL = 0;
    this.chorusHpSR = 0;
    this.chorusLpSL = 0;
    this.chorusLpSR = 0;

    // Olli Niemitalo Hilbert 90-deg All-pass coefficients
    this.apC1 = 0.4794008653;
    this.apC2 = 0.8762184931;
    this.apC3 = 0.9765975883;
    this.apC4 = 0.9974992552;

    this.bpC1 = 0.1617585000;
    this.bpC2 = 0.7330289300;
    this.bpC3 = 0.9453497000;
    this.bpC4 = 0.9905991600;

    // Hilbert Path 1 (Mid)
    this.apDelay1 = 0;
    this.p1S1X1 = 0; this.p1S1X2 = 0; this.p1S1Y1 = 0; this.p1S1Y2 = 0;
    this.p1S2X1 = 0; this.p1S2X2 = 0; this.p1S2Y1 = 0; this.p1S2Y2 = 0;
    this.p1S3X1 = 0; this.p1S3X2 = 0; this.p1S3Y1 = 0; this.p1S3Y2 = 0;
    this.p1S4X1 = 0; this.p1S4X2 = 0; this.p1S4Y1 = 0; this.p1S4Y2 = 0;

    // Hilbert Path 2 (Side)
    this.p2S1X1 = 0; this.p2S1X2 = 0; this.p2S1Y1 = 0; this.p2S1Y2 = 0;
    this.p2S2X1 = 0; this.p2S2X2 = 0; this.p2S2Y1 = 0; this.p2S2Y2 = 0;
    this.p2S3X1 = 0; this.p2S3X2 = 0; this.p2S3Y1 = 0; this.p2S3Y2 = 0;
    this.p2S4X1 = 0; this.p2S4X2 = 0; this.p2S4Y1 = 0; this.p2S4Y2 = 0;

    // Fixed sample-rate coefficients
    const gSurrHp = Math.tan((Math.PI * clamp(240, this.minFc, this.maxFc)) / this.sr);
    this.kSurrHp = Math.SQRT2;
    this.surrHpA1 = 1.0 / (1.0 + gSurrHp * (gSurrHp + this.kSurrHp));
    this.surrHpA2 = gSurrHp * this.surrHpA1;
    this.surrHpA3 = gSurrHp * this.surrHpA2;

    this.ap1Samples = clamp(Math.floor(this.sr * 0.0021), 2, this.ap1MaxLen - 1);
    this.ap2Samples = clamp(Math.floor(this.sr * 0.0037), 2, this.ap2MaxLen - 1);

    const gAir2 = Math.tan((Math.PI * clamp(10000, this.minFc, this.maxFc)) / this.sr);
    this.G_air2 = gAir2 / (1.0 + gAir2);
    const gAir3 = Math.tan((Math.PI * clamp(7500, this.minFc, this.maxFc)) / this.sr);
    this.G_air3 = gAir3 / (1.0 + gAir3);
    const gAir4 = Math.tan((Math.PI * clamp(5500, this.minFc, this.maxFc)) / this.sr);
    this.G_air4 = gAir4 / (1.0 + gAir4);

    const gChHp = Math.tan((Math.PI * clamp(200, this.minFc, this.maxFc)) / this.sr);
    this.G_ch_hp = gChHp / (1.0 + gChHp);
    const gChLp = Math.tan((Math.PI * clamp(9000, this.minFc, this.maxFc)) / this.sr);
    this.G_ch_lp = gChLp / (1.0 + gChLp);

    this.chorusLfo1Inc = (2 * Math.PI * 0.55) / this.sr;
    this.chorusLfo2Inc = (2 * Math.PI * 0.85) / this.sr;
    this.chorusBaseL1 = this.sr * 0.0085;
    this.chorusBaseL2 = this.sr * 0.0124;
    this.chorusBaseR1 = this.sr * 0.0092;
    this.chorusBaseR2 = this.sr * 0.0133;
    this.chorusDepth1 = this.sr * 0.0018;
    this.chorusDepth2 = this.sr * 0.0022;

    // Cached dynamic coefficients
    this.cachedLowHz = -1;
    this.cachedHighHz = -1;
    this.cachedSurroundDelayMs = -1;

    this.lrLowA1 = 0; this.lrLowA2 = 0; this.lrLowA3 = 0;
    this.lrHighA1 = 0; this.lrHighA2 = 0; this.lrHighA3 = 0;
    this.apHighG = 0;

    this.tap1Samples = 1;
    this.tap2Samples = 1;
    this.tap3Samples = 1;
    this.tap4Samples = 1;

    this.updateCrossoverCoefficients(150, 20000);
    this.updateDelayTaps(12);
  }

  updateCrossoverCoefficients(rawLow, rawHigh) {
    const lowClamped = clamp(rawLow, this.minFc, this.maxFc);
    const highClamped = clamp(rawHigh, this.minFc, this.maxFc);
    const lowHz = lowClamped < highClamped ? lowClamped : highClamped;
    const highHz = lowClamped > highClamped ? lowClamped : highClamped;

    if (lowHz !== this.cachedLowHz) {
      this.cachedLowHz = lowHz;
      const gLow = Math.tan((Math.PI * lowHz) / this.sr);
      this.lrLowA1 = 1.0 / (1.0 + gLow * (gLow + 2.0));
      this.lrLowA2 = gLow * this.lrLowA1;
      this.lrLowA3 = gLow * this.lrLowA2;
    }

    if (highHz !== this.cachedHighHz) {
      this.cachedHighHz = highHz;
      const gHigh = Math.tan((Math.PI * highHz) / this.sr);
      this.lrHighA1 = 1.0 / (1.0 + gHigh * (gHigh + 2.0));
      this.lrHighA2 = gHigh * this.lrHighA1;
      this.lrHighA3 = gHigh * this.lrHighA2;
      this.apHighG = gHigh / (1.0 + gHigh);
    }
  }

  updateDelayTaps(surroundDelayMs) {
    const safeDelayMs = clamp(surroundDelayMs, 5, 30);
    if (safeDelayMs === this.cachedSurroundDelayMs) return;
    this.cachedSurroundDelayMs = safeDelayMs;

    const baseDelaySec = safeDelayMs / 1000;
    const maxTap = this.bufLength - 4;
    this.tap1Samples = clamp(Math.floor(this.sr * baseDelaySec * 0.618), 1, maxTap);
    this.tap2Samples = clamp(Math.floor(this.sr * baseDelaySec * 1.000), 1, maxTap);
    this.tap3Samples = clamp(Math.floor(this.sr * baseDelaySec * 1.414), 1, maxTap);
    this.tap4Samples = clamp(Math.floor(this.sr * baseDelaySec * 1.932), 1, maxTap);
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

    const widthPercent = clamp(parameters.widthPercent[0], 0, 200);
    const monoMode = Math.round(clamp(parameters.speakerMode[0], 0, 2));
    const crossoverLow = parameters.crossoverLow[0];
    const crossoverHigh = parameters.crossoverHigh[0];
    const effCrossMode = Math.round(clamp(parameters.crossoverMode[0], 0, 1));
    const surroundDelayMs = parameters.surroundDelayMs[0];
    const surroundWetPercent = clamp(parameters.surroundWetPercent[0], 0, 50);
    const monoThreshold = clamp(parameters.monoThreshold[0], 0.7, 1.0);
    const effSideLevel = clamp(parameters.monoSideLevel[0], 0, 150);
    const chorusAmount = clamp(parameters.chorusAmount[0] / 100, 0, 1);

    this.updateCrossoverCoefficients(crossoverLow, crossoverHigh);
    this.updateDelayTaps(surroundDelayMs);

    const baseWidth = percentToStereoBaseWidth(widthPercent);
    const basePseudoAmount = percentToPseudoStereoAmount(widthPercent);
    const targetWidthComp = baseWidth > 1.0
      ? 1.0 / Math.sqrt(1.0 + 0.25 * (baseWidth * baseWidth - 1.0))
      : 1.0;

    const targetChorusWetStereo = chorusAmount * 0.50;
    const targetChorusDepthScale = 0.50 + 0.50 * chorusAmount;

    const inChanL = input[0];
    const inChanR = input[1] || input[0];
    const outChanL = output[0];
    const outChanR = output[1];

    const sr = this.sr;
    const twoPi = 2 * Math.PI;

    for (let i = 0; i < frameCount; i += 1) {
      const L = inChanL[i] || 0;
      const R = inChanR[i] || 0;
      this.antiDenormal = -this.antiDenormal;

      // 1. Linkwitz-Riley 2nd-order TPT SVF Crossover + AP1 Phase Alignment
      const lIn = L + this.antiDenormal;
      const rIn = R + this.antiDenormal;

      const v3LL = lIn - this.lrLowIc2L;
      const v1LL = this.lrLowA1 * this.lrLowIc1L + this.lrLowA2 * v3LL;
      const v2LL = this.lrLowIc2L + this.lrLowA2 * this.lrLowIc1L + this.lrLowA3 * v3LL;
      this.lrLowIc1L = 2.0 * v1LL - this.lrLowIc1L;
      this.lrLowIc2L = 2.0 * v2LL - this.lrLowIc2L;
      const lowRawL = v2LL;
      const hp1L = 2.0 * v1LL + v2LL - lIn;

      const v3LR = rIn - this.lrLowIc2R;
      const v1LR = this.lrLowA1 * this.lrLowIc1R + this.lrLowA2 * v3LR;
      const v2LR = this.lrLowIc2R + this.lrLowA2 * this.lrLowIc1R + this.lrLowA3 * v3LR;
      this.lrLowIc1R = 2.0 * v1LR - this.lrLowIc1R;
      this.lrLowIc2R = 2.0 * v2LR - this.lrLowIc2R;
      const lowRawR = v2LR;
      const hp1R = 2.0 * v1LR + v2LR - rIn;

      const v3HL = hp1L - this.lrHighIc2L;
      const v1HL = this.lrHighA1 * this.lrHighIc1L + this.lrHighA2 * v3HL;
      const v2HL = this.lrHighIc2L + this.lrHighA2 * this.lrHighIc1L + this.lrHighA3 * v3HL;
      this.lrHighIc1L = 2.0 * v1HL - this.lrHighIc1L;
      this.lrHighIc2L = 2.0 * v2HL - this.lrHighIc2L;
      const midL = v2HL;
      const highL = 2.0 * v1HL + v2HL - hp1L;

      const v3HR = hp1R - this.lrHighIc2R;
      const v1HR = this.lrHighA1 * this.lrHighIc1R + this.lrHighA2 * v3HR;
      const v2HR = this.lrHighIc2R + this.lrHighA2 * this.lrHighIc1R + this.lrHighA3 * v3HR;
      this.lrHighIc1R = 2.0 * v1HR - this.lrHighIc1R;
      this.lrHighIc2R = 2.0 * v2HR - this.lrHighIc2R;
      const midR = v2HR;
      const highR = 2.0 * v1HR + v2HR - hp1R;

      const apVL = (lowRawL - this.apHighSL) * this.apHighG;
      const apLpL = apVL + this.apHighSL;
      this.apHighSL = apLpL + apVL;
      const lowL = 2.0 * apLpL - lowRawL;

      const apVR = (lowRawR - this.apHighSR) * this.apHighG;
      const apLpR = apVR + this.apHighSR;
      this.apHighSR = apLpR + apVR;
      const lowR = 2.0 * apLpR - lowRawR;

      let stereoL;
      let stereoR;
      let bypassL;
      let bypassR;
      if (effCrossMode === 0) {
        stereoL = midL;
        stereoR = midR;
        bypassL = lowL + highL;
        bypassR = lowR + highR;
      } else {
        stereoL = lowL + highL;
        stereoR = lowR + highR;
        bypassL = midL;
        bypassR = midR;
      }

      // 2. Continuous correlation detector
      this.sumL2 = this.sumL2 + this.leak * (L * L - this.sumL2);
      this.sumR2 = this.sumR2 + this.leak * (R * R - this.sumR2);
      this.sumLR = this.sumLR + this.leak * (L * R - this.sumLR);
      this.correlation = this.sumLR / Math.sqrt(this.sumL2 * this.sumR2 + 0.000001);

      let outL;
      let outR;

      // 3. Speaker Mode routing
      if (monoMode === 1) {
        // Phase-Safe Mono Fold-down (Olli Niemitalo Hilbert 90-deg network)
        this.currentSurroundWet += this.smoothWet * (0 - this.currentSurroundWet);
        this.currentChorusWet += this.smoothChorus * (0 - this.currentChorusWet);
        this.currentChorusDepthScale += this.smoothChorus * (targetChorusDepthScale - this.currentChorusDepthScale);
        this.currentWidthComp += this.smoothWet * (1.0 - this.currentWidthComp);

        const M = ((stereoL + bypassL) + (stereoR + bypassR)) * 0.5;
        const S = (stereoL - stereoR) * 0.5;

        const p1In = this.apDelay1;
        this.apDelay1 = M;

        const p1S1Y = this.apC1 * (p1In + this.p1S1Y2) - this.p1S1X2;
        this.p1S1X2 = this.p1S1X1; this.p1S1X1 = p1In;
        this.p1S1Y2 = this.p1S1Y1; this.p1S1Y1 = p1S1Y;

        const p1S2Y = this.apC2 * (p1S1Y + this.p1S2Y2) - this.p1S2X2;
        this.p1S2X2 = this.p1S2X1; this.p1S2X1 = p1S1Y;
        this.p1S2Y2 = this.p1S2Y1; this.p1S2Y1 = p1S2Y;

        const p1S3Y = this.apC3 * (p1S2Y + this.p1S3Y2) - this.p1S3X2;
        this.p1S3X2 = this.p1S3X1; this.p1S3X1 = p1S2Y;
        this.p1S3Y2 = this.p1S3Y1; this.p1S3Y1 = p1S3Y;

        const p1S4Y = this.apC4 * (p1S3Y + this.p1S4Y2) - this.p1S4X2;
        this.p1S4X2 = this.p1S4X1; this.p1S4X1 = p1S3Y;
        this.p1S4Y2 = this.p1S4Y1; this.p1S4Y1 = p1S4Y;
        const mPhase = p1S4Y;

        const p2In = S;
        const p2S1Y = this.bpC1 * (p2In + this.p2S1Y2) - this.p2S1X2;
        this.p2S1X2 = this.p2S1X1; this.p2S1X1 = p2In;
        this.p2S1Y2 = this.p2S1Y1; this.p2S1Y1 = p2S1Y;

        const p2S2Y = this.bpC2 * (p2S1Y + this.p2S2Y2) - this.p2S2X2;
        this.p2S2X2 = this.p2S2X1; this.p2S2X1 = p2S1Y;
        this.p2S2Y2 = this.p2S2Y1; this.p2S2Y1 = p2S2Y;

        const p2S3Y = this.bpC3 * (p2S2Y + this.p2S3Y2) - this.p2S3X2;
        this.p2S3X2 = this.p2S3X1; this.p2S3X1 = p2S2Y;
        this.p2S3Y2 = this.p2S3Y1; this.p2S3Y1 = p2S3Y;

        const p2S4Y = this.bpC4 * (p2S3Y + this.p2S4Y2) - this.p2S4X2;
        this.p2S4X2 = this.p2S4X1; this.p2S4X1 = p2S3Y;
        this.p2S4Y2 = this.p2S4Y1; this.p2S4Y1 = p2S4Y;
        const sPhase = p2S4Y;

        const effK = (effSideLevel / 100) * (widthPercent / 100);
        const monoNorm = effK > 1.0 ? 1.0 / Math.sqrt(0.5 * (1.0 + effK * effK)) : 1.0;
        const monoOut = (mPhase + effK * sPhase) * monoNorm;
        outL = monoOut;
        outR = monoOut;
      } else if (monoMode === 2) {
        // Classic Downmix Sum (L + R) * 0.5
        this.currentSurroundWet += this.smoothWet * (0 - this.currentSurroundWet);
        this.currentChorusWet += this.smoothChorus * (0 - this.currentChorusWet);
        this.currentChorusDepthScale += this.smoothChorus * (targetChorusDepthScale - this.currentChorusDepthScale);
        this.currentWidthComp += this.smoothWet * (1.0 - this.currentWidthComp);

        const monoOut = (L + R) * 0.5;
        outL = monoOut;
        outR = monoOut;
      } else {
        // Stereo 2-Speaker mode
        const isNearMono = this.correlation >= monoThreshold;
        let targetWet = 0;
        if (surroundWetPercent > 0) {
          targetWet = surroundWetPercent / 100;
        } else if (widthPercent > 100 && isNearMono) {
          targetWet = Math.max(0.10, basePseudoAmount * 0.18);
        }

        this.currentSurroundWet += this.smoothWet * (targetWet - this.currentSurroundWet);
        this.currentChorusWet += this.smoothChorus * (targetChorusWetStereo - this.currentChorusWet);
        this.currentChorusDepthScale += this.smoothChorus * (targetChorusDepthScale - this.currentChorusDepthScale);
        this.currentWidthComp += this.smoothWet * (targetWidthComp - this.currentWidthComp);

        // 4. M/S Base Width
        const M = (stereoL + stereoR) * 0.5;
        const S = (stereoL - stereoR) * 0.5;
        let stereoLOut = M + S * baseWidth;
        let stereoROut = M - S * baseWidth;

        // 5. All-Pass Diffuser + 4-Tap Surround Network
        // Step A: 240 Hz 2nd-order Butterworth HPF
        const surrV3 = M - this.surrHpIc2;
        const surrV1 = this.surrHpA1 * this.surrHpIc1 + this.surrHpA2 * surrV3;
        const surrV2 = this.surrHpIc2 + this.surrHpA2 * this.surrHpIc1 + this.surrHpA3 * surrV3;
        this.surrHpIc1 = 2.0 * surrV1 - this.surrHpIc1;
        this.surrHpIc2 = 2.0 * surrV2 - this.surrHpIc2;
        const cleanFeed = M - this.kSurrHp * surrV1 - surrV2;

        // Step B: 2-stage Schroeder All-pass Diffuser
        const ap1Del = this.bufAp1[this.ap1Pos];
        const ap1W = cleanFeed - 0.60 * ap1Del;
        const ap1Out = ap1Del + 0.60 * ap1W;
        this.bufAp1[this.ap1Pos] = ap1W;
        this.ap1Pos += 1;
        if (this.ap1Pos >= this.ap1Samples) this.ap1Pos = 0;

        const ap2Del = this.bufAp2[this.ap2Pos];
        const ap2W = ap1Out - 0.50 * ap2Del;
        const ap2Out = ap2Del + 0.50 * ap2W;
        this.bufAp2[this.ap2Pos] = ap2W;
        this.ap2Pos += 1;
        if (this.ap2Pos >= this.ap2Samples) this.ap2Pos = 0;

        this.delayBuf[this.delayPos] = ap2Out;

        // Step C: 4 inharmonic taps
        const tap1 = this.delayBuf[(this.delayPos - this.tap1Samples + this.bufLength) & this.bufMask];
        const tap2Raw = this.delayBuf[(this.delayPos - this.tap2Samples + this.bufLength) & this.bufMask];
        const tap3Raw = this.delayBuf[(this.delayPos - this.tap3Samples + this.bufLength) & this.bufMask];
        const tap4Raw = this.delayBuf[(this.delayPos - this.tap4Samples + this.bufLength) & this.bufMask];

        this.delayPos = (this.delayPos + 1) & this.bufMask;

        // Step D: Progressive Air Absorption Damping
        const airV2 = (tap2Raw - this.airS2) * this.G_air2;
        const tap2 = airV2 + this.airS2;
        this.airS2 = tap2 + airV2;

        const airV3 = (tap3Raw - this.airS3) * this.G_air3;
        const tap3 = airV3 + this.airS3;
        this.airS3 = tap3 + airV3;

        const airV4 = (tap4Raw - this.airS4) * this.G_air4;
        const tap4 = airV4 + this.airS4;
        this.airS4 = tap4 + airV4;

        // Step E: Differential matrix (cancels 100% on mono sum)
        const surroundDiff = 0.75 * tap1 - 0.65 * tap2 + 0.50 * tap3 - 0.40 * tap4;
        stereoLOut += surroundDiff * this.currentSurroundWet;
        stereoROut -= surroundDiff * this.currentSurroundWet;

        // 6. 4-Voice True Stereo Chorus Ensemble (Dimension D style)
        // Always prime ring buffers for click-free engagement
        this.bufChorusL[this.chorusPos] = stereoL;
        this.bufChorusR[this.chorusPos] = stereoR;

        if (this.currentChorusWet > 0.00001) {
          const lfo1Sin = Math.sin(this.chorusPhase1);
          const lfo1Cos = Math.cos(this.chorusPhase1);
          this.chorusPhase1 += this.chorusLfo1Inc;
          if (this.chorusPhase1 >= twoPi) this.chorusPhase1 -= twoPi;

          const lfo2Sin = Math.sin(this.chorusPhase2);
          const lfo2Cos = Math.cos(this.chorusPhase2);
          this.chorusPhase2 += this.chorusLfo2Inc;
          if (this.chorusPhase2 >= twoPi) this.chorusPhase2 -= twoPi;

          const effDepth1 = this.chorusDepth1 * this.currentChorusDepthScale;
          const effDepth2 = this.chorusDepth2 * this.currentChorusDepthScale;

          const maxChorusDelay = this.chorusBufLen - 4.0;
          const dL1 = clamp(this.chorusBaseL1 + effDepth1 * lfo1Sin, 2.0, maxChorusDelay);
          const dL2 = clamp(this.chorusBaseL2 + effDepth2 * lfo2Sin, 2.0, maxChorusDelay);
          const dR1 = clamp(this.chorusBaseR1 + effDepth1 * lfo1Cos, 2.0, maxChorusDelay);
          const dR2 = clamp(this.chorusBaseR2 - effDepth2 * lfo2Cos, 2.0, maxChorusDelay);

          const vL1 = readHermite(this.bufChorusL, this.chorusBufLen, this.chorusBufMask, this.chorusPos, dL1);
          const vL2 = readHermite(this.bufChorusR, this.chorusBufLen, this.chorusBufMask, this.chorusPos, dL2);
          const vR1 = readHermite(this.bufChorusR, this.chorusBufLen, this.chorusBufMask, this.chorusPos, dR1);
          const vR2 = readHermite(this.bufChorusL, this.chorusBufLen, this.chorusBufMask, this.chorusPos, dR2);

          const chorusRawL = 0.832 * vL1 + 0.555 * vL2;
          const chorusRawR = 0.832 * vR1 + 0.555 * vR2;

          // Analog BBD Bandpass: HPF 200Hz -> LPF 9000Hz
          const chInL = chorusRawL + this.antiDenormal;
          const chHpVL = (chInL - this.chorusHpSL) * this.G_ch_hp;
          const chHpLpL = chHpVL + this.chorusHpSL;
          this.chorusHpSL = chHpLpL + chHpVL;
          const chHpOutL = chInL - chHpLpL;

          const chLpVL = (chHpOutL - this.chorusLpSL) * this.G_ch_lp;
          const chorusWetL = chLpVL + this.chorusLpSL;
          this.chorusLpSL = chorusWetL + chLpVL;

          const chInR = chorusRawR + this.antiDenormal;
          const chHpVR = (chInR - this.chorusHpSR) * this.G_ch_hp;
          const chHpLpR = chHpVR + this.chorusHpSR;
          this.chorusHpSR = chHpLpR + chHpVR;
          const chHpOutR = chInR - chHpLpR;

          const chLpVR = (chHpOutR - this.chorusLpSR) * this.G_ch_lp;
          const chorusWetR = chLpVR + this.chorusLpSR;
          this.chorusLpSR = chorusWetR + chLpVR;

          const chorusNorm = 1.0 / Math.sqrt(1.0 + this.currentChorusWet * this.currentChorusWet);
          stereoLOut = (stereoLOut + chorusWetL * this.currentChorusWet) * chorusNorm;
          stereoROut = (stereoROut + chorusWetR * this.currentChorusWet) * chorusNorm;
        } else {
          this.chorusHpSL = 0;
          this.chorusHpSR = 0;
          this.chorusLpSL = 0;
          this.chorusLpSR = 0;
        }

        this.chorusPos = (this.chorusPos + 1) & this.chorusBufMask;

        // 7. Recombine Bypass & apply stereo energy compensation
        outL = (stereoLOut + bypassL) * this.currentWidthComp;
        outR = (stereoROut + bypassR) * this.currentWidthComp;
      }

      outChanL[i] = outL;
      if (outChanR) {
        outChanR[i] = outR;
      }
      for (let ch = 2; ch < output.length; ch += 1) {
        output[ch][i] = 0;
      }
    }

    return true;
  }
}

registerProcessor('multiband-stereo-imager', MultibandStereoImagerProcessor);
