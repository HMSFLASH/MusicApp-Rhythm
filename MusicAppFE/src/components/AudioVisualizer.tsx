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

    const render = () => {
      const dpr = globalThis.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef?.current;

      if (mode === 'bars') {
        const barCount = mode === 'bars' ? Math.min(48, Math.floor(width / 6)) : 24;
        const barWidth = Math.max(2, (width / barCount) - 2);
        const freqData = new Uint8Array(barCount);

        if (analyser && isPlaying) {
          const bufferLength = analyser.frequencyBinCount;
          const fullData = new Uint8Array(bufferLength);
          analyser.getByteFrequencyData(fullData);

          const step = Math.floor(bufferLength / barCount);
          for (let i = 0; i < barCount; i++) {
            freqData[i] = fullData[i * step] || 0;
          }
        } else if (isPlaying) {
          // Simulated pulsing
          const time = Date.now() / 200;
          for (let i = 0; i < barCount; i++) {
            freqData[i] = Math.sin(time + i * 0.3) * 60 + 80;
          }
        }

        for (let i = 0; i < barCount; i++) {
          const value = freqData[i] || 0;
          const barHeight = Math.max(3, (value / 255) * (height - 6));
          const x = i * (barWidth + 2);
          const y = height - barHeight;

          // Peak cap calculation
          if (!peakBars[i] || barHeight > peakBars[i]) {
            peakBars[i] = barHeight;
          } else {
            peakBars[i] = Math.max(0, peakBars[i] - 0.5);
          }

          // Bar Gradient
          const gradient = ctx.createLinearGradient(0, height, 0, y);
          gradient.addColorStop(0, `${barColor}33`);
          gradient.addColorStop(0.7, barColor);
          gradient.addColorStop(1, '#ffffff');

          ctx.fillStyle = gradient;
          ctx.shadowBlur = 8;
          ctx.shadowColor = glowColor;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          // Draw Peak Cap
          const peakY = height - peakBars[i] - 2;
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 4;
          ctx.shadowColor = '#ffffff';
          ctx.fillRect(x, Math.max(0, peakY), barWidth, 1.5);
        }
      } else if (mode === 'wave') {
        const bufferLength = analyser ? analyser.fftSize : 128;
        const timeData = new Uint8Array(bufferLength);

        if (analyser && isPlaying) {
          analyser.getByteTimeDomainData(timeData);
        } else {
          for (let i = 0; i < bufferLength; i++) {
            timeData[i] = isPlaying ? 128 + Math.sin(Date.now() / 200 + i * 0.1) * 25 : 128;
          }
        }

        ctx.lineWidth = 2;
        ctx.strokeStyle = barColor;
        ctx.shadowBlur = 12;
        ctx.shadowColor = glowColor;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
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

        ctx.lineTo(width, height / 2);
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
