import { Power } from 'lucide-react';
import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';

export function MasterOutput() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 shadow-2xl p-8 flex flex-col gap-8 w-full">
      <div className="flex items-center gap-3 border-b border-white/10 pb-4">
        <button aria-label="Action"
          onClick={() => playerState.toggleFx('master')}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${playerState.fxEnabled.master ? 'bg-[#ffffff]/20 text-[#ffffff] shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'bg-white/5 text-white/80 hover:bg-white/10'}`}
        >
          <Power size={14} />
        </button>
        <div>
          <h2 className="text-xl font-bold font-sans text-white/80 tracking-tight">{t('studio.masterOutput.title', 'Master Output')}</h2>
          <p className="text-secondary/60 text-xs font-mono mt-1">{t('studio.masterOutput.desc', 'Final stage output controls and panning.')}</p>
        </div>
      </div>

      <div className={`flex flex-col gap-8 transition-opacity duration-300 ${playerState.fxEnabled.master ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
        <HorizontalSlider
          value={playerState.panValue}
          min={-100}
          max={100}
          onChange={playerState.updatePanValue}
          label={t('studio.masterOutput.lrBalance', 'L/R Balance')}
          color="#ffffff"
          unit="%"
        />
      </div>

      <div className="flex items-center justify-between mt-2 p-4 bg-white/5 rounded-xl border border-white/10">
        <div>
          <span className="text-sm text-white/80 font-bold block">{t('studio.masterOutput.loudnessNorm', 'Loudness Normalization')}</span>
          <span className="text-xs text-white/80 font-mono mt-1 block">{t('studio.masterOutput.loudnessDesc', 'Smooths volume differences with a gentle end-of-chain compressor and makeup gain.')}</span>
        </div>
        <button aria-label="Action"
          onClick={playerState.toggleLoudnessNormalization}
          className={`shrink-0 w-12 h-6 rounded-full relative transition-colors ${playerState.loudnessNormalization ? 'bg-[#00E5FF]' : 'bg-white/20'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${playerState.loudnessNormalization ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 p-4 bg-white/5 rounded-xl border border-white/10">
        <div>
          <span className="text-sm text-white/80 font-bold block">{t('studio.masterOutput.hqOversample', 'High Quality Oversampling')}</span>
          <span className="text-xs text-white/80 font-mono mt-1 block">{t('studio.masterOutput.hqOversampleDesc', 'Reduces aliasing in the limiter soft clip stage. Warning: May cause lag on mobile devices.')}</span>
        </div>
        <button aria-label="Action"
          onClick={() => playerState.setUseOversample(!playerState.useOversample)}
          className={`shrink-0 w-12 h-6 rounded-full relative transition-colors ${playerState.useOversample ? 'bg-[#00E5FF]' : 'bg-white/20'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${playerState.useOversample ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
        <div>
          <span className="text-sm text-amber-500/90 font-bold block flex items-center gap-2">
            {t('studio.masterOutput.precalcIdle', 'Pre-calculate on Idle Cores')}
          </span>
          <span className="text-xs text-amber-500/60 font-mono mt-1 block pr-4">
            {t('studio.masterOutput.precalcIdleDesc', 'Saves to RAM for weak CPUs. Warning: Consumes high amount of RAM. May cause out-of-memory crashes on low RAM devices. EQ/Effects changes will only apply to the next track.')}
          </span>
        </div>
        <button aria-label="Action"
          onClick={() => playerState.setPrecalculateOnIdle(!playerState.precalculateOnIdle)}
          className={`shrink-0 w-12 h-6 rounded-full relative transition-colors ${playerState.precalculateOnIdle ? 'bg-amber-500' : 'bg-white/20'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${playerState.precalculateOnIdle ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
      </div>
    </div>
  );
}
