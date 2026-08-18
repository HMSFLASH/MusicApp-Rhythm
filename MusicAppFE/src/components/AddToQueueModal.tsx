import { useState, useEffect } from 'react';
import { X, ListMusic, Plus, Play, Check, Layers, ListEnd, ListPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Track } from '../hooks/audioTypes';
import { useToast } from '../context/ToastContext';
import { loadMultiQueues, saveMultiQueues, addTracksToTargetQueue, MAX_QUEUES, type MultiQueue } from '../utils/multiQueueStorage';

interface AddToQueueModalProps {
  readonly isOpen: boolean;
  readonly tracks: Track[];
  readonly currentPlayingTrackId?: string | null;
  readonly onClose: () => void;
  readonly onQueueUpdated?: (updatedQueueId: string, newTracks: Track[]) => void;
}

export function AddToQueueModal({
  isOpen,
  tracks,
  currentPlayingTrackId,
  onClose,
  onQueueUpdated,
}: AddToQueueModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [queues, setQueues] = useState<MultiQueue[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string>('queue-1');
  const [selectedQueueId, setSelectedQueueId] = useState<string>('queue-1');
  const [insertMode, setInsertMode] = useState<'end' | 'next' | 'replace'>('end');
  const [newQueueName, setNewQueueName] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const data = loadMultiQueues();
      setQueues(data.queues);
      setActiveQueueId(data.activeQueueId);
      setSelectedQueueId(data.activeQueueId);
      setIsCreatingNew(false);
      setNewQueueName('');
    }
  }, [isOpen]);

  if (!isOpen || tracks.length === 0) return null;

  const handleCreateNewQueue = () => {
    if (queues.length >= MAX_QUEUES) {
      toast.info(t('modals.addToQueue.maxQueuesReached', 'Reached maximum of {{max}} queues.', { max: MAX_QUEUES }));
      return;
    }
    const name = newQueueName.trim() || t('queue.queueName', 'Queue {{index}}', { index: queues.length + 1 });
    const newQueue: MultiQueue = {
      id: `queue-${Date.now()}`,
      name,
      tracks: [...tracks],
      currentTrackId: null,
      createdAt: Date.now(),
    };
    const updated = [...queues, newQueue];
    saveMultiQueues(updated, activeQueueId);
    setQueues(updated);
    toast.success(t('modals.addToQueue.createSuccess', 'Created queue "{{name}}" and added {{count}} tracks!', { name, count: tracks.length }));
    if (onQueueUpdated) {
      onQueueUpdated(newQueue.id, newQueue.tracks);
    }
    onClose();
  };

  const handleApplyToQueue = () => {
    const result = addTracksToTargetQueue(selectedQueueId, tracks, insertMode, currentPlayingTrackId);
    const updatedQueue = result.queues.find((q) => q.id === selectedQueueId);
    const targetName = updatedQueue?.name || t('queue.queueDefault', 'Queue');

    const modeText =
      insertMode === 'replace'
        ? t('modals.addToQueue.modeReplaced', 'replaced entire')
        : insertMode === 'next'
        ? t('modals.addToQueue.modePlayNext', 'will play next in')
        : t('modals.addToQueue.modeAddedEnd', 'added to end of');

    toast.success(t('modals.addToQueue.applySuccess', 'Added {{count}} tracks ({{mode}} "{{name}}")!', { count: tracks.length, mode: modeText, name: targetName }));

    if (onQueueUpdated && updatedQueue) {
      onQueueUpdated(selectedQueueId, updatedQueue.tracks);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="bg-[#0c1626]/98 border border-white/[0.12] rounded-3xl w-full max-w-md overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-200 backdrop-blur-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold font-display text-white tracking-tight leading-none">
                {t('modals.addToQueue.title', 'Add to Multi-Queue')}
              </h2>
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                {t('modals.addToQueue.subtitle', '{{count}} tracks selected • Max {{max}} queues', { count: tracks.length, max: MAX_QUEUES })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/[0.08] p-2 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto no-scrollbar flex-1 flex flex-col gap-4">
          {/* Insertion Mode */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('modals.addToQueue.insertMode', 'Insert Position')}</span>
            <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setInsertMode('end')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  insertMode === 'end'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListEnd size={13} />
                {t('modals.addToQueue.modeEnd', 'At End')}
              </button>
              <button
                type="button"
                onClick={() => setInsertMode('next')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  insertMode === 'next'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Play size={12} fill="currentColor" />
                {t('modals.addToQueue.modePlayNextLabel', 'Play Next')}
              </button>
              <button
                type="button"
                onClick={() => setInsertMode('replace')}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  insertMode === 'replace'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListPlus size={13} />
                {t('modals.addToQueue.modeReplaceLabel', 'Replace')}
              </button>
            </div>
          </div>

          {/* Queue Selection */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {t('modals.addToQueue.selectTargetQueue', 'Select Target Queue ({{count}}/{{max}})', { count: queues.length, max: MAX_QUEUES })}
              </span>
              {queues.length < MAX_QUEUES && !isCreatingNew && (
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                >
                  <Plus size={13} />
                  {t('modals.addToQueue.createNewQueue', 'New Queue')}
                </button>
              )}
            </div>

            {/* Create New Form */}
            {isCreatingNew && (
              <div className="bg-white/[0.04] border border-cyan-500/30 p-3 rounded-2xl flex flex-col gap-2.5 animate-in fade-in duration-150">
                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Plus size={14} /> {t('modals.addToQueue.nameNewQueue', 'Name New Queue')}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newQueueName}
                    onChange={(e) => setNewQueueName(e.target.value)}
                    placeholder={t('modals.addToQueue.queueNamePlaceholder', 'e.g. Workout Music, Chill...')}
                    className="flex-1 bg-black/50 border border-white/[0.1] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleCreateNewQueue}
                    className="px-3.5 py-2 bg-cyan-500 text-black font-bold text-xs rounded-xl hover:bg-cyan-400 transition-colors"
                  >
                    {t('modals.addToQueue.createAndAdd', 'Create & Add')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.08]"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Existing Queues List */}
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto no-scrollbar pr-1">
              {queues.map((q) => {
                const isSelected = selectedQueueId === q.id;
                const isCurrentActive = activeQueueId === q.id;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setSelectedQueueId(q.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-cyan-500/15 border-cyan-500/50 shadow-[0_0_15px_rgba(0,245,255,0.15)] text-white'
                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCurrentActive ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,245,255,0.4)]' : 'bg-black/50 text-slate-400 border border-white/[0.08]'
                        }`}
                      >
                        <ListMusic size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold truncate block">{q.name}</span>
                          {isCurrentActive && (
                            <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/20 px-1.5 py-0.2 rounded border border-cyan-500/30">
                              {t('queue.nowPlayingBadge', 'Now Playing')}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block font-mono mt-0.5">
                          {t('queue.trackCount', '{{count}} tracks', { count: q.tracks.length })}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-black">
                          <Check size={13} strokeWidth={3} />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-white/[0.2]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.1] rounded-xl text-xs font-semibold transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleApplyToQueue}
            className="flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(0,245,255,0.3)] hover:scale-105"
          >
            <Check size={16} />
            {t('modals.addToQueue.confirmAdd', 'Confirm Add')}
          </button>
        </div>
      </div>
    </div>
  );
}
