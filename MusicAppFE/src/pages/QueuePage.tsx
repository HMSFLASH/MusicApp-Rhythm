import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import {
  Play,
  Trash2,
  GripVertical,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  ListPlus,
  Heart,
  Info,
  X,
  ChevronsUp,
  ChevronsDown,
  CheckSquare,
  Square,
  Download,
  Plus,
  Edit2,
  Copy,
  FolderPlus,
  Layers,
} from 'lucide-react';
import type { Track } from '../hooks/useAudioPlayer';
import { useVirtualList } from '../hooks/useVirtualList';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { ActionMenu } from '../components/ActionMenu';
import { useAuth } from '../context/AuthContext';
import { downloadTrackFile } from '../utils/downloadUtils';
import { TrackInfoModal } from '../components/TrackInfoModal';
import { AddToQueueModal } from '../components/AddToQueueModal';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  loadMultiQueues,
  saveMultiQueues,
  MAX_QUEUES,
  type MultiQueue,
} from '../utils/multiQueueStorage';

const QUEUE_ITEM_HEIGHT = 84;

const getDisplayTitle = (track: Track, metadata?: Partial<Track>) => {
  if (track.title) return track.title;
  if (metadata?.title) return metadata.title;
  if (!track.fileName) return 'Unknown Title';
  const cleanName = track.fileName.replace(/\.[^/.]+$/, '');
  if (cleanName.includes(' - ')) return cleanName.split(' - ')[1];
  return cleanName;
};

const getDisplayArtist = (track: Track, metadata?: Partial<Track>) => {
  if (track.artist) return track.artist;
  if (metadata?.artist) return metadata.artist;
  if (track.fileName?.includes(' - ')) return track.fileName.split(' - ')[0];
  return 'Unknown Artist';
};

