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
      description={t('studio.masterOutput.desc', 'Final stage output controls and panning.')}
      leading={(
        <EffectPowerButton
          active={playerState.fxEnabled.master}
          onClick={() => playerState.toggleFx('master')}
          activeClassName="bg-[#ffffff]/20 text-[#ffffff] shadow-[0_0_15px_rgba(255,255,255,0.4)]"
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
          color="#ffffff"
          unit="%"
        />
      </EffectControlsGate>

      <AudioToggleRow
        title={t('studio.masterOutput.loudnessNorm', 'Loudness Normalization')}
        description={t('studio.masterOutput.loudnessDesc', 'Measures each track and applies fixed LUFS gain with peak-safe headroom. Best quality when pre-calculation is enabled.')}
        checked={playerState.loudnessNormalization}
        onToggle={playerState.toggleLoudnessNormalization}
      />

      <AudioToggleRow
        title={t('studio.masterOutput.hqOversample', 'High Quality Oversampling')}
        description={t('studio.masterOutput.hqOversampleDesc', 'Reduces aliasing in the limiter soft clip stage. Warning: May cause lag on mobile devices.')}
        checked={playerState.useOversample}
        onToggle={() => playerState.setUseOversample(!playerState.useOversample)}
      />

      <AudioToggleRow
        tone="amber"
        title={t('studio.masterOutput.precalcIdle', 'Pre-calculate for Weak CPUs')}
        description={t('studio.masterOutput.precalcIdleDesc', 'For weak CPUs with enough RAM: renders each track before playback so heavy effects do not have to run in real time. This normal mode handles one track at a time, not the whole queue. EQ/Effects changes apply on the next track.')}
        checked={playerState.precalculateOnIdle}
        onToggle={() => playerState.setPrecalculateOnIdle(!playerState.precalculateOnIdle)}
      />

      {playerState.precalculateOnIdle && (
        <>
          <AudioToggleRow
            tone="amber"
            title={t('studio.masterOutput.renderSignatureCache', 'Reusable Render Cache')}
            description={t('studio.masterOutput.renderSignatureCacheDesc', 'Keeps rendered buffers by track and audio settings signature so returning to an older EQ/effects setup can reuse RAM cache. Uses extra memory.')}
            checked={playerState.renderSignatureCacheEnabled}
            onToggle={() => playerState.setRenderSignatureCacheEnabled(!playerState.renderSignatureCacheEnabled)}
            titleClassName="text-amber-300/90"
            descriptionClassName="text-amber-300/65"
          />

          <QueuePrecalculatePanel playerState={playerState} />
        </>
      )}
    </AudioEffectPanel>
  );
}
