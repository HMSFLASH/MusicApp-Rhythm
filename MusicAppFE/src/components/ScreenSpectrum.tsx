import { useEffect, useRef } from 'react';

interface ScreenSpectrumProps {
  analyser: AnalyserNode | null;
}

export function ScreenSpectrum({ analyser }: ScreenSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Logarithmic bands mapping
    const sampleRate = analyser.context.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    const numBands = 80;
    const minFreq = 20;
    const maxFreq = 20000;

    const bands: { start: number; end: number }[] = [];
    for (let i = 0; i < numBands; i++) {
      const freqStart = minFreq * Math.pow(maxFreq / minFreq, i / numBands);
      const freqEnd = minFreq * Math.pow(maxFreq / minFreq, (i + 1) / numBands);
      const binStart = Math.floor(freqStart / nyquist * bufferLength);
      const binEnd = Math.floor(freqEnd / nyquist * bufferLength);
      bands.push({
        start: Math.min(bufferLength - 1, Math.max(0, binStart)),
        end: Math.min(bufferLength - 1, Math.max(0, binEnd))
      });
    }

    const renderFrame = () => {
      animationFrameId = requestAnimationFrame(renderFrame);

      analyser.getByteFrequencyData(dataArray);

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = width / numBands;
      let x = 0;

      for (let i = 0; i < numBands; i++) {
        const { start, end } = bands[i];
        let maxVal = 0;
        for (let j = start; j <= end; j++) {
          if (dataArray[j] > maxVal) maxVal = dataArray[j];
        }

        const barHeight = Math.max(2, (maxVal / 255) * height);

        // Classic spectrum color
        const r = barHeight + (25 * (i / numBands));
        const g = 250 * (i / numBands);
        const b = 50;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const rectWidth = Math.max(1, barWidth - 1);
        ctx.fillRect(x, height - barHeight, rectWidth, barHeight);

        x += barWidth;
      }
    };

    renderFrame();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser]);

  return (
    <div className="absolute inset-0 flex items-end justify-center pointer-events-none overflow-hidden transition-all z-0">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
}
