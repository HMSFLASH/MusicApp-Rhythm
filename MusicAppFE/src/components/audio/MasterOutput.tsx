import { Power } from 'lucide-react';
import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioToggleRow } from './AudioToggleRow';
import { QueuePrecalculatePanel } from './QueuePrecalculatePanel';

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

      <AudioToggleRow
        title={t('studio.masterOutput.loudnessNorm', 'Loudness Normalization')}
        description={t('studio.masterOutput.loudnessDesc', 'Smooths volume differences with a gentle end-of-chain compressor and makeup gain.')}
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
    </div>
  );
}
