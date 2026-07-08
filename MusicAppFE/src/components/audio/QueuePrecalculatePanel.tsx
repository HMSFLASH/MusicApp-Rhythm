import { Cpu, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type QueuePrecalculatePanelProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerState: any;
};

export function QueuePrecalculatePanel({ playerState }: QueuePrecalculatePanelProps) {
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
  );
}
