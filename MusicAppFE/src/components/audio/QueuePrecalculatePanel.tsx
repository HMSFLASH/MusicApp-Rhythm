import { useState } from 'react';
import { Cpu, Zap, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getFullCoreCount, getConstrainedWorkerCount } from '../../hooks/audioDevice';

type QueuePrecalculatePanelProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playerState: any;
};

export function QueuePrecalculatePanel({ playerState }: QueuePrecalculatePanelProps) {
  const { t } = useTranslation();
  const queuePrecalculateStatus = playerState.queuePrecalculateStatus;
  const queueCount = playerState.queue?.length ?? 0;
  const totalCores = getFullCoreCount();
  const defaultWorkers = getConstrainedWorkerCount(queueCount || totalCores);
  const [workerInput, setWorkerInput] = useState<string>(String(defaultWorkers));
  const completedCount = queuePrecalculateStatus?.completed ?? 0;
  const failedCount = queuePrecalculateStatus?.failed ?? 0;
  const totalCount = queuePrecalculateStatus?.total ?? 0;
  const activeCores = queuePrecalculateStatus?.cores ?? defaultWorkers;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round(((completedCount + failedCount) / totalCount) * 100)) : 0;
  const isRunning = queuePrecalculateStatus?.isRunning ?? false;

  const handlePrecalculateQueue = () => {
    if (queueCount === 0 || isRunning) return;

    const parsedWorkers = parseInt(workerInput, 10);
    const effectiveWorkers = Number.isFinite(parsedWorkers) && parsedWorkers > 0
      ? Math.min(parsedWorkers, queueCount)
      : undefined;

    playerState.precalculateEntireQueue(effectiveWorkers);
  };

  const handleCancel = () => {
    playerState.cancelQueuePrecalculate?.();
  };

  const handleAllCores = () => {
    setWorkerInput(String(totalCores));
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
              cores: totalCores,
              defaultValue: 'Total CPU cores detected: {{cores}}. Choose how many to use below.'
            })}
          </span>
        </div>
      </div>

      {/* Worker count controls */}
      {!isRunning && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-red-300/70 font-mono whitespace-nowrap shrink-0">
            {t('studio.masterOutput.queuePrecalcWorkers', 'Workers:')}
          </label>
          <input
            type="number"
            min={1}
            max={Math.max(totalCores, queueCount)}
            value={workerInput}
            onChange={(e) => setWorkerInput(e.target.value)}
            disabled={isRunning}
            className="w-16 h-8 rounded-md bg-white/5 border border-red-400/20 text-center text-sm text-red-100 font-mono
              focus:outline-none focus:border-red-400/50 disabled:opacity-40 [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={handleAllCores}
            disabled={isRunning}
            className="h-8 px-3 rounded-md bg-red-500/15 hover:bg-red-500/25 border border-red-400/20
              text-xs text-red-200 font-bold uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {t('studio.masterOutput.queuePrecalcAllCores', { cores: totalCores, defaultValue: 'All {{cores}} Cores' })}
          </button>
        </div>
      )}

      {/* Start / Cancel buttons */}
      {isRunning ? (
        <button
          aria-label={t('studio.masterOutput.queuePrecalcCancelButton', 'Cancel')}
          title={t('studio.masterOutput.queuePrecalcCancelButton', 'Cancel')}
          onClick={handleCancel}
          className="w-full h-10 rounded-lg bg-red-600/30 hover:bg-red-600/45 text-red-100 border border-red-400/40
            flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors"
        >
          <XCircle size={15} />
          <span>{t('studio.masterOutput.queuePrecalcCancelButton', 'Cancel')}</span>
        </button>
      ) : (
        <button
          aria-label={t('studio.masterOutput.queuePrecalcButton', 'Pre-calculate Entire Queue')}
          title={t('studio.masterOutput.queuePrecalcButton', 'Pre-calculate Entire Queue')}
          onClick={handlePrecalculateQueue}
          disabled={queueCount === 0}
          className="w-full h-10 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:bg-white/5
            disabled:text-white/30 disabled:cursor-not-allowed text-red-100 border border-red-400/30
            flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors"
        >
          <Zap size={15} />
          <span>{t('studio.masterOutput.queuePrecalcButton', 'Pre-calculate Entire Queue')}</span>
        </button>
      )}

      {/* Progress bar */}
      {(isRunning || totalCount > 0) && (
        <div className="flex flex-col gap-2">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-red-400 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[11px] text-red-200/70 font-mono">
            {isRunning
              ? t('studio.masterOutput.queuePrecalcRunning', {
                completed: completedCount,
                failed: failedCount,
                total: totalCount,
                cores: activeCores,
                defaultValue: 'Rendering {{completed}}/{{total}} on {{cores}} workers. Failed: {{failed}}.'
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
