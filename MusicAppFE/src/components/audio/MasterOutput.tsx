import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioToggleRow } from './AudioToggleRow';
import { QueuePrecalculatePanel } from './QueuePrecalculatePanel';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';

export function MasterOutput() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <AudioEffectPanel
      title={t('studio.masterOutput.title', 'Master Output')}
      description={t('studio.masterOutput.desc', 'Final stage output controls, latency buffer and panning.')}
      leading={(
        <EffectPowerButton
          active={playerState.fxEnabled.master}
          onClick={() => playerState.toggleFx('master')}
          activeClassName="bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.4)] border border-white/30"
        />
      )}
    >

      <EffectControlsGate active={playerState.fxEnabled.master} className="flex flex-col gap-8">
        <HorizontalSlider
          value={playerState.panValue}
          min={-100}
          max={100}
          onChange={playerState.updatePanValue}
          label={t('studio.masterOutput.lrBalance', 'L/R Balance')}
          color="#00f5ff"
          unit="%"
        />
      </EffectControlsGate>

      <AudioToggleRow
        title={t('studio.dynamics.limiterTitle', 'Anti-Clipping Master Limiter')}
        description={t('studio.dynamics.limiterDesc', 'Catches final output peaks after soft clipping, reducing crackling when EQ, preamp, or effects raise the level. Recommended to leave on if CPU is powerful enough.')}
        checked={playerState.fxEnabled.limiter}
        onToggle={() => playerState.toggleFx('limiter')}
      />

      <AudioToggleRow
        title={t('studio.masterOutput.hqOversample', 'High Quality Oversampling')}
        description={t('studio.masterOutput.hqOversampleDesc', 'Uses a 4x FIR oversampled soft clipper to reduce clipping aliasing. May be heavy on weak phones.')}
        checked={playerState.useOversample}
        onToggle={playerState.toggleUseOversample}
        disabled={!playerState.fxEnabled.limiter}
      />

      <AudioToggleRow
        title={t('studio.masterOutput.loudnessNorm', 'Loudness Normalization')}
        description={t('studio.masterOutput.loudnessDesc', 'Measures each track and applies fixed LUFS gain with peak-safe headroom. Best quality when pre-calculation is enabled.')}
        checked={playerState.loudnessNormalization}
        onToggle={playerState.toggleLoudnessNormalization}
      />

      <AudioToggleRow
        tone="amber"
        title={t('studio.masterOutput.precalcIdle', 'Pre-calculate for Weak CPUs')}
        description={t('studio.masterOutput.precalcIdleDesc', 'For weak CPUs with enough RAM: renders each track before playback so heavy effects do not have to run in real time. This normal mode handles one track at a time, not the whole queue. EQ/Effects changes apply on the next track.')}
        checked={playerState.precalculateOnIdle}
        onToggle={() => playerState.setPrecalculateOnIdle(!playerState.precalculateOnIdle)}
      />

      <AudioToggleRow
        tone="amber"
        title={t('studio.masterOutput.fullQueueCache', 'Full Queue RAM Cache')}
        description={t('studio.masterOutput.fullQueueCacheDesc', 'Keep precalculated audio buffers for the entire queue in RAM and unlock full-queue pre-calculation. Allows instant playback of any rendered track, but consumes significantly more memory.')}
        checked={playerState.fullQueueCacheEnabled}
        onToggle={() => playerState.setFullQueueCacheEnabled(!playerState.fullQueueCacheEnabled)}
        titleClassName="text-amber-300/90"
        descriptionClassName="text-amber-300/65"
      />

      {playerState.precalculateOnIdle && playerState.fullQueueCacheEnabled && (
        <QueuePrecalculatePanel playerState={playerState} />
      )}
    </AudioEffectPanel>
  );
}
