import { useMemo, useState } from 'react';
import { Cpu, Zap, XCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getFullCoreCount, getQueuePrecalculateWorkerSettings } from '../../hooks/audioDevice';
import type { QueuePrecalculateStatus } from '../../hooks/audioPlaybackCache';

type QueuePrecalculatePlayerState = {
  queue?: unknown[];
  queuePrecalculateStatus?: QueuePrecalculateStatus;
  precalculateEntireQueue: (workerCount?: number) => void;
  cancelQueuePrecalculate?: () => void;
  retryFailedQueuePrecalculate?: (workerCount?: number) => void;
};

type QueuePrecalculatePanelProps = {
  playerState: QueuePrecalculatePlayerState;
};

export function QueuePrecalculatePanel({ playerState }: QueuePrecalculatePanelProps) {
  const { t } = useTranslation();
  const queuePrecalculateStatus = playerState.queuePrecalculateStatus;
  const queueCount = playerState.queue?.length ?? 0;
  const totalCores = getFullCoreCount();
  const { recommendedWorkers, maxWorkers, isConstrained } = getQueuePrecalculateWorkerSettings(queueCount);
  const [requestedWorkers, setRequestedWorkers] = useState<number | null>(null);
  const completedCount = queuePrecalculateStatus?.completed ?? 0;
  const failedCount = queuePrecalculateStatus?.failed ?? 0;
  const totalCount = queuePrecalculateStatus?.total ?? 0;
  const activeWorkers = queuePrecalculateStatus?.cores ?? recommendedWorkers;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round(((completedCount + failedCount) / totalCount) * 100)) : 0;
  const isRunning = queuePrecalculateStatus?.isRunning ?? false;
  const canPrecalculateQueue = queueCount > 0;
  const selectedWorkers = useMemo(() => {
    if (maxWorkers === 0) return 0;
    if (requestedWorkers == null) return recommendedWorkers;
    return Math.max(1, Math.min(requestedWorkers, maxWorkers));
  }, [maxWorkers, recommendedWorkers, requestedWorkers]);

  const handlePrecalculateQueue = () => {
    if (!canPrecalculateQueue || maxWorkers === 0 || isRunning) return;
    playerState.precalculateEntireQueue(selectedWorkers);
  };

  const handleCancel = () => {
    playerState.cancelQueuePrecalculate?.();
  };

  const failedTrackIds = queuePrecalculateStatus?.failedTrackIds ?? [];
  const hasFailedTracks = !isRunning && failedTrackIds.length > 0;

  const handleRetryFailed = () => {
    if (!hasFailedTracks) return;
    playerState.retryFailedQueuePrecalculate?.(selectedWorkers);
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
            {!isConstrained
              ? t('studio.masterOutput.queuePrecalcDesc', {
                cores: totalCores,
                workers: recommendedWorkers,
                maxWorkers,
                defaultValue: 'Detected {{cores}} CPU cores. Recommended: {{workers}} workers. Max: {{maxWorkers}} workers.'
              })
              : t('studio.masterOutput.queuePrecalcDescSingleWorker', {
                cores: totalCores,
                defaultValue: 'Detected {{cores}} CPU cores. This device is limited to 1 safe worker to avoid browser lag.'
              })}
          </span>
        </div>
      </div>

      {!isRunning && maxWorkers > 1 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-red-300/70 font-mono whitespace-nowrap shrink-0">
            {t('studio.masterOutput.queuePrecalcWorkers', 'Workers:')}
          </label>
          <input
            type="range"
            min={1}
            max={maxWorkers}
            value={selectedWorkers}
            onChange={(e) => setRequestedWorkers(Number(e.target.value))}
            className="min-w-0 flex-1 accent-red-400"
          />
          <input
            type="number"
            min={1}
            max={maxWorkers}
            value={selectedWorkers}
            onChange={(e) => setRequestedWorkers(Number(e.target.value))}
            className="w-14 h-8 rounded-md bg-white/5 border border-red-400/20 text-center text-sm text-red-100 font-mono
              focus:outline-none focus:border-red-400/50 [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => setRequestedWorkers(null)}
            className="h-8 px-2 rounded-md bg-red-500/15 hover:bg-red-500/25 border border-red-400/20
              text-[11px] text-red-200 font-bold uppercase transition-colors whitespace-nowrap"
          >
            {t('studio.masterOutput.queuePrecalcRecommended', { workers: recommendedWorkers, defaultValue: '{{workers}} rec.' })}
          </button>
        </div>
      )}

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
          disabled={!canPrecalculateQueue}
          className="w-full h-10 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:bg-white/5
            disabled:text-white/30 disabled:cursor-not-allowed text-red-100 border border-red-400/30
            flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors"
        >
          <Zap size={15} />
          <span>
            {t('studio.masterOutput.queuePrecalcButton', 'Pre-calculate Entire Queue')}
          </span>
        </button>
      )}

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
                cores: activeWorkers,
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

      {hasFailedTracks && (
        <button
          aria-label={t('studio.masterOutput.queuePrecalcRetryButton', 'Retry Failed ({{count}})', { count: failedTrackIds.length })}
          title={t('studio.masterOutput.queuePrecalcRetryButton', 'Retry Failed ({{count}})', { count: failedTrackIds.length })}
          onClick={handleRetryFailed}
          className="w-full h-10 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-400/30
            flex items-center justify-center gap-2 text-xs font-bold uppercase transition-colors"
        >
          <RefreshCw size={15} />
          <span>
            {t('studio.masterOutput.queuePrecalcRetryButton', 'Retry Failed ({{count}})', { count: failedTrackIds.length })}
          </span>
        </button>
      )}
    </div>
  );
}
