import { useEffect, useRef, memo } from 'react';

interface AudioVisualizerProps {
  analyserRef?: React.RefObject<AnalyserNode | null>;
  isPlaying?: boolean;
  mode?: 'bars' | 'wave' | 'compact';
  className?: string;
  barColor?: string;
  glowColor?: string;
}

export const AudioVisualizer = memo(function AudioVisualizer({
  analyserRef,
  isPlaying = false,
  mode = 'bars',
  className = 'w-full h-16',
  barColor = '#00f5ff',
  glowColor = 'rgba(0, 245, 255, 0.4)',
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const peakBars: number[] = [];
    const smoothedBars: number[] = [];

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

      if (mode === 'bars') {
        const barCount = Math.min(52, Math.max(24, Math.floor(width / 7)));
        const gap = 2;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(2, (width - totalGap) / barCount);

        if (analyser && isPlaying) {
          const bufferLength = analyser.frequencyBinCount;
          const fullData = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(fullData);

          const sampleRate = analyser.context?.sampleRate || 44100;
          const nyquist = sampleRate / 2;
          const binWidth = nyquist / bufferLength;

          const minFreq = 20; // 20 Hz
          const maxFreq = 20000; // 20000 Hz

          for (let i = 0; i < barCount; i++) {
            // Logarithmic frequency bounds from 20 Hz to 20,000 Hz
            const fStart = minFreq * Math.pow(maxFreq / minFreq, i / barCount);
            const fEnd = minFreq * Math.pow(maxFreq / minFreq, (i + 1) / barCount);

            const binStart = Math.max(0, Math.floor(fStart / binWidth));
            const binEnd = Math.min(bufferLength - 1, Math.max(binStart, Math.ceil(fEnd / binWidth)));

            let sum = 0;
            let count = 0;

            for (let b = binStart; b <= binEnd; b++) {
              sum += fullData[b] || 0;
              count++;
            }

            // Clean average frequency energy
            const bandEnergy = count > 0 ? (sum / count) : 0;
            const targetHeight = Math.max(2, (bandEnergy / 255) * (height - 4));

            // Smooth fluid motion (LERP) - no harsh jitter or aggressive bouncing
            const prev = smoothedBars[i] ?? 2;
            if (targetHeight > prev) {
              smoothedBars[i] = prev + (targetHeight - prev) * 0.35; // Gentle smooth rise
            } else {
              smoothedBars[i] = prev + (targetHeight - prev) * 0.14; // Silky fluid fall
            }
          }
        } else if (isPlaying) {
          // Gentle ambient idle pulse
          const time = Date.now() / 400;
          for (let i = 0; i < barCount; i++) {
            const targetHeight = Math.max(2, (Math.sin(time + i * 0.15) * 0.2 + 0.3) * (height * 0.35));
            const prev = smoothedBars[i] ?? 2;
            smoothedBars[i] = prev + (targetHeight - prev) * 0.1;
          }
        } else {
          // Smooth decay to bottom when stopped/paused
          for (let i = 0; i < barCount; i++) {
            const prev = smoothedBars[i] ?? 0;
            smoothedBars[i] = Math.max(0, prev * 0.9 - 0.2);
          }
        }

        // Render Bars & Peak Caps
        for (let i = 0; i < barCount; i++) {
          const barHeight = smoothedBars[i] || 2;
          const x = i * (barWidth + gap);
          const y = height - barHeight;

          // Slower, smoother peak cap descent
          if (!peakBars[i] || barHeight >= peakBars[i]) {
            peakBars[i] = barHeight;
          } else {
            peakBars[i] = Math.max(0, peakBars[i] - 0.35);
          }

          // Bar Gradient with glowing top
          const gradient = ctx.createLinearGradient(0, height, 0, y);
          gradient.addColorStop(0, `${barColor}22`);
          gradient.addColorStop(0.65, barColor);
          gradient.addColorStop(1, '#ffffff');

          ctx.fillStyle = gradient;
          ctx.shadowBlur = 10;
          ctx.shadowColor = glowColor;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          // Draw Peak Cap Indicator
          if (peakBars[i] > 3) {
            const peakY = height - peakBars[i] - 2;
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#ffffff';
            ctx.fillRect(x, Math.max(0, peakY), barWidth, 1.5);
          }
        }
      } else if (mode === 'wave') {
        const bufferLength = analyser ? analyser.fftSize : 256;
        const timeData = new Uint8Array(bufferLength);

        if (analyser && isPlaying) {
          analyser.getByteTimeDomainData(timeData);
        } else {
          for (let i = 0; i < bufferLength; i++) {
            timeData[i] = isPlaying ? 128 + Math.sin(Date.now() / 200 + i * 0.1) * 20 : 128;
          }
        }

        ctx.lineWidth = 2.5;
        ctx.strokeStyle = barColor;
        ctx.shadowBlur = 14;
        ctx.shadowColor = glowColor;
        ctx.beginPath();

        const sliceWidth = width / (bufferLength - 1);
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.stroke();
      }

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyserRef, isPlaying, mode, barColor, glowColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`${className} pointer-events-none`}
    />
  );
});
