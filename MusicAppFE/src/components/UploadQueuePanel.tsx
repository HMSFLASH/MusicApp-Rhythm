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

  if (!isQueueOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsQueueOpen(true)}
        className={`fixed bottom-28 right-4 md:right-8 z-[100] flex h-14 w-14 items-center justify-center rounded-full border shadow-2xl backdrop-blur-md transition hover:scale-105 ${
          errorCount > 0
            ? 'border-red-400/40 bg-red-500/20 text-red-300'
            : 'border-blue-300/30 bg-[#1e293b]/95 text-blue-300'
        }`}
        aria-label={t('uploadQueue.openQueue', 'Open upload queue')}
        title={t('uploadQueue.openQueue', 'Open upload queue')}
      >
        {activeCount > 0 ? (
          <div className="absolute inset-1 rounded-full border-2 border-blue-300/25 border-t-blue-300 animate-spin" />
        ) : null}
        {errorCount > 0 ? <AlertCircle size={24} /> : <CloudUpload size={24} />}
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-slate-900">
          {errorCount > 0 ? errorCount : activeCount || successCount}
        </span>
        <span className="sr-only">{progressPercent}%</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-28 right-4 md:right-8 w-[calc(100vw-2rem)] max-w-96 bg-[#1e293b] border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col z-[100] animate-in slide-in-from-bottom-5">
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
        <h3 className="font-bold text-white flex min-w-0 items-center gap-2">
          <CloudUpload size={18} className="text-blue-400" />
          <span className="truncate">{t('uploadQueue.title', 'Upload Queue')}</span>
          <span className="text-xs font-medium text-white/40">{progressPercent}%</span>
        </h3>
        <div className="flex items-center gap-3">
          <button onClick={clearCompletedTasks} className="text-xs text-white/40 hover:text-white transition-colors">{t('uploadQueue.clearDone', 'Clear Done')}</button>
          <button
            type="button"
            onClick={() => setIsQueueOpen(false)}
            className="text-white/40 hover:text-white transition-colors"
            aria-label={t('uploadQueue.minimize', 'Minimize upload queue')}
            title={t('uploadQueue.minimize', 'Minimize upload queue')}
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1">
        {uploadTasks.map(task => (
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
        ))}
      </div>
    </div>
  );
}
