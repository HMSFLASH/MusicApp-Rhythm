import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';

export function ToneControls() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <AudioEffectPanel
      title={t('studio.tone.title', 'Preamp & Tone')}
      description={t('studio.tone.desc', 'Global gain adjustments and bass/treble tuning.')}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <EffectPowerButton
            size="sm"
            active={playerState.fxEnabled.preamp}
            onClick={() => playerState.toggleFx('preamp')}
            activeClassName="bg-primary/20 text-primary shadow-[0_0_12px_rgba(0,245,255,0.4)] border border-primary/30"
          />
          <span className="text-sm font-semibold text-slate-100">Input Preamp</span>
        </div>
        <EffectControlsGate active={playerState.fxEnabled.preamp}>
          <HorizontalSlider
            value={playerState.preampGain}
            min={-12}
            max={6}
            onChange={playerState.updatePreampGain}
            label={t('studio.tone.preamp', 'Preamp')}
            color="#00f5ff"
          />
        </EffectControlsGate>
      </div>

      <div className="h-px w-full bg-white/[0.06]"></div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <EffectPowerButton
            size="sm"
            active={playerState.fxEnabled.tone}
            onClick={() => playerState.toggleFx('tone')}
            activeClassName="bg-cyan-500/20 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] border border-cyan-500/30"
          />
          <span className="text-sm font-semibold text-slate-100">Tone Controls</span>
        </div>
        <EffectControlsGate active={playerState.fxEnabled.tone} className="flex flex-col gap-8">
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
            color="#f97316"
          />
        </EffectControlsGate>
      </div>
    </AudioEffectPanel>
  );
}
