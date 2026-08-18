import { memo } from 'react';
import type { PaletteResult } from '../utils/colorExtractor';

interface MeshAmbientGlowProps {
  palette: PaletteResult;
  isPlaying?: boolean;
  className?: string;
}

export const MeshAmbientGlow = memo(function MeshAmbientGlow({
  palette,
  isPlaying = false,
  className = '',
}: MeshAmbientGlowProps) {
  const playState = isPlaying ? 'running' : 'paused';

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`}
      aria-hidden="true"
    >
      {/* Orb 1: Top-Left Primary Vibrant Halo */}
      <div
        className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] min-w-[360px] min-h-[360px] max-w-[850px] max-h-[850px] rounded-full blur-[90px] sm:blur-[120px] md:blur-[150px] opacity-75 mix-blend-screen transition-all duration-1000 will-change-transform animate-ambient-1"
        style={{
          background: `radial-gradient(circle at 35% 35%, rgba(${palette.rgbPrimary}, 0.38) 0%, rgba(${palette.rgbPrimary}, 0.12) 45%, transparent 70%)`,
          animationPlayState: playState,
        }}
      />

      {/* Orb 2: Center-Right Secondary Complementary Halo */}
      <div
        className="absolute top-[10%] -right-[15%] w-[60vw] h-[60vw] min-w-[380px] min-h-[380px] max-w-[900px] max-h-[900px] rounded-full blur-[100px] sm:blur-[130px] md:blur-[160px] opacity-70 mix-blend-screen transition-all duration-1000 will-change-transform animate-ambient-2"
        style={{
          background: `radial-gradient(circle at 65% 35%, rgba(${palette.rgbSecondary}, 0.32) 0%, rgba(${palette.rgbSecondary}, 0.08) 50%, transparent 75%)`,
          animationPlayState: playState,
        }}
      />

      {/* Orb 3: Bottom-Center/Left Accent Halo */}
      <div
        className="absolute -bottom-[20%] left-[15%] w-[50vw] h-[50vw] min-w-[320px] min-h-[320px] max-w-[780px] max-h-[780px] rounded-full blur-[85px] sm:blur-[115px] md:blur-[140px] opacity-65 mix-blend-screen transition-all duration-1000 will-change-transform animate-ambient-3"
        style={{
          background: `radial-gradient(circle at 50% 80%, rgba(${palette.rgbAccent}, 0.28) 0%, rgba(${palette.rgbAccent}, 0.06) 50%, transparent 75%)`,
          animationPlayState: playState,
        }}
      />

      {/* Orb 4: Center Vinyl Backdrop Spotlight */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70vw] h-[70vw] max-w-[950px] max-h-[950px] rounded-full blur-[100px] md:blur-[160px] transition-all duration-1000 will-change-transform ${
          isPlaying ? 'opacity-80 scale-105 animate-ambient-pulse' : 'opacity-40 scale-95'
        }`}
        style={{
          background: `radial-gradient(circle, rgba(${palette.rgbPrimary}, 0.22) 0%, rgba(${palette.rgbSecondary}, 0.12) 45%, transparent 75%)`,
        }}
      />

      {/* Layer 5: Dark Frosted Vignette Overlay for High Typography Contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/55 to-background/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(6,11,20,0.65)_100%)]" />
    </div>
  );
});
