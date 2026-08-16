import { AlertCircle, CheckCircle2, CloudUpload, RotateCcw, X } from 'lucide-react';
import { useUploadQueue } from '../context/UploadContext';
import { useTranslation } from 'react-i18next';

export function UploadQueuePanel() {
  const { t } = useTranslation();
  const { uploadTasks, isQueueOpen, setIsQueueOpen, retryTask, clearCompletedTasks } = useUploadQueue();

  if (uploadTasks.length === 0) return null;

  const activeCount = uploadTasks.filter(task => task.status === 'pending' || task.status === 'uploading').length;
  const successCount = uploadTasks.filter(task => task.status === 'success' || task.status === 'skipped').length;
  const errorCount = uploadTasks.filter(task => task.status === 'error').length;
  const completedCount = successCount + errorCount;
  const progressPercent = uploadTasks.length > 0 ? Math.round((completedCount / uploadTasks.length) * 100) : 0;
  const directTasks = uploadTasks;

  const renderTask = (task: typeof uploadTasks[number]) => (
    <div key={task.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 transition-colors group">
      <div className="flex flex-col truncate pr-3">
        <span className="text-sm text-white font-medium truncate">{task.file.name}</span>
        <span className="text-xs text-white/40 flex items-center gap-1">
          {task.status === 'pending' && <span className="text-white/40">{t('uploadQueue.waiting', 'Waiting...')}</span>}
          {task.status === 'uploading' && <span className="text-blue-400 flex items-center gap-1"><div className="w-2 h-2 rounded-full border border-blue-400 border-t-transparent animate-spin"/> {t('uploadQueue.uploading', 'Uploading...')}</span>}
          {task.status === 'success' && <span className="text-green-400 flex items-center gap-1"><CheckCircle2 size={13} />{t('uploadQueue.success', 'Success')}</span>}
          {task.status === 'skipped' && <span className="text-yellow-400">{t('uploadQueue.skipped', 'Skipped (Duplicate)')}</span>}
          {task.status === 'error' && <span className="text-red-400 flex items-center gap-1"><AlertCircle size={13} />{t('uploadQueue.failed', 'Failed')}</span>}
        </span>
      </div>
      {task.status === 'error' && (
        <button onClick={() => retryTask(task.id)} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors shrink-0 flex items-center gap-1">
          <RotateCcw size={12} />
          {t('uploadQueue.retry', 'Retry')}
        </button>
      )}
    </div>
  );

  const renderSection = (_title: string, tasks: typeof uploadTasks) => {
    if (tasks.length === 0) return null;

    return (
      <div className="flex flex-col gap-1">
        {tasks.map(renderTask)}
      </div>
    );
  };

  if (!isQueueOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsQueueOpen(true)}
        className={`fixed bottom-28 right-4 md:right-8 z-[100] flex h-14 w-14 items-center justify-center rounded-2xl border shadow-2xl backdrop-blur-2xl transition hover:scale-105 active:scale-95 ${
          errorCount > 0
            ? 'border-rose-400/40 bg-rose-500/20 text-rose-300'
            : 'border-primary/30 bg-[#0c1626]/95 text-primary shadow-[0_0_20px_rgba(0,245,255,0.2)]'
        }`}
        aria-label={t('uploadQueue.openQueue', 'Open upload queue')}
        title={t('uploadQueue.openQueue', 'Open upload queue')}
      >
        {activeCount > 0 ? (
          <div className="absolute inset-1.5 rounded-xl border-2 border-primary/25 border-t-primary animate-spin" />
        ) : null}
        {errorCount > 0 ? <AlertCircle size={22} /> : <CloudUpload size={22} />}
        <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-slate-950 shadow-md">
          {errorCount > 0 ? errorCount : activeCount || successCount}
        </span>
        <span className="sr-only">{progressPercent}%</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-28 right-4 md:right-8 w-[calc(100vw_-_2rem)] max-w-96 bg-[#0c1626]/95 border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-3xl overflow-hidden flex flex-col z-[100] animate-in slide-in-from-bottom-5 backdrop-blur-2xl">
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/[0.06] bg-white/[0.02]">
        <h3 className="font-bold text-white flex min-w-0 items-center gap-2 font-display text-sm">
          <CloudUpload size={18} className="text-primary" />
          <span className="truncate">{t('uploadQueue.title', 'Upload Queue')}</span>
          <span className="text-xs font-mono font-semibold text-primary">{progressPercent}%</span>
        </h3>
        <div className="flex items-center gap-3">
          <button onClick={clearCompletedTasks} className="text-xs font-mono text-slate-400 hover:text-white transition-colors">{t('uploadQueue.clearDone', 'Clear Done')}</button>
          <button
            type="button"
            onClick={() => setIsQueueOpen(false)}
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-white/[0.08] rounded-lg"
            aria-label={t('uploadQueue.minimize', 'Minimize upload queue')}
            title={t('uploadQueue.minimize', 'Minimize upload queue')}
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto p-3 flex flex-col gap-1.5 no-scrollbar">
        {renderSection(t('uploadQueue.directQueue', 'Direct to Drive'), directTasks)}
      </div>
    </div>
  );
}
