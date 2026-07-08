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
            activeClassName="bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.4)]"
          />
          <span className="text-sm font-bold text-white/80">Input Preamp</span>
        </div>
        <EffectControlsGate active={playerState.fxEnabled.preamp}>
          <HorizontalSlider
            value={playerState.preampGain}
            min={-15}
            max={15}
            onChange={playerState.updatePreampGain}
            label={t('studio.tone.preamp', 'Preamp')}
            color="#00E5FF"
          />
        </EffectControlsGate>
      </div>

      <div className="h-px w-full bg-white/5"></div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <EffectPowerButton
            size="sm"
            active={playerState.fxEnabled.tone}
            onClick={() => playerState.toggleFx('tone')}
            activeClassName="bg-[#00f5ff]/20 text-[#00f5ff] shadow-[0_0_10px_rgba(0,245,255,0.4)]"
          />
          <span className="text-sm font-bold text-white/80">Tone Controls</span>
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
            color="#ff6600"
          />
        </EffectControlsGate>
      </div>
    </AudioEffectPanel>
  );
}