export function QueuePage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { playerState } = useGlobalAudio();
  const { queue, setQueue, currentTrack, isPlaying, playTrack, togglePlay } = playerState;
  const { favorites, toggleFavorite } = useLibrary();
  const { isAuthenticated } = useAuth();

  // Multi-Queue State (Musicolet 20 Queues Engine)
  const [multiQueues, setMultiQueues] = useState<MultiQueue[]>(() => {
    const data = loadMultiQueues(queue);
    return data.queues;
  });
  const [activeQueueId, setActiveQueueId] = useState<string>(() => {
    const data = loadMultiQueues(queue);
    return data.activeQueueId;
  });
  const [selectedQueueId, setSelectedQueueId] = useState<string>(() => {
    const data = loadMultiQueues(queue);
    return data.activeQueueId;
  });

  const [editingQueueName, setEditingQueueName] = useState(false);
  const [tempQueueName, setTempQueueName] = useState('');
  const [targetMoveTracks, setTargetMoveTracks] = useState<Track[] | null>(null);

  const effectiveMultiQueues = useMemo(() => {
    let changed = false;
    const next = multiQueues.map((q) => {
      if (q.id === activeQueueId && q.tracks !== queue) {
        changed = true;
        return { ...q, tracks: queue };
      }
      return q;
    });
    return changed ? next : multiQueues;
  }, [multiQueues, activeQueueId, queue]);

  // Persist current playing queue changes with multiQueues in storage
  useEffect(() => {
    if (effectiveMultiQueues !== multiQueues) {
      saveMultiQueues(effectiveMultiQueues, activeQueueId);
    }
  }, [effectiveMultiQueues, multiQueues, activeQueueId]);

  const viewingQueue = useMemo(() => {
    return effectiveMultiQueues.find((q) => q.id === selectedQueueId) || effectiveMultiQueues[0] || {
      id: 'queue-1',
      name: t('queue.defaultName', 'Queue 1 (Main)', { index: 1 }),
      tracks: queue,
      createdAt: 0,
    };
  }, [effectiveMultiQueues, selectedQueueId, queue, t]);

  const displayTracks = viewingQueue.tracks;
  const isViewingActivePlayingQueue = selectedQueueId === activeQueueId;

  const currentTrackIndex = useMemo(() => {
    if (!currentTrack || !isViewingActivePlayingQueue) return -1;
    return displayTracks.findIndex((track) => String(track.id) === String(currentTrack.id));
  }, [currentTrack, isViewingActivePlayingQueue, displayTracks]);

  const favoriteIds = useMemo(() => new Set(favorites.map((track) => String(track.id))), [favorites]);

  const {
    containerRef,
    handleScroll,
    offsetY,
    scrollToIndex,
    totalHeight,
    visibleIndexes,
  } = useVirtualList({
    itemCount: displayTracks.length,
    itemHeight: QUEUE_ITEM_HEIGHT,
  });

  useEffect(() => {
    if (currentTrackIndex >= 0 && isViewingActivePlayingQueue) {
      requestAnimationFrame(() => scrollToIndex(currentTrackIndex, 'smooth'));
    }
  }, [currentTrackIndex, scrollToIndex, isViewingActivePlayingQueue]);

  // Queue Operations
  const handleCreateNewQueue = () => {
    if (effectiveMultiQueues.length >= MAX_QUEUES) {
      toast.info(t('queue.maxQueuesReached', 'Maximum limit of {{max}} queues reached.', { max: MAX_QUEUES }));
      return;
    }
    const newQueue: MultiQueue = {
      id: `queue-${Date.now()}`,
      name: t('queue.queueName', 'Queue {{index}}', { index: effectiveMultiQueues.length + 1 }),
      tracks: [],
      currentTrackId: null,
      createdAt: Date.now(),
    };
    const updated = [...effectiveMultiQueues, newQueue];
    setMultiQueues(updated);
    setSelectedQueueId(newQueue.id);
    saveMultiQueues(updated, activeQueueId);
    toast.success(t('queue.queueCreated', 'Created "{{name}}"!', { name: newQueue.name }));
  };

  const handleSwitchPlaybackToViewingQueue = (startTrack?: Track) => {
    if (displayTracks.length === 0) {
      toast.info(t('queue.noTracksInQueue', 'This queue has no tracks.'));
      return;
    }
    setActiveQueueId(selectedQueueId);
    setQueue(displayTracks);
    setMultiQueues(effectiveMultiQueues);
    saveMultiQueues(effectiveMultiQueues, selectedQueueId);

    const trackToPlay = startTrack || displayTracks[0];
    playTrack(trackToPlay, displayTracks, true);
    toast.success(t('queue.playingQueue', 'Now playing "{{name}}"', { name: viewingQueue.name }));
  };

  const handleUpdateViewingTracks = (newTracks: Track[]) => {
    const updated = effectiveMultiQueues.map((q) =>
      q.id === selectedQueueId ? { ...q, tracks: newTracks } : q
    );
    setMultiQueues(updated);
    saveMultiQueues(updated, activeQueueId);
    if (isViewingActivePlayingQueue) {
      setQueue(newTracks);
    }
  };

  const handleRenameQueue = () => {
    if (!tempQueueName.trim()) {
      setEditingQueueName(false);
      return;
    }
    const updated = effectiveMultiQueues.map((q) =>
      q.id === selectedQueueId ? { ...q, name: tempQueueName.trim() } : q
    );
    setMultiQueues(updated);
    saveMultiQueues(updated, activeQueueId);
    setEditingQueueName(false);
    toast.success(t('queue.queueRenamed', 'Queue renamed successfully!'));
  };

  const handleCloneQueue = () => {
    if (effectiveMultiQueues.length >= MAX_QUEUES) {
      toast.info(t('queue.maxQueuesReached', 'Maximum limit of {{max}} queues reached.', { max: MAX_QUEUES }));
      return;
    }
    const newQueue: MultiQueue = {
      id: `queue-${Date.now()}`,
      name: `${viewingQueue.name} ${t('queue.cloneSuffix', '(Copy)')}`,
      tracks: [...viewingQueue.tracks],
      currentTrackId: null,
      createdAt: Date.now(),
    };
    const updated = [...effectiveMultiQueues, newQueue];
    setMultiQueues(updated);
    setSelectedQueueId(newQueue.id);
    saveMultiQueues(updated, activeQueueId);
    toast.success(t('queue.clonedQueue', 'Cloned as "{{name}}"!', { name: newQueue.name }));
  };

  const handleClearViewingQueue = async () => {
    const ok = await confirm({
      title: t('queue.clearConfirmTitle', 'Clear Queue'),
      description: t('queue.clearConfirmDesc', 'Are you sure you want to clear all {{count}} tracks in "{{name}}"?', {
        count: displayTracks.length,
        name: viewingQueue.name,
      }),
      confirmText: t('queue.clearConfirmBtn', 'Clear'),
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',
    });
    if (!ok) return;

    handleUpdateViewingTracks([]);
    toast.info(t('queue.queueCleared', 'Cleared "{{name}}"', { name: viewingQueue.name }));
  };

  const handleDeleteQueue = async () => {
    if (effectiveMultiQueues.length <= 1) {
      toast.info(t('queue.cannotDeleteSingle', 'Cannot delete when only 1 queue remains.'));
      return;
    }
    const ok = await confirm({
      title: t('queue.deleteConfirmTitle', 'Delete Queue'),
      description: t('queue.deleteConfirmDesc', 'Are you sure you want to delete "{{name}}"?', {
        name: viewingQueue.name,
      }),
      confirmText: t('queue.deleteConfirmBtn', 'Delete Queue'),
      confirmColor: 'bg-red-600 text-white hover:bg-red-700 border-red-600',
    });
    if (!ok) return;

    const remaining = effectiveMultiQueues.filter((q) => q.id !== selectedQueueId);
    const nextActiveId = activeQueueId === selectedQueueId ? remaining[0].id : activeQueueId;
    setMultiQueues(remaining);
    setSelectedQueueId(remaining[0].id);
    setActiveQueueId(nextActiveId);
    saveMultiQueues(remaining, nextActiveId);

    if (activeQueueId === selectedQueueId) {
      setQueue(remaining[0].tracks);
    }
    toast.success(t('queue.queueDeleted', 'Queue deleted!'));
  };

  const handleRemoveTrack = (e: React.MouseEvent, trackId: string | number) => {
    e.stopPropagation();
    handleUpdateViewingTracks(displayTracks.filter((t) => String(t.id) !== String(trackId)));
  };

  const handlePlayTrack = (track: Track) => {
    if (isViewingActivePlayingQueue) {
      if (currentTrack?.id === track.id) {
        togglePlay();
      } else {
        playTrack(track, displayTracks, true);
      }
    } else {
      handleSwitchPlaybackToViewingQueue(track);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [infoTrack, setInfoTrack] = useState<Track | null>(null);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [tracksToPlaylist, setTracksToPlaylist] = useState<Track[] | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  const toggleSelection = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isLongPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setSelectedIndexes((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 400);
  };

  const handlePointerUpOrLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTrackClick = (track: Track, index: number, e: React.MouseEvent) => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }

    if (selectedIndexes.size > 0) {
      toggleSelection(index, e);
      return;
    }

    setOpenMenuIndex(null);
    handlePlayTrack(track);
  };

  const handleBatchRemove = () => {
    handleUpdateViewingTracks(displayTracks.filter((_, idx) => !selectedIndexes.has(idx)));
    setSelectedIndexes(new Set());
  };

  const handleBatchAddToFavorites = async () => {
    const selectedTracks = Array.from(selectedIndexes)
      .map((idx) => displayTracks[idx])
      .filter(Boolean);
    try {
      await Promise.all(
        selectedTracks.map((t) => {
          const isFav = favoriteIds.has(String(t.id));
          if (!isFav) {
            return toggleFavorite(t);
          }
          return Promise.resolve();
        })
      );
      setSelectedIndexes(new Set());
      toast.success(t('queue.batchAddedFavorites', 'Added {{count}} tracks to Favorites!', { count: selectedTracks.length }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFavorite = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await toggleFavorite(track);
      setOpenMenuIndex(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newQueue = [...displayTracks];
    const draggedItem = newQueue[draggedIndex];
    newQueue.splice(draggedIndex, 1);
    newQueue.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    handleUpdateViewingTracks(newQueue);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const moveTrack = (e: React.MouseEvent, index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    e.stopPropagation();
    setOpenMenuIndex(null);
    if (direction === 'up' && index > 0) {
      const newQueue = [...displayTracks];
      [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
      handleUpdateViewingTracks(newQueue);
    } else if (direction === 'down' && index < displayTracks.length - 1) {
      const newQueue = [...displayTracks];
      [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
      handleUpdateViewingTracks(newQueue);
    } else if (direction === 'top' && index > 0) {
      const newQueue = [...displayTracks];
      const item = newQueue.splice(index, 1)[0];
      newQueue.unshift(item);
      handleUpdateViewingTracks(newQueue);
    } else if (direction === 'bottom' && index < displayTracks.length - 1) {
      const newQueue = [...displayTracks];
      const item = newQueue.splice(index, 1)[0];
      newQueue.push(item);
      handleUpdateViewingTracks(newQueue);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-7xl 2xl:max-w-none mx-auto pb-28 md:pb-32">
      {/* Musicolet Multi-Queue Header & Tabs */}
      <div className="mb-4 border-b border-white/[0.06] pb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                  {t('queue.title', 'Multi-Queue')}
                </h1>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  {effectiveMultiQueues.length}/{MAX_QUEUES}
                </span>
              </div>
              <p className="text-slate-400 text-xs font-mono mt-0.5">
                {t('queue.subtitle', 'Manage up to {{max}} independent playback queues', { max: MAX_QUEUES })}
              </p>
            </div>
          </div>

          {/* Quick Create Queue Button */}
          {effectiveMultiQueues.length < MAX_QUEUES && (
            <button
              onClick={handleCreateNewQueue}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all hover:scale-105 shadow-[0_0_15px_rgba(0,245,255,0.15)]"
            >
              <Plus size={15} />
              {t('queue.createNewQueue', 'New Queue')}
            </button>
          )}
        </div>

        {/* Multi-Queue Tab Bar (Horizontal Scrollable) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {effectiveMultiQueues.map((q, idx) => {
            const isSelected = selectedQueueId === q.id;
            const isPlayingThis = activeQueueId === q.id;

            return (
              <button
                key={q.id}
                onClick={() => {
                  setSelectedQueueId(q.id);
                  setEditingQueueName(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-semibold whitespace-nowrap transition-all select-none ${isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_20px_rgba(0,245,255,0.25)] scale-[1.02]'
                  : 'bg-white/[0.03] hover:bg-white/[0.07] text-slate-400 hover:text-slate-200 border-white/[0.06]'
                  }`}
              >
                {isPlayingThis && (
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.9)]" />
                )}
                <span className="truncate max-w-[140px]">{q.name || t('queue.queueName', 'Queue {{index}}', { index: idx + 1 })}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-black/40 text-cyan-300' : 'bg-white/[0.06] text-slate-500'
                    }`}
                >
                  {q.tracks.length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Viewing Queue Subheader & Tools */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          {editingQueueName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempQueueName}
                onChange={(e) => setTempQueueName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameQueue()}
                className="bg-black/50 border border-cyan-500/50 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleRenameQueue}
                className="px-3 py-1.5 bg-cyan-500 text-black text-xs font-bold rounded-xl"
              >
                {t('queue.save', 'Save')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-base font-bold text-white tracking-tight truncate">
                {viewingQueue.name}
              </h2>
              <button
                onClick={() => {
                  setTempQueueName(viewingQueue.name);
                  setEditingQueueName(true);
                }}
                className="p-1 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-white/[0.06]"
                title={t('queue.rename', 'Rename queue')}
              >
                <Edit2 size={13} />
              </button>
              {isViewingActivePlayingQueue ? (
                <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                  {t('queue.nowPlayingBadge', 'Now Playing')}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-md">
                  {t('queue.viewModeBadge', 'Viewing')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isViewingActivePlayingQueue && displayTracks.length > 0 && (
            <button
              onClick={() => handleSwitchPlaybackToViewingQueue()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-black rounded-xl text-xs font-bold hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(0,245,255,0.3)] hover:scale-105"
            >
              <Play size={13} fill="currentColor" />
              {t('queue.playThisQueue', 'Play This Queue')}
            </button>
          )}

          <button
            onClick={handleCloneQueue}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] rounded-xl text-xs font-medium transition-colors"
            title={t('queue.cloneTitle', 'Clone this queue')}
          >
            <Copy size={13} />
            <span className="hidden sm:inline">{t('queue.cloneQueue', 'Clone')}</span>
          </button>

          {displayTracks.length > 0 && (
            <button
              onClick={() => setTracksToPlaylist(displayTracks)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] rounded-xl text-xs font-medium transition-colors"
              title={t('queue.saveAsPlaylistTitle', 'Save all tracks in this queue as a new Playlist')}
            >
              <FolderPlus size={13} />
              <span className="hidden sm:inline">{t('queue.saveAsPlaylist', 'Save as Playlist')}</span>
            </button>
          )}

          {displayTracks.length > 0 && (
            <button
              onClick={handleClearViewingQueue}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-red-500/15 text-slate-400 hover:text-red-400 border border-white/[0.08] rounded-xl text-xs font-medium transition-colors"
              title={t('queue.clearQueueTitle', 'Clear all tracks in queue')}
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">{t('queue.clearQueue', 'Clear')}</span>
            </button>
          )}

          {effectiveMultiQueues.length > 1 && (
            <button
              onClick={handleDeleteQueue}
              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-medium transition-colors"
              title={t('queue.deleteQueueTitle', 'Delete this queue')}
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <AddToPlaylistModal
        isOpen={!!tracksToPlaylist}
        onClose={() => setTracksToPlaylist(null)}
        isAuthenticated={isAuthenticated}
        track={null}
        tracks={tracksToPlaylist || undefined}
      />

      <AddToQueueModal
        isOpen={!!targetMoveTracks}
        tracks={targetMoveTracks || []}
        currentPlayingTrackId={currentTrack?.id ? String(currentTrack.id) : null}
        onClose={() => setTargetMoveTracks(null)}
        onQueueUpdated={() => {
          const fresh = loadMultiQueues();
          setMultiQueues(fresh.queues);
        }}
      />

      {/* Batch Actions Bar */}
      {selectedIndexes.size > 0 && (
        <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-y-2 gap-x-3 bg-[#0c1626]/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-3 shadow-2xl mx-2 sm:mx-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-cyan-400 text-xs font-bold whitespace-nowrap">
              {t('queue.selectedCount', '{{count}} tracks selected', { count: selectedIndexes.size })}
            </span>
            <button
              onClick={() => setSelectedIndexes(new Set())}
              className="text-slate-400 hover:text-white transition-colors shrink-0 p-1"
              title={t('queue.deselect', 'Deselect')}
            >
              <X size={16} />
            </button>
            <button
              onClick={() => {
                if (selectedIndexes.size === displayTracks.length && displayTracks.length > 0) {
                  setSelectedIndexes(new Set());
                } else {
                  setSelectedIndexes(new Set(Array.from({ length: displayTracks.length }, (_, i) => i)));
                }
              }}
              className="p-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 px-2.5 text-xs ml-1 shrink-0 whitespace-nowrap"
            >
              {selectedIndexes.size === displayTracks.length && displayTracks.length > 0 ? (
                <CheckSquare size={14} className="text-cyan-400" />
              ) : (
                <Square size={14} />
              )}
              <span className="hidden md:inline">{t('queue.selectAll', 'Select All')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ActionMenu
              ariaLabel={t('queue.batchActions', 'Batch Actions')}
              buttonClassName="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
              actions={[
                {
                  label: t('queue.addToOtherQueue', 'Add to Another Queue...'),
                  icon: <Layers size={16} />,
                  onSelect: () =>
                    setTargetMoveTracks(
                      Array.from(selectedIndexes)
                        .map((idx) => displayTracks[idx])
                        .filter(Boolean)
                    ),
                },
                {
                  label: t('queue.addToPlaylist', 'Add to Playlist'),
                  icon: <ListPlus size={16} />,
                  onSelect: () =>
                    setTracksToPlaylist(
                      Array.from(selectedIndexes)
                        .map((idx) => displayTracks[idx])
                        .filter(Boolean)
                    ),
                },
                {
                  label: t('queue.addToFavorites', 'Add to Favorites'),
                  icon: <Heart size={16} />,
                  onSelect: handleBatchAddToFavorites,
                },
                {
                  label: t('queue.removeFromQueue', 'Remove from Queue'),
                  icon: <Trash2 size={16} />,
                  onSelect: handleBatchRemove,
                  tone: 'danger',
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Main Tracks List */}
      <div
        ref={containerRef}
        id="queue-page-container"
        className="flex-1 overflow-y-auto relative no-scrollbar"
        onScroll={handleScroll}
      >
        {displayTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 font-mono text-sm gap-2">
            <Layers size={40} className="opacity-30 text-cyan-400" />
            <p>{t('queue.emptyQueueTitle', 'Queue "{{name}}" is empty', { name: viewingQueue.name })}</p>
            <p className="text-xs text-slate-600">{t('queue.emptyQueueDesc', 'Add tracks from Library, Album, or create a new queue.')}</p>
          </div>
        ) : (
          <div className="relative" style={{ height: totalHeight }}>
            <div className="absolute inset-x-0 top-0" style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleIndexes.map((index) => {
                const track = displayTracks[index];
                if (!track) return null;
                const isCurrent = isViewingActivePlayingQueue && currentTrack?.id === track.id;
                const isFavorite = favoriteIds.has(String(track.id));

                return (
                  <div
                    key={`${track.id}-${index}`}
                    className={`relative ${openMenuIndex === index ? 'z-40' : 'z-0'}`}
                    style={{ height: QUEUE_ITEM_HEIGHT }}
                  >
                    <div
                      id={isCurrent ? 'queue-current-track' : undefined}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onPointerDown={(e) => handlePointerDown(index, e)}
                      onPointerUp={handlePointerUpOrLeave}
                      onPointerCancel={handlePointerUpOrLeave}
                      onMouseLeave={() => {
                        setOpenMenuIndex(null);
                        handlePointerUpOrLeave();
                      }}
                      onContextMenu={(e) => {
                        if (isLongPressTriggered.current || ('ontouchstart' in window && selectedIndexes.size > 0)) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => handleTrackClick(track, index, e)}
                      className={`group flex h-[76px] items-center gap-3 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer select-none relative ${openMenuIndex === index ? 'z-40 ring-1 ring-cyan-400/40' : 'z-0'
                        } ${isCurrent
                          ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-[inset_0_0_15px_rgba(0,245,255,0.15)]'
                          : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-cyan-500/25 backdrop-blur-md'
                        } ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
                    >
                      {selectedIndexes.size > 0 ? (
                        <button
                          onClick={(e) => toggleSelection(index, e)}
                          className="w-5 flex items-center justify-center transition-colors shrink-0"
                        >
                          {selectedIndexes.has(index) ? (
                            <CheckSquare size={17} className="text-cyan-400" />
                          ) : (
                            <Square size={17} className="text-slate-500" />
                          )}
                        </button>
                      ) : (
                        <div className="text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing p-1 hidden sm:block shrink-0">
                          <GripVertical size={16} />
                        </div>
                      )}

                      <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 bg-slate-800 rounded-lg overflow-hidden relative flex items-center justify-center border border-white/10 shadow-sm">
                        {track.imageUrl || playerState.getTrackImage(track.id) ? (
                          <img
                            src={track.imageUrl || playerState.getTrackImage(track.id)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 text-xs font-mono">
                            🎵
                          </div>
                        )}

                        <div
                          className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${isCurrent && isPlaying ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100'
                            }`}
                        >
                          {isCurrent && isPlaying ? (
                            <div className="flex items-end justify-center gap-0.5 h-3">
                              <span className="w-0.5 bg-cyan-400 rounded-full animate-eq-1" />
                              <span className="w-0.5 bg-cyan-400 rounded-full animate-eq-2" />
                              <span className="w-0.5 bg-cyan-400 rounded-full animate-eq-3" />
                            </div>
                          ) : (
                            <Play size={16} fill="currentColor" className="text-cyan-400 ml-0.5" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <span
                          className={`block text-xs sm:text-sm font-semibold truncate ${isCurrent ? 'text-cyan-300' : 'text-slate-100'
                            }`}
                        >
                          {getDisplayTitle(track, playerState.getTrackMetadata(track.id))}
                        </span>
                        <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                          {getDisplayArtist(track, playerState.getTrackMetadata(track.id))}{' '}
                          {track.album ? `• ${track.album}` : ''}
                        </p>
                      </div>

                      <div className="relative flex items-center gap-1.5">
                        <button
                          aria-label={t('queue.moreOptions', 'More options')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuIndex(openMenuIndex === index ? null : index);
                          }}
                          className={`p-1.5 rounded-lg transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 ${openMenuIndex === index
                            ? 'text-cyan-400 bg-cyan-500/10 opacity-100'
                            : 'text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                          <MoreHorizontal size={17} />
                        </button>

                        {openMenuIndex === index && (
                          <div className="absolute right-0 top-full mt-1.5 w-56 max-w-[calc(100vw_-_2rem)] bg-[#0c1626]/98 border border-white/[0.12] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden z-50 py-1.5 backdrop-blur-2xl animate-in zoom-in-95 duration-150">
                            <button
                              disabled={index === 0}
                              onClick={(e) => moveTrack(e, index, 'top')}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronsUp size={14} className="text-cyan-400" /> {t('queue.moveToTop', 'Move to Top')}
                            </button>
                            <button
                              disabled={index === 0}
                              onClick={(e) => moveTrack(e, index, 'up')}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowUp size={14} /> {t('queue.moveUp', 'Move Up')}
                            </button>
                            <button
                              disabled={index === displayTracks.length - 1}
                              onClick={(e) => moveTrack(e, index, 'down')}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ArrowDown size={14} /> {t('queue.moveDown', 'Move Down')}
                            </button>
                            <button
                              disabled={index === displayTracks.length - 1}
                              onClick={(e) => moveTrack(e, index, 'bottom')}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <ChevronsDown size={14} /> {t('queue.moveToBottom', 'Move to Bottom')}
                            </button>

                            <div className="h-px bg-white/[0.06] my-1" />

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTargetMoveTracks([track]);
                                setOpenMenuIndex(null);
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-cyan-300 hover:bg-white/[0.08] transition-colors"
                            >
                              <Layers size={14} /> {t('queue.addToOtherQueue', 'Add to Another Queue...')}
                            </button>

                            {track.sourceType !== 'LOCAL' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadTrackFile(track);
                                  setOpenMenuIndex(null);
                                }}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                                title={t('tracks.tooltipDownload', 'Download audio file to device')}
                              >
                                <Download size={14} className="text-slate-400" />{' '}
                                {t('tracks.downloadFile', 'Download File')}
                              </button>
                            )}
                            {track.sourceType !== 'LOCAL' && (
                              <button
                                onClick={(e) => handleToggleFavorite(track, e)}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                              >
                                <Heart
                                  size={14}
                                  fill={isFavorite ? 'currentColor' : 'none'}
                                  className={isFavorite ? 'text-cyan-400' : 'text-slate-400'}
                                />
                                {isFavorite
                                  ? t('tracks.removeFavorite', 'Remove from Favorites')
                                  : t('tracks.addFavorite', 'Add to Favorites')}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInfoTrack(track);
                                setOpenMenuIndex(null);
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-slate-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                            >
                              <Info size={14} className="text-slate-400" /> {t('tracks.info', 'Info')}
                            </button>
                            <div className="h-px bg-white/[0.06] my-1" />
                            <button
                              onClick={(e) => {
                                setOpenMenuIndex(null);
                                handleRemoveTrack(e, track.id);
                              }}
                              className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                            >
                              <Trash2 size={14} /> {t('queue.removeFromThisQueue', 'Remove from This Queue')}
                            </button>
                          </div>
                        )}

                        <button
                          aria-label={t('queue.removeFromQueueAria', 'Remove from queue')}
                          onClick={(e) => handleRemoveTrack(e, track.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hidden sm:block"
                          title={t('queue.removeFromQueueAria', 'Remove from queue')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Info Modal */}
      {infoTrack && (
        <TrackInfoModal
          track={infoTrack}
          trackMetadata={playerState.getTrackMetadata(infoTrack.id)}
          onClose={() => setInfoTrack(null)}
        />
      )}
    </div>
  );
}
