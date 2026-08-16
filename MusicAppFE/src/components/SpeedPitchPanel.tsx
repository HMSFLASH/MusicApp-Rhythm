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
    <div className="flex flex-col w-full bg-[#0c1626]/95 border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-2xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
        <button
          onClick={onBack}
          className="p-1 -ml-1 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <Gauge size={15} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-display">{t('nowPlaying.speedAndPitch')}</span>
        </div>
      </div>

      {/* Scope Selector (Segmented) */}
      <div className="px-4 pt-3.5">
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setSpeedPitchScope('global')}
            className={`flex-1 text-xs py-1.5 rounded-lg transition-all font-semibold ${
              speedPitchScope === 'global'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('nowPlaying.allSongs')}
          </button>
          <button
            onClick={() => setSpeedPitchScope('track')}
            className={`flex-1 text-xs py-1.5 rounded-lg transition-all font-semibold ${
              speedPitchScope === 'track'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t('nowPlaying.thisTrack')}
          </button>
        </div>
      </div>

      {/* Mode Selector (Segmented) */}
      <div className="px-4 pt-2 pb-3.5">
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setSpeedPitchMode('simple')}
            className={`flex-1 text-xs py-1.5 rounded-lg transition-all font-semibold ${
              speedPitchMode === 'simple'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
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
              className={`w-full text-xs py-1.5 rounded-lg transition-all font-semibold ${
                !canUseAdvanced
                  ? 'text-slate-600 cursor-not-allowed'
                  : speedPitchMode === 'advanced'
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('nowPlaying.advanced')}
            </button>
            {/* Premium non-overlapping tooltip */}
            {!canUseAdvanced && hoveredAdvanced && (
              <div className="absolute right-0 bottom-full mb-2 w-52 p-3 bg-[#0c1626] border border-amber-500/30 rounded-xl shadow-2xl z-50 text-left pointer-events-none backdrop-blur-2xl">
                <div className="flex items-start gap-2 text-amber-400">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span className="text-[10px] leading-relaxed text-amber-200/90 whitespace-normal font-mono">
                    {t('nowPlaying.advancedRequiresPrecalculate')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="px-4 pb-4 border-t border-white/[0.06] pt-3.5">
        {speedPitchMode === 'simple' ? (
          /* Simple Mode */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t('nowPlaying.tempo')}</span>
                <span className="text-xs text-primary font-bold">{playbackRate.toFixed(2)}x</span>
              </div>
              <button
                onClick={togglePreservesPitch}
                className={`text-[10px] px-2.5 py-1 rounded-lg transition-all font-semibold border ${
                  preservesPitch
                    ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                    : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
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
              <div className="flex justify-between items-center mb-0.5 font-mono">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t('nowPlaying.speed')}</span>
                <span className="text-xs text-primary font-bold">{playbackRate.toFixed(2)}x</span>
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
              <div className="flex justify-between items-center mb-0.5 font-mono">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{t('nowPlaying.pitch')}</span>
                <span className="text-xs text-purple-400 font-bold">{pitchRate.toFixed(2)}x</span>
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
