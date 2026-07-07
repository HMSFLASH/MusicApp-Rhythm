import { Power } from 'lucide-react';
import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';

export function ToneControls() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 shadow-2xl p-8 flex flex-col gap-8 w-full">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold font-sans text-white/80 tracking-tight">{t('studio.tone.title', 'Preamp & Tone')}</h2>
            <p className="text-secondary/60 text-xs font-mono mt-1">{t('studio.tone.desc', 'Global gain adjustments and bass/treble tuning.')}</p>
          </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => playerState.toggleFx('preamp')}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${playerState.fxEnabled.preamp ? 'bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.4)]' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
          >
            <Power size={10} />
          </button>
          <span className="text-sm font-bold text-white/80">Input Preamp</span>
        </div>
        <div className={`transition-opacity duration-300 ${playerState.fxEnabled.preamp ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <HorizontalSlider
            value={playerState.preampGain}
            min={-15}
            max={15}
            onChange={playerState.updatePreampGain}
            label={t('studio.tone.preamp', 'Preamp')}
            color="#00E5FF"
          />
        </div>
      </div>

      <div className="h-px w-full bg-white/5"></div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => playerState.toggleFx('tone')}
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${playerState.fxEnabled.tone ? 'bg-[#00f5ff]/20 text-[#00f5ff] shadow-[0_0_10px_rgba(0,245,255,0.4)]' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
          >
            <Power size={10} />
          </button>
          <span className="text-sm font-bold text-white/80">Tone Controls</span>
        </div>
        <div className={`flex flex-col gap-8 transition-opacity duration-300 ${playerState.fxEnabled.tone ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <HorizontalSlider
            value={playerState.trebleGain}
            min={-15}
            max={15}
            onChange={playerState.updateTrebleGain}
            label={t('studio.tone.treble', 'Treble')}
            color="#00f5ff"
          />
          <HorizontalSlider
            value={playerState.bassGain}
            min={-15}
            max={15}
            onChange={playerState.updateBassGain}
            label={t('studio.tone.bass', 'Bass')}
            color="#ff6600"
          />
        </div>
      </div>
    </div>
  );
}
