import { CloudUpload } from 'lucide-react';
import { useUploadQueue } from '../context/UploadContext';
import { useTranslation } from 'react-i18next';

export function UploadQueuePanel() {
  const { t } = useTranslation();
  const { uploadTasks, isQueueOpen, setIsQueueOpen, retryTask, clearCompletedTasks } = useUploadQueue();
  
  if (!isQueueOpen || uploadTasks.length === 0) return null;

  return (
    <div className="fixed bottom-28 right-8 w-96 bg-[#1e293b] border border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col z-[100] animate-in slide-in-from-bottom-5">
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
        <h3 className="font-bold text-white flex items-center gap-2">
          <CloudUpload size={18} className="text-blue-400" />
          {t('uploadQueue.title', 'Upload Queue')}
        </h3>
        <div className="flex items-center gap-3">
          <button onClick={clearCompletedTasks} className="text-xs text-white/40 hover:text-white transition-colors">{t('uploadQueue.clearDone', 'Clear Done')}</button>
          <button onClick={() => setIsQueueOpen(false)} className="text-white/40 hover:text-white transition-colors">✕</button>
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
                {task.status === 'success' && <span className="text-green-400">{t('uploadQueue.success', 'Success')}</span>}
                {task.status === 'skipped' && <span className="text-yellow-400">{t('uploadQueue.skipped', 'Skipped (Duplicate)')}</span>}
                {task.status === 'error' && <span className="text-red-400">{t('uploadQueue.failed', 'Failed')}</span>}
              </span>
            </div>
            {task.status === 'error' && (
              <button onClick={() => retryTask(task.id)} className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors shrink-0">
                {t('uploadQueue.retry', 'Retry')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
