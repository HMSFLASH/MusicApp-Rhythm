import { useEffect, useRef, memo } from 'react';

interface AudioVisualizerProps {
  analyserRef?: React.RefObject<AnalyserNode | null>;
  isPlaying?: boolean;
  mode?: 'mirror' | 'bars' | 'wave' | 'compact';
  className?: string;
  barColor?: string;
  secondaryColor?: string;
  glowColor?: string;
}

export const AudioVisualizer = memo(function AudioVisualizer({
  analyserRef,
  isPlaying = false,
  mode = 'mirror',
  className = 'w-full h-14',
  barColor = '#00f5ff',
  secondaryColor = '#6366f1',
  glowColor = 'rgba(0, 245, 255, 0.35)',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const smoothedBars: number[] = [];
    let phase = 0;

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

      // -------------------------------------------------------------
      // 1. MIRROR (SoundCloud / Modern Music Symmetrical Bars)
      // 2. BARS (Studio Spectrum Flat Equalizer)
      // -------------------------------------------------------------
      if (mode === 'mirror' || mode === 'bars' || mode === 'compact') {
        // Double bar count: 44 to 84 bars depending on width
        const barCount = Math.min(84, Math.max(44, Math.floor(width / 4.75)));
        const gap = 2;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(1.5, (width - totalGap) / barCount);

        if (analyser && isPlaying) {
          const bufferLength = analyser.frequencyBinCount;
          const fullData = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(fullData);

          const sampleRate = analyser.context?.sampleRate || 44100;
          const nyquist = sampleRate / 2;
          const binWidth = nyquist / bufferLength;

          // Focused musical frequency range (35 Hz to 16,000 Hz)
          const minFreq = 35;
          const maxFreq = Math.min(16000, nyquist);

          for (let i = 0; i < barCount; i++) {
            // Perceptual logarithmic octave distribution
            const fStart = minFreq * Math.pow(maxFreq / minFreq, i / barCount);
            const fEnd = minFreq * Math.pow(maxFreq / minFreq, (i + 1) / barCount);

            const startBin = Math.max(1, Math.floor(fStart / binWidth));
            const endBin = Math.min(bufferLength - 1, Math.ceil(fEnd / binWidth));

            // Calculate average RMS energy in band (avoids single-bin maxVal blowout)
            let sum = 0;
            let count = 0;
            for (let b = startBin; b <= endBin; b++) {
              sum += fullData[b];
              count++;
            }
            const avgEnergy = count > 0 ? sum / count : 0;

            // Dynamic noise floor gate (anything below -70dB is 0)
            const noiseFloor = 38;
            const normalized = Math.max(0, (avgEnergy - noiseFloor) / (255 - noiseFloor));

            // Power curve for natural rhythmic feel without automatic frequency compensation
            const targetVal = Math.min(1.0, Math.pow(normalized, 1.3));

            // Responsive Ballistics: Fast snappy attack (0.65), smooth fluid decay (0.14)
            const prev = smoothedBars[i] ?? 0;
            if (targetVal > prev) {
              smoothedBars[i] = prev + (targetVal - prev) * 0.65;
            } else {
              smoothedBars[i] = prev + (targetVal - prev) * 0.14;
            }
          }
        } else if (isPlaying) {
          // Ambient breathing idle wave when audio is loading or initializing
          for (let i = 0; i < barCount; i++) {
            const idleVal = 0.12 + Math.sin(phase * 1.5 + (i / barCount) * Math.PI * 2) * 0.08;
            const prev = smoothedBars[i] ?? 0.1;
            smoothedBars[i] = prev + (idleVal - prev) * 0.1;
          }
        } else {
          // Smooth glide down to resting idle line when paused
          for (let i = 0; i < barCount; i++) {
            const prev = smoothedBars[i] ?? 0;
            smoothedBars[i] = Math.max(0, prev * 0.88 - 0.01);
          }
        }

        // Render Symmetrical / Center-mirrored Bars
        if (mode === 'mirror' || mode === 'compact') {
          const centerY = height / 2;
          const maxHalfHeight = (height - 8) / 2;

          for (let i = 0; i < barCount; i++) {
            const level = smoothedBars[i] || 0;
            const halfH = Math.max(1.5, level * maxHalfHeight);
            const x = i * (barWidth + gap);
            const y = centerY - halfH;
            const barH = halfH * 2;

            // Dynamic Vertical Gradient
            const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
            gradient.addColorStop(0, secondaryColor || barColor);
            gradient.addColorStop(0.5, barColor);
            gradient.addColorStop(1, secondaryColor || barColor);

            ctx.fillStyle = gradient;
            ctx.shadowBlur = level > 0.3 ? 8 : 2;
            ctx.shadowColor = glowColor;

            ctx.fillRect(x, y, barWidth, barH);
          }
        } 
        // Render Studio Spectrum Flat Equalizer Bars
        else {
          const maxBarHeight = height - 4;

          for (let i = 0; i < barCount; i++) {
            const level = smoothedBars[i] || 0;
            const barH = Math.max(2, level * maxBarHeight);
            const x = i * (barWidth + gap);
            const y = height - barH;

            // Vertical Gradient with glowing top
            const gradient = ctx.createLinearGradient(0, height, 0, y);
            gradient.addColorStop(0, `${barColor}33`);
            gradient.addColorStop(0.6, barColor);
            gradient.addColorStop(1, secondaryColor || '#ffffff');

            ctx.fillStyle = gradient;
            ctx.shadowBlur = level > 0.3 ? 10 : 3;
            ctx.shadowColor = glowColor;

            ctx.fillRect(x, y, barWidth, barH);
          }
        }
      } 
      // -------------------------------------------------------------
      // 3. WAVE (Fluid Liquid Neon Spline Waves - Apple Music / Siri)
      // -------------------------------------------------------------
      else if (mode === 'wave') {
        const bufferLength = analyser ? analyser.frequencyBinCount : 256;
        const freqData = new Uint8Array(bufferLength);

        let energy = 0;
        if (analyser && isPlaying) {
          analyser.getByteFrequencyData(freqData);
          let sum = 0;
          for (let i = 0; i < 40; i++) sum += freqData[i];
          energy = Math.min(1.0, (sum / 40) / 200);
        } else if (isPlaying) {
          energy = 0.35;
        }

        const centerY = height / 2;
        const wavePoints = 36;
        const step = width / (wavePoints - 1);

        // Layer 1: Ambient Background Glow Wave
        const drawWaveLayer = (amplitude: number, freq: number, phaseOffset: number, color: string, alpha: number, isFill = false) => {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, centerY);

          const points: { x: number; y: number }[] = [];
          for (let i = 0; i < wavePoints; i++) {
            const x = i * step;
            const normX = i / (wavePoints - 1);
            // Harmonic envelope (soft at edges, lively in middle)
            const envelope = Math.sin(normX * Math.PI);
            
            // Audio-reactive modulation
            const audioMod = analyser && isPlaying && freqData[i * 2] 
              ? (freqData[i * 2] / 255) * 0.6 
              : 0.15;

            const y = centerY + Math.sin(normX * freq * Math.PI * 2 + phase + phaseOffset) * (amplitude + audioMod * height * 0.4) * envelope;
            points.push({ x, y });
          }

          // Smooth Catmull-Rom / Bézier spline
          for (let i = 0; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }
          const last = points[points.length - 1];
          ctx.lineTo(last.x, last.y);

          if (isFill) {
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();
            const fillGrad = ctx.createLinearGradient(0, centerY - amplitude, 0, height);
            fillGrad.addColorStop(0, `${color}44`);
            fillGrad.addColorStop(1, `${color}00`);
            ctx.fillStyle = fillGrad;
            ctx.fill();
          } else {
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 12;
            ctx.shadowColor = glowColor;
            ctx.stroke();
          }
          ctx.restore();
        };

        // Draw multi-layer harmonic liquid waves
        drawWaveLayer(height * 0.28 * Math.max(0.2, energy), 2.2, 0, barColor, 1.0, true);
        drawWaveLayer(height * 0.22 * Math.max(0.2, energy), 3.0, 1.5, secondaryColor, 0.7, false);
        drawWaveLayer(height * 0.15 * Math.max(0.2, energy), 4.0, 3.0, '#ffffff', 0.9, false);
      }

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyserRef, isPlaying, mode, barColor, secondaryColor, glowColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className} pointer-events-none transition-opacity duration-300`}
    />
  );
});

