import { useState } from 'react';
import { HorizontalSlider } from './HorizontalSlider';
import { Gauge, ChevronLeft, AlertTriangle } from 'lucide-react';

interface SpeedPitchPanelProps {
  playbackRate: number;
  updatePlaybackRate: (val: number) => void;
  preservesPitch: boolean;
  togglePreservesPitch: () => void;
  pitchRate: number;
  updatePitchRate: (val: number) => void;
  speedPitchMode: 'simple' | 'advanced';
  setSpeedPitchMode: (mode: 'simple' | 'advanced') => void;
  speedPitchScope: 'global' | 'track';
  setSpeedPitchScope: (scope: 'global' | 'track') => void;
  precalculateOnIdle: boolean;
  currentTrackId?: string;
  t: (key: string) => string;
  onBack: () => void;
}

export function SpeedPitchPanel({
  playbackRate,
  updatePlaybackRate,
  preservesPitch,
  togglePreservesPitch,
  pitchRate,
  updatePitchRate,
  speedPitchMode,
  setSpeedPitchMode,
  speedPitchScope,
  setSpeedPitchScope,
  precalculateOnIdle,
  t,
  onBack,
}: SpeedPitchPanelProps) {
  const canUseAdvanced = precalculateOnIdle;
  const [hoveredAdvanced, setHoveredAdvanced] = useState(false);

  return (
    <div className="flex flex-col w-full bg-[#151515]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
        <button
          onClick={onBack}
          className="p-1 -ml-1 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Gauge size={15} className="text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/90">{t('nowPlaying.speedAndPitch')}</span>
        </div>
      </div>

      {/* Scope Selector (Segmented) */}
      <div className="px-4 pt-3">
        <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setSpeedPitchScope('global')}
            className={`flex-1 text-[11px] py-1 rounded-md transition-all font-medium ${
              speedPitchScope === 'global'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t('nowPlaying.allSongs')}
          </button>
          <button
            onClick={() => setSpeedPitchScope('track')}
            className={`flex-1 text-[11px] py-1 rounded-md transition-all font-medium ${
              speedPitchScope === 'track'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t('nowPlaying.thisTrack')}
          </button>
        </div>
      </div>

      {/* Mode Selector (Segmented) */}
      <div className="px-4 pt-2 pb-4">
        <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setSpeedPitchMode('simple')}
            className={`flex-1 text-[11px] py-1 rounded-md transition-all font-medium ${
              speedPitchMode === 'simple'
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {t('nowPlaying.simple')}
          </button>
          <div className="relative flex-1">
            <button
              onClick={() => {
                if (canUseAdvanced) {
                  setSpeedPitchMode('advanced');
                }
              }}
              onMouseEnter={() => setHoveredAdvanced(true)}
              onMouseLeave={() => setHoveredAdvanced(false)}
              className={`w-full text-[11px] py-1 rounded-md transition-all font-medium ${
                !canUseAdvanced
                  ? 'text-white/20 cursor-not-allowed'
                  : speedPitchMode === 'advanced'
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t('nowPlaying.advanced')}
            </button>
            {/* Premium non-overlapping tooltip */}
            {!canUseAdvanced && hoveredAdvanced && (
              <div className="absolute right-0 bottom-full mb-2 w-52 p-2.5 bg-[#1e1e1e] border border-white/10 rounded-lg shadow-2xl z-50 text-left pointer-events-none">
                <div className="flex items-start gap-1.5 text-amber-500">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <span className="text-[10px] leading-normal text-white/80 whitespace-normal">
                    {t('nowPlaying.advancedRequiresPrecalculate')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="px-4 pb-4 border-t border-white/5 pt-4">
        {speedPitchMode === 'simple' ? (
          /* Simple Mode */
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">{t('nowPlaying.tempo')}</span>
                <span className="text-xs font-mono text-white/95 font-semibold">{playbackRate.toFixed(2)}x</span>
              </div>
              <button
                onClick={togglePreservesPitch}
                className={`text-[10px] px-2.5 py-1 rounded transition-all font-medium border ${
                  preservesPitch
                    ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                    : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {preservesPitch ? t('nowPlaying.preservePitch') : t('nowPlaying.vinyl')}
              </button>
            </div>
            <HorizontalSlider
              value={playbackRate}
              min={0.5}
              max={3.0}
              step={0.05}
              onChange={updatePlaybackRate}
              label=""
              hideLabels={true}
              color="#00f5ff"
            />
          </div>
        ) : (
          /* Advanced Mode */
          <div className="flex flex-col gap-4">
            {/* Speed */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">{t('nowPlaying.speed')}</span>
                <span className="text-xs font-mono text-white/95 font-semibold">{playbackRate.toFixed(2)}x</span>
              </div>
              <HorizontalSlider
                value={playbackRate}
                min={0.5}
                max={3.0}
                step={0.05}
                onChange={updatePlaybackRate}
                label=""
                hideLabels={true}
                color="#00f5ff"
              />
            </div>

            {/* Pitch */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">{t('nowPlaying.pitch')}</span>
                <span className="text-xs font-mono text-white/95 font-semibold">{pitchRate.toFixed(2)}x</span>
              </div>
              <HorizontalSlider
                value={pitchRate}
                min={0.5}
                max={2.0}
                step={0.05}
                onChange={updatePitchRate}
                label=""
                hideLabels={true}
                color="#a855f7"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
