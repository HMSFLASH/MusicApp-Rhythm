import { Cpu, Power, Zap } from 'lucide-react';
import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';

export function MasterOutput() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();
  const queuePrecalculateStatus = playerState.queuePrecalculateStatus;
  const queueCount = playerState.queue?.length ?? 0;
  const cpuCores = queuePrecalculateStatus?.cores ?? (navigator.hardwareConcurrency ?? 4);
  const completedCount = queuePrecalculateStatus?.completed ?? 0;
  const failedCount = queuePrecalculateStatus?.failed ?? 0;
  const totalCount = queuePrecalculateStatus?.total ?? 0;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round(((completedCount + failedCount) / totalCount) * 100)) : 0;

  const handlePrecalculateQueue = () => {
    if (queueCount === 0 || queuePrecalculateStatus?.isRunning) return;

    const shouldContinue = window.confirm(t('studio.masterOutput.queuePrecalcWarning', {
      count: queueCount,
      cores: cpuCores,
      defaultValue: 'You are about to make the browser pre-render the entire {{count}}-track queue using every CPU core it reports ({{cores}} cores). If your machine is strong, hit OK and prove it. If not, expect heat, lag, RAM pressure, or a crashed tab. Continue?'
    }));

    if (!shouldContinue) return;
    playerState.precalculateEntireQueue();
  };

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
            {t('studio.masterOutput.precalcIdle', 'Pre-calculate for Weak CPUs')}
          </span>
          <span className="text-xs text-amber-500/60 font-mono mt-1 block pr-4">
            {t('studio.masterOutput.precalcIdleDesc', 'For weak CPUs with enough RAM: renders each track before playback so heavy effects do not have to run in real time. This normal mode handles one track at a time, not the whole queue. EQ/Effects changes apply on the next track.')}
          </span>
        </div>
        <button aria-label="Action"
          onClick={() => playerState.setPrecalculateOnIdle(!playerState.precalculateOnIdle)}
          className={`shrink-0 w-12 h-6 rounded-full relative transition-colors ${playerState.precalculateOnIdle ? 'bg-amber-500' : 'bg-white/20'}`}
        >
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${playerState.precalculateOnIdle ? 'translate-x-6' : 'translate-x-0'}`}></div>
        </button>
      </div>

      {playerState.precalculateOnIdle && (
        <>
          <div className="flex items-center justify-between mt-2 p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
            <div>
              <span className="text-sm text-amber-300/90 font-bold block">
                {t('studio.masterOutput.renderSignatureCache', 'Reusable Render Cache')}
              </span>
              <span className="text-xs text-amber-300/65 font-mono mt-1 block pr-4">
                {t('studio.masterOutput.renderSignatureCacheDesc', 'Keeps rendered buffers by track and audio settings signature so returning to an older EQ/effects setup can reuse RAM cache. Uses extra memory.')}
              </span>
            </div>
            <button aria-label="Action"
              onClick={() => playerState.setRenderSignatureCacheEnabled(!playerState.renderSignatureCacheEnabled)}
              className={`shrink-0 w-12 h-6 rounded-full relative transition-colors ${playerState.renderSignatureCacheEnabled ? 'bg-amber-500' : 'bg-white/20'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${playerState.renderSignatureCacheEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>

          <div className="flex flex-col gap-3 mt-2 p-4 bg-red-500/5 rounded-xl border border-red-500/20">
            <div className="flex items-start gap-3">
              <Cpu className="text-red-400 shrink-0 mt-0.5" size={18} />
              <div className="min-w-0 flex-1">
                <span className="text-sm text-red-300/90 font-bold block">
                  {t('studio.masterOutput.queuePrecalcTitle', 'Full Queue Pre-calculate')}
                </span>
                <span className="text-xs text-red-300/65 font-mono mt-1 block">
                  {t('studio.masterOutput.queuePrecalcDesc', {
                    cores: cpuCores,
                    defaultValue: 'Uses all {{cores}} CPU cores the browser exposes and keeps rendered buffers in RAM until audio settings change.'
                  })}
                </span>
              </div>
            </div>

            <button
              aria-label={t('studio.masterOutput.queuePrecalcButton', 'Pre-calculate Entire Queue')}
              title={t('studio.masterOutput.queuePrecalcButton', 'Pre-calculate Entire Queue')}
              onClick={handlePrecalculateQueue}
              disabled={queueCount === 0 || queuePrecalculateStatus?.isRunning}
              className="w-full h-10 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed text-red-100 border border-red-400/30 flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors"
            >
              <Zap size={15} />
              <span>
                {queuePrecalculateStatus?.isRunning
                  ? t('studio.masterOutput.queuePrecalcRunningButton', 'Calculating...')
                  : t('studio.masterOutput.queuePrecalcButton', 'Pre-calculate Entire Queue')}
              </span>
            </button>

            {(queuePrecalculateStatus?.isRunning || totalCount > 0) && (
              <div className="flex flex-col gap-2">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-red-400 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[11px] text-red-200/70 font-mono">
                  {queuePrecalculateStatus?.isRunning
                    ? t('studio.masterOutput.queuePrecalcRunning', {
                      completed: completedCount,
                      failed: failedCount,
                      total: totalCount,
                      cores: cpuCores,
                      defaultValue: 'Rendering {{completed}}/{{total}} on {{cores}} cores. Failed: {{failed}}.'
                    })
                    : t('studio.masterOutput.queuePrecalcDone', {
                      completed: completedCount,
                      failed: failedCount,
                      total: totalCount,
                      defaultValue: 'Ready: {{completed}}/{{total}} rendered. Failed: {{failed}}.'
                    })}
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
