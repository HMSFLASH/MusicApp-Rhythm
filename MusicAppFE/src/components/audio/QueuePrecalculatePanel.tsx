import { useMemo, useState } from 'react';
import { Cpu, Zap, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getFullCoreCount, getConstrainedWorkerCount } from '../../hooks/audioDevice';
import type { QueuePrecalculateStatus } from '../../hooks/audioPlaybackCache';

type QueuePrecalculatePlayerState = {
  queue?: unknown[];
  queuePrecalculateStatus?: QueuePrecalculateStatus;
  precalculateEntireQueue: (workerCount?: number) => void;
  cancelQueuePrecalculate?: () => void;
};

type QueuePrecalculatePanelProps = {
  playerState: QueuePrecalculatePlayerState;
};

export function QueuePrecalculatePanel({ playerState }: QueuePrecalculatePanelProps) {
  const { t } = useTranslation();
  const queuePrecalculateStatus = playerState.queuePrecalculateStatus;
  const queueCount = playerState.queue?.length ?? 0;
  const totalCores = getFullCoreCount();
  const maxWorkers = Math.max(1, Math.min(totalCores, queueCount || totalCores));
  const recommendedWorkers = Math.max(1, Math.min(getConstrainedWorkerCount(queueCount || totalCores), maxWorkers));
  const [workerInput, setWorkerInput] = useState(String(recommendedWorkers));
  const completedCount = queuePrecalculateStatus?.completed ?? 0;
  const failedCount = queuePrecalculateStatus?.failed ?? 0;
  const totalCount = queuePrecalculateStatus?.total ?? 0;
  const activeWorkers = queuePrecalculateStatus?.cores ?? recommendedWorkers;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round(((completedCount + failedCount) / totalCount) * 100)) : 0;
  const isRunning = queuePrecalculateStatus?.isRunning ?? false;
  const canPrecalculateQueue = queueCount > 0;
  const selectedWorkers = useMemo(() => {
    const parsed = Number.parseInt(workerInput, 10);
    return Number.isFinite(parsed)
      ? Math.max(1, Math.min(parsed, maxWorkers))
      : recommendedWorkers;
  }, [maxWorkers, recommendedWorkers, workerInput]);

  const handlePrecalculateQueue = () => {
    if (!canPrecalculateQueue || isRunning) return;
    playerState.precalculateEntireQueue(selectedWorkers);
  };

  const handleCancel = () => {
    playerState.cancelQueuePrecalculate?.();
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
              workers: recommendedWorkers,
              defaultValue: 'Detected {{cores}} CPU cores. Recommended: {{workers}} workers. Choose fewer workers if playback or the browser starts lagging.'
            })}
          </span>
        </div>
      </div>

      {!isRunning && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-red-300/70 font-mono whitespace-nowrap shrink-0">
            {t('studio.masterOutput.queuePrecalcWorkers', 'Workers:')}
          </label>
          <input
            type="range"
            min={1}
            max={maxWorkers}
            value={selectedWorkers}
            onChange={(e) => setWorkerInput(e.target.value)}
            className="min-w-0 flex-1 accent-red-400"
          />
          <input
            type="number"
            min={1}
            max={maxWorkers}
            value={workerInput}
            onChange={(e) => setWorkerInput(e.target.value)}
            onBlur={() => setWorkerInput(String(selectedWorkers))}
            className="w-14 h-8 rounded-md bg-white/5 border border-red-400/20 text-center text-sm text-red-100 font-mono
              focus:outline-none focus:border-red-400/50 [appearance:textfield]
              [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => setWorkerInput(String(recommendedWorkers))}
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
    </div>
  );
}
