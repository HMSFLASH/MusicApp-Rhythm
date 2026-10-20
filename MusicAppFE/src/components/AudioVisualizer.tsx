import { useEffect, useRef, memo } from 'react';

export type VisualizerMode = 'spectrum' | 'bars' | 'mirror' | 'wave' | 'radial' | 'oscilloscope' | 'compact' | 'off';

interface AudioVisualizerProps {
  analyserRef?: React.RefObject<AnalyserNode | null>;
  isPlaying?: boolean;
  mode?: VisualizerMode;
  className?: string;
  barColor?: string;
  secondaryColor?: string;
  glowColor?: string;
  peakHoldSpeed?: number;
}

export const AudioVisualizer = memo(function AudioVisualizer({
  analyserRef,
  isPlaying = false,
  mode = 'mirror',
  className = 'w-full h-14',
  barColor = '#00f5ff',
  secondaryColor = '#a855f7',
  glowColor = 'rgba(0, 245, 255, 0.45)',
  peakHoldSpeed = 0.008,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    // Physics & smoothing buffers
    const smoothedBars: number[] = [];
    const peakBars: number[] = [];
    const peakHoldCounters: number[] = [];
    const peakVelocities: number[] = [];
    let phase = 0;
    let bassEnergySmoothed = 0;
    let midEnergySmoothed = 0;
    let highEnergySmoothed = 0;

    // Persistent typed buffers across frames to avoid garbage collector churn at 60-120fps
    let cachedFreqData: Uint8Array<ArrayBuffer> | null = null;
    let cachedTimeData: Uint8Array<ArrayBuffer> | null = null;
    let cachedRawTargetBars: Float32Array | null = null;

    // Precomputed frequency bin mapping table to avoid transcendental Math.pow calls every frame
    interface BinMapEntry {
      isSingleBin: boolean;
      b0: number;
      b1: number;
      frac: number;
      startBin: number;
      endBin: number;
      tilt: number;
    }
    let cachedBinMap: BinMapEntry[] | null = null;
    let cachedBinKey = '';

    // Preallocated buffers for liquid wave rendering
    const wavePoints = 48;
    const wavePointsX = new Float32Array(wavePoints);
    const wavePointsY = new Float32Array(wavePoints);

    // Zero-crossing buffer for oscilloscope trigger stabilization
    let lastTimeDomain: Uint8Array | null = null;

    const render = () => {
      const dpr = globalThis.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (width === 0 || height === 0) {
        animationId = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef?.current;
      phase += 0.04;

      // =========================================================================
      // 0. AUDIO DATA EXTRACTION & DYNAMIC CONTRAST DSP PROCESSING
      // =========================================================================
      const barCount = Math.min(56, Math.max(28, Math.floor(width / 7.0)));
      if (!cachedRawTargetBars || cachedRawTargetBars.length !== barCount) {
        cachedRawTargetBars = new Float32Array(barCount);
      }
      const rawTargetBars = cachedRawTargetBars;

      let hasRealAudio = false;
      let rawBassEnergy = 0;
      let rawMidEnergy = 0;
      let rawHighEnergy = 0;

      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        if (!cachedFreqData || cachedFreqData.length !== bufferLength) {
          cachedFreqData = new Uint8Array(new ArrayBuffer(bufferLength));
        }
        const freqData = cachedFreqData;
        analyser.getByteFrequencyData(freqData);

        // Check overall signal level across spectrum
        let totalSum = 0;
        const checkBins = Math.min(128, bufferLength);
        for (let i = 0; i < checkBins; i++) {
          totalSum += freqData[i];
        }
        hasRealAudio = totalSum > 20;

        if (hasRealAudio) {
          const sampleRate = analyser.context?.sampleRate || 44100;
          const currentBinKey = `${barCount}_${bufferLength}_${sampleRate}`;

          // Precompute logarithmic bin boundaries and tilt once when parameters change
          if (cachedBinKey !== currentBinKey || !cachedBinMap) {
            const nyquist = sampleRate / 2;
            const binWidth = nyquist / bufferLength;
            const minFreq = 32;
            const maxFreq = Math.min(15000, nyquist * 0.85);
            const freqRatio = maxFreq / minFreq;
            const denom = barCount - 1 || 1;

            const map: BinMapEntry[] = new Array(barCount);
            for (let i = 0; i < barCount; i++) {
              const freqProgress = i / denom;
              const centerFreq = minFreq * Math.pow(freqRatio, freqProgress);
              const freqStart = minFreq * Math.pow(freqRatio, Math.max(0, i - 0.5) / denom);
              const freqEnd = minFreq * Math.pow(freqRatio, Math.min(barCount - 1, i + 0.5) / denom);

              const startBinFloat = Math.max(1, freqStart / binWidth);
              const endBinFloat = Math.min(bufferLength - 1, freqEnd / binWidth);
              const isSingleBin = endBinFloat - startBinFloat <= 1.2;

              let b0 = 0;
              let b1 = 0;
              let frac = 0;
              let startBin = 0;
              let endBin = 0;

              if (isSingleBin) {
                const exactBin = centerFreq / binWidth;
                b0 = Math.floor(exactBin);
                b1 = Math.min(bufferLength - 1, b0 + 1);
                frac = exactBin - b0;
              } else {
                startBin = Math.floor(startBinFloat);
                endBin = Math.ceil(endBinFloat);
              }

              const tilt = 0.85 + 0.55 * Math.pow(freqProgress, 1.2);
              map[i] = { isSingleBin, b0, b1, frac, startBin, endBin, tilt };
            }

            cachedBinMap = map;
            cachedBinKey = currentBinKey;
          }

          const binMap = cachedBinMap;
          const noiseFloor = 60;
          const maxCeiling = 235;
          const invDynamicRange = 1 / (maxCeiling - noiseFloor);

          for (let i = 0; i < barCount; i++) {
            const entry = binMap[i];
            let rawEnergy = 0;

            if (entry.isSingleBin) {
              const val0 = freqData[entry.b0] || 0;
              const val1 = freqData[entry.b1] || 0;
              rawEnergy = val0 * (1 - entry.frac) + val1 * entry.frac;
            } else {
              let sum = 0;
              let peak = 0;
              let count = 0;
              for (let b = entry.startBin; b <= entry.endBin; b++) {
                const v = freqData[b] || 0;
                sum += v;
                if (v > peak) peak = v;
                count++;
              }
              const avg = count > 0 ? sum / count : 0;
              rawEnergy = peak * 0.7 + avg * 0.3;
            }

            // Dynamic contrast & Noise Floor Subtraction with equal-loudness tilt
            const unclamped = (rawEnergy - noiseFloor) * invDynamicRange;
            const normalized = Math.max(0, Math.min(1.0, unclamped * entry.tilt));

            // Gamma expansion curve (1.7) separates loud drum hits from soft harmonic beds
            const expanded = Math.pow(normalized, 1.7);
            rawTargetBars[i] = Math.min(1.0, expanded * 1.15);

            // Accumulate band energies
            if (i < barCount * 0.25) rawBassEnergy += rawTargetBars[i];
            else if (i < barCount * 0.7) rawMidEnergy += rawTargetBars[i];
            else rawHighEnergy += rawTargetBars[i];
          }

          rawBassEnergy /= (barCount * 0.25);
          rawMidEnergy /= (barCount * 0.45);
          rawHighEnergy /= (barCount * 0.3);
        }
      }

      // Smooth energy bands for wave & radial animations
      bassEnergySmoothed += ((hasRealAudio ? rawBassEnergy : 0.15) - bassEnergySmoothed) * 0.25;
      midEnergySmoothed += ((hasRealAudio ? rawMidEnergy : 0.1) - midEnergySmoothed) * 0.2;
      highEnergySmoothed += ((hasRealAudio ? rawHighEnergy : 0.08) - highEnergySmoothed) * 0.22;

      // Update Bar Physics (Snappy Attack, Fluid Gravity Decay & Peak Hold)
      for (let i = 0; i < barCount; i++) {
        let target = 0;
        if (hasRealAudio && isPlaying) {
          target = rawTargetBars[i];
        } else if (isPlaying) {
          // Subtle breathing baseline when playing but silent/intro
          target = 0.03 + Math.sin(phase * 1.5 + (i / barCount) * Math.PI * 2) * 0.02;
        } else {
          target = 0;
        }

        const prev = smoothedBars[i] ?? 0;
        if (target > prev) {
          // Snappy attack on beat hits
          smoothedBars[i] = prev + (target - prev) * 0.78;
        } else {
          // Fluid gravity falloff
          smoothedBars[i] = Math.max(0, prev + (target - prev) * 0.18);
        }

        // Studio Peak Hold Caps
        const curVal = smoothedBars[i];
        const currentPeak = peakBars[i] ?? 0;
        let holdCounter = peakHoldCounters[i] ?? 0;
        let velocity = peakVelocities[i] ?? 0;

        if (curVal >= currentPeak - 0.01) {
          peakBars[i] = curVal;
          peakHoldCounters[i] = 10;
          peakVelocities[i] = 0;
        } else {
          if (holdCounter > 0) {
            peakHoldCounters[i] = holdCounter - 1;
            peakBars[i] = currentPeak;
          } else {
            velocity += 0.003;
            peakVelocities[i] = velocity;
            peakBars[i] = Math.max(curVal, currentPeak - velocity);
          }
        }
      }

      // Helper function to draw rounded rectangles
      const drawRoundRect = (
        rx: number,
        ry: number,
        rw: number,
        rh: number,
        radius: number
      ) => {
        if (rh <= 0 || rw <= 0) return;
        const r = Math.min(radius, rw / 2, rh / 2);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(rx, ry, rw, rh, r);
        } else {
          ctx.moveTo(rx + r, ry);
          ctx.lineTo(rx + rw - r, ry);
          ctx.arcTo(rx + rw, ry, rx + rw, ry + r, r);
          ctx.lineTo(rx + rw, ry + rh - r);
          ctx.arcTo(rx + rw, ry + rh, rx + rw - r, ry + rh, r);
          ctx.lineTo(rx + r, ry + rh);
          ctx.lineTo(rx, ry + r);
          ctx.arcTo(rx, ry, rx + r, ry, r);
          ctx.closePath();
        }
      };

      // =========================================================================
      // 1. MIRROR & COMPACT MODE (Symmetrical Neon Cyberpunk Studio Spectrum)
      // =========================================================================
      if (mode === 'mirror' || mode === 'compact') {
        const gap = 3.0;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(2.0, (width - totalGap) / barCount);
        const centerY = height / 2;
        const maxHalfHeight = (height - 8) / 2;

        // Draw center laser baseline
        ctx.save();
        ctx.strokeStyle = `${barColor}44`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        ctx.shadowColor = glowColor;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
        ctx.restore();

        for (let i = 0; i < barCount; i++) {
          const level = smoothedBars[i] || 0;
          const peak = peakBars[i] || 0;
          const halfH = Math.max(1.5, level * maxHalfHeight);
          const x = i * (barWidth + gap);
          const y = centerY - halfH;
          const barH = halfH * 2;

          // 3-stop vertical symmetric gradient (Secondary -> Primary -> Secondary)
          const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
          gradient.addColorStop(0, secondaryColor);
          gradient.addColorStop(0.5, barColor);
          gradient.addColorStop(1, secondaryColor);

          ctx.fillStyle = gradient;
          ctx.shadowBlur = level > 0.25 ? 10 : 2;
          ctx.shadowColor = glowColor;
          drawRoundRect(x, y, barWidth, barH, barWidth / 2);
          ctx.fill();

          // Symmetrical Floating Peak Dots
          if (peak > 0.12 && isPlaying) {
            const peakTopY = centerY - Math.min(maxHalfHeight, peak * maxHalfHeight);
            const peakBottomY = centerY + Math.min(maxHalfHeight, peak * maxHalfHeight);

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ffffff';
            drawRoundRect(x, Math.max(1, peakTopY - 1.5), barWidth, 2, 1);
            ctx.fill();
            drawRoundRect(x, Math.min(height - 3, peakBottomY - 0.5), barWidth, 2, 1);
            ctx.fill();
          }
        }
      }

      // =========================================================================
      // 2. SPECTRUM & BARS MODE (Poweramp Studio FFT with Floating Peak Hold Caps)
      // =========================================================================
      else if (mode === 'spectrum' || mode === 'bars') {
        const gap = 3.0;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(2.2, (width - totalGap) / barCount);
        const maxBarHeight = height - 8;

        for (let i = 0; i < barCount; i++) {
          const level = smoothedBars[i] || 0;
          const peak = peakBars[i] || 0;
          const barH = Math.max(2.5, level * maxBarHeight);
          const x = i * (barWidth + gap);
          const y = height - barH;

          // 3-stop vertical neon gradient
          const gradient = ctx.createLinearGradient(0, height, 0, y);
          gradient.addColorStop(0, `${barColor}22`);
          gradient.addColorStop(0.55, barColor);
          gradient.addColorStop(1, secondaryColor);

          ctx.fillStyle = gradient;
          ctx.shadowBlur = level > 0.25 ? 12 : 2;
          ctx.shadowColor = glowColor;
          drawRoundRect(x, y, barWidth, barH, barWidth / 2.5);
          ctx.fill();

          // Poweramp Floating Peak Cap with White Glow
          if (peak > 0.08 && isPlaying) {
            const peakY = Math.max(2, height - peak * maxBarHeight);
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ffffff';
            drawRoundRect(x, peakY - 2.5, barWidth, 2.5, 1);
            ctx.fill();
          }
        }
      }

      // =========================================================================
      // 3. WAVE MODE (Real Audio-Reactive Liquid Waves - Apple Music / Monstercat)
      // =========================================================================
      else if (mode === 'wave') {
        const centerY = height / 2;
        const step = width / (wavePoints - 1);
        const invWavePointsMinusOne = 1 / (wavePoints - 1);

        const drawReactiveWaveLayer = (
          bandEnergy: number,
          waveFreq: number,
          speedMult: number,
          phaseOffset: number,
          strokeColor: string,
          fillColor: string,
          lineWidth: number,
          alpha: number,
          isFill: boolean
        ) => {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, centerY);

          const effectiveAmp = (height * 0.38) * Math.max(0.08, bandEnergy);

          for (let i = 0; i < wavePoints; i++) {
            const x = i * step;
            const normX = i * invWavePointsMinusOne;
            const envelope = Math.sin(normX * Math.PI);

            const barIndex = Math.min(barCount - 1, Math.floor(normX * barCount));
            const barMod = (smoothedBars[barIndex] || 0) * (height * 0.25);

            const oscillation = Math.sin(normX * waveFreq * Math.PI * 2 + phase * speedMult + phaseOffset);
            const y = centerY + (oscillation * effectiveAmp + barMod * oscillation) * envelope;
            wavePointsX[i] = x;
            wavePointsY[i] = y;
          }

          ctx.moveTo(wavePointsX[0], wavePointsY[0]);
          for (let i = 0; i < wavePoints - 1; i++) {
            const xc = (wavePointsX[i] + wavePointsX[i + 1]) * 0.5;
            const yc = (wavePointsY[i] + wavePointsY[i + 1]) * 0.5;
            ctx.quadraticCurveTo(wavePointsX[i], wavePointsY[i], xc, yc);
          }
          const lastX = wavePointsX[wavePoints - 1];
          const lastY = wavePointsY[wavePoints - 1];
          ctx.lineTo(lastX, lastY);

          if (isFill) {
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();
            const fillGrad = ctx.createLinearGradient(0, centerY - effectiveAmp, 0, height);
            fillGrad.addColorStop(0, fillColor);
            fillGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = fillGrad;
            ctx.globalAlpha = alpha;
            ctx.fill();
          } else {
            ctx.strokeStyle = strokeColor;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = lineWidth;
            ctx.shadowBlur = 14;
            ctx.shadowColor = glowColor;
            ctx.stroke();
          }
          ctx.restore();
        };

        // Layer 1: Bass Wave (Deep swelling neon body)
        drawReactiveWaveLayer(bassEnergySmoothed, 1.8, 1.2, 0, barColor, `${barColor}44`, 2.5, 0.7, true);
        // Layer 2: Mid Harmonic Wave (Vibrant secondary layer)
        drawReactiveWaveLayer(midEnergySmoothed, 2.8, 1.6, 2.0, secondaryColor, `${secondaryColor}25`, 2.0, 0.85, false);
        // Layer 3: Highs / Shimmer Wave (Crisp luminous surface trace)
        drawReactiveWaveLayer(highEnergySmoothed, 4.2, 2.2, 4.0, '#ffffff', 'transparent', 1.5, 0.95, false);
      }

      // =========================================================================
      // 4. RADIAL MODE (360° Circular DJ Halo with Pulsing Bass Core)
      // =========================================================================
      else if (mode === 'radial') {
        const centerX = width / 2;
        const centerY = height / 2;
        const minDimension = Math.min(width, height);
        const baseRadius = minDimension * 0.22;
        const pulseRadius = baseRadius + bassEnergySmoothed * (minDimension * 0.08);
        const maxRayLen = minDimension * 0.24;
        const rays = Math.min(64, barCount);

        ctx.save();

        // Glowing center pulsing ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = barColor;
        ctx.lineWidth = 2.0;
        ctx.shadowBlur = 12;
        ctx.shadowColor = glowColor;
        ctx.stroke();

        for (let i = 0; i < rays; i++) {
          const angle = (i / rays) * Math.PI * 2 + phase * 0.15;
          const barIdx = Math.floor((i / rays) * barCount);
          const level = smoothedBars[barIdx] || 0;
          const peak = peakBars[barIdx] || 0;

          const r1 = pulseRadius + 2;
          const r2 = r1 + Math.max(3, level * maxRayLen);

          const x1 = centerX + Math.cos(angle) * r1;
          const y1 = centerY + Math.sin(angle) * r1;
          const x2 = centerX + Math.cos(angle) * r2;
          const y2 = centerY + Math.sin(angle) * r2;

          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, barColor);
          gradient.addColorStop(1, secondaryColor);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2.2;
          ctx.shadowBlur = level > 0.25 ? 8 : 2;
          ctx.shadowColor = glowColor;
          ctx.stroke();

          // Orbiting peak dots
          if (peak > 0.15 && isPlaying) {
            const peakR = r1 + peak * maxRayLen;
            const px = centerX + Math.cos(angle) * peakR;
            const py = centerY + Math.sin(angle) * peakR;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // =========================================================================
      // 5. OSCILLOSCOPE (CRT Phosphor Laser with Trigger Stabilization)
      // =========================================================================
      else if (mode === 'oscilloscope') {
        const bufferLength = analyser ? analyser.fftSize : 512;
        if (!cachedTimeData || cachedTimeData.length !== bufferLength) {
          cachedTimeData = new Uint8Array(new ArrayBuffer(bufferLength));
        }
        const timeData = cachedTimeData;

        if (analyser && isPlaying) {
          analyser.getByteTimeDomainData(timeData);
          lastTimeDomain = timeData;
        }

        ctx.save();
        ctx.beginPath();

        // Zero-crossing trigger search for stable oscilloscope display
        let startIdx = 0;
        if (analyser && isPlaying) {
          for (let i = 0; i < bufferLength - 1; i++) {
            if (timeData[i] < 128 && timeData[i + 1] >= 128) {
              startIdx = i;
              break;
            }
          }
        }

        const renderPoints = Math.floor(bufferLength * 0.75);
        const sliceWidth = width / (renderPoints - 1);
        let x = 0;

        for (let i = 0; i < renderPoints; i++) {
          const idx = (startIdx + i) % bufferLength;
          let v = 0.5;
          if (analyser && isPlaying && lastTimeDomain) {
            v = (lastTimeDomain[idx] - 128) / 128.0;
            v = 0.5 + v * 0.45;
          } else if (isPlaying) {
            v = 0.5 + Math.sin(phase * 2 + (i / renderPoints) * Math.PI * 4) * 0.12;
          }
          const y = v * height;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        // Phosphor diffuse bloom outer layer
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = barColor;
        ctx.shadowBlur = 16;
        ctx.shadowColor = glowColor;
        ctx.globalAlpha = 0.7;
        ctx.stroke();

        // Sharp bright white core laser
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.95;
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ffffff';
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyserRef, isPlaying, mode, barColor, secondaryColor, glowColor, peakHoldSpeed]);

  if (mode === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      className={`${className} pointer-events-none transition-opacity duration-300`}
    />
  );
});

