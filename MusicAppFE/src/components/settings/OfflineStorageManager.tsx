import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HardDrive,
  Trash2,
  RefreshCw,
  Search,
  Music,
  Disc,
  ListMusic,
  Mic2,
  CheckSquare,
  Square,
  Play,
  ArrowUpDown,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useOffline } from '../../context/OfflineContext';
import { useLibrary } from '../../context/LibraryContext';
import { useGlobalAudio } from '../../context/AudioContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { CustomSelect } from '../CustomSelect';
import {
  getAudioCacheSummary,
  getMaxCacheBytes,
  setMaxCacheBytes,
  DEFAULT_MAX_CACHE_BYTES,
  type AudioCacheEntryMeta,
} from '../../utils/mediaCache';
import { getCoversStats } from '../../utils/idb';
import { axiosClient } from '../../api/axiosClient';
import type { Track } from '../../hooks/useAudioPlayer';

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '---';
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type SortField = 'size' | 'title' | 'date' | 'artist';
type ViewMode = 'tracks' | 'albums' | 'playlists' | 'artists';

type CachedTrackItem = {
  id: string;
  bytes: number;
  cachedAt: number;
  lastAccessed: number;
  track?: Track;
  title: string;
  artist: string;
  album: string;
  imageUrl?: string;
  durationSeconds?: number;
};

type PlaylistInfo = {
  id: string;
  name: string;
  trackCount?: number;
  imageUrl?: string;
  tracks?: Track[];
};

const CACHE_LIMIT_OPTIONS = [
  { label: '4 GB', value: 4 * 1024 * 1024 * 1024 },
  { label: '8 GB', value: 8 * 1024 * 1024 * 1024 },
  { label: '12 GB (Mặc định)', value: 12 * 1024 * 1024 * 1024 },
  { label: '16 GB', value: 16 * 1024 * 1024 * 1024 },
  { label: '24 GB', value: 24 * 1024 * 1024 * 1024 },
  { label: '32 GB', value: 32 * 1024 * 1024 * 1024 },
];

export function OfflineStorageManager() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { toast } = useToast();
  const { playerState } = useGlobalAudio();
  const { tracks: libraryTracks } = useLibrary();
  const { removeCachedAudioTrack, removeCachedAudioTracks, clearAllCache } = useOffline();

  const [isLoading, setIsLoading] = useState(true);
  const [audioCacheStats, setAudioCacheStats] = useState<{
    totalBytes: number;
    count: number;
    maxBytes: number;
    entries: AudioCacheEntryMeta[];
  }>({
    totalBytes: 0,
    count: 0,
    maxBytes: DEFAULT_MAX_CACHE_BYTES,
    entries: [],
  });

  const [coversStats, setCoversStats] = useState<{ count: number; totalBytes: number }>({
    count: 0,
    totalBytes: 0,
  });

  const [browserStorage, setBrowserStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [selectedLimit, setSelectedLimit] = useState<number>(getMaxCacheBytes());
  const [playlists, setPlaylists] = useState<PlaylistInfo[]>([]);
  const [playlistTracksMap, setPlaylistTracksMap] = useState<Map<string, string[]>>(new Map());

  // Filters and UI states
  const [viewMode, setViewMode] = useState<ViewMode>('tracks');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('size');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const sortOptions = useMemo(() => [
    { value: 'size' as SortField, label: t('storage.sortSize', 'Dung lượng') },
    { value: 'title' as SortField, label: t('storage.sortTitle', 'Tên bài') },
    { value: 'artist' as SortField, label: t('storage.sortArtist', 'Nghệ sĩ') },
    { value: 'date' as SortField, label: t('storage.sortDate', 'Ngày tải') },
  ], [t]);

  // Load storage statistics
  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cacheSummary, covStats] = await Promise.all([
        getAudioCacheSummary(),
        getCoversStats(),
      ]);
      setAudioCacheStats(cacheSummary);
      setCoversStats(covStats);
      setSelectedLimit(cacheSummary.maxBytes);

      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        setBrowserStorage({
          usage: estimate.usage || 0,
          quota: estimate.quota || 0,
        });
      }

      // Load playlists for playlist group view
      try {
        const pls = (await axiosClient.get('/api/playlists')) as PlaylistInfo[];
        if (Array.isArray(pls)) {
          setPlaylists(pls);
          // Fetch details for each playlist to map cached tracks
          const pMap = new Map<string, string[]>();
          await Promise.all(
            pls.map(async (pl) => {
              try {
                const details = (await axiosClient.get(`/api/playlists/${pl.id}`)) as {
                  tracks?: Array<{ id: string | number }>;
                };
                if (details?.tracks) {
                  pMap.set(pl.id, details.tracks.map((t) => String(t.id)));
                }
              } catch {
                // Ignore single playlist detail error
              }
            })
          );
          setPlaylistTracksMap(pMap);
        }
      } catch {
        // Playlists may not be available if guest/offline
      }
    } catch (e) {
      console.error('Failed to load cache stats:', e);
      toast.error(t('storage.loadError', 'Không thể tải thông tin bộ nhớ đệm'));
    } finally {
      setIsLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  // Handle changing cache limit
  const handleLimitChange = (newLimit: number) => {
    setMaxCacheBytes(newLimit);
    setSelectedLimit(newLimit);
    setAudioCacheStats((prev) => ({ ...prev, maxBytes: newLimit }));
    toast.success(
      t('storage.limitUpdated', 'Đã cập nhật giới hạn bộ nhớ: {{limit}}', {
        limit: formatBytes(newLimit, 0),
      })
    );
  };

  // Map cached entries with track details from library or fallback
  const cachedTrackItems: CachedTrackItem[] = useMemo(() => {
    const trackMap = new Map<string, Track>();
    for (const t of libraryTracks) {
      trackMap.set(String(t.id), t);
      if (t.driveFileId) {
        trackMap.set(`drive:${t.driveFileId}`, t);
      }
    }

    return audioCacheStats.entries.map((entry) => {
      const matchedTrack = trackMap.get(entry.id);
      const title =
        matchedTrack?.title ||
        playerState.getTrackMetadata(matchedTrack?.id || entry.id)?.title ||
        matchedTrack?.fileName?.replace(/\.[^/.]+$/, '') ||
        `Track #${entry.id}`;

      const artist =
        matchedTrack?.artist ||
        playerState.getTrackMetadata(matchedTrack?.id || entry.id)?.artist ||
        (matchedTrack?.fileName?.includes(' - ')
          ? matchedTrack.fileName.split(' - ')[0]
          : t('storage.unknownArtist', 'Chưa rõ nghệ sĩ'));

      const album =
        matchedTrack?.album ||
        playerState.getTrackMetadata(matchedTrack?.id || entry.id)?.album ||
        t('storage.unknownAlbum', 'Album khác');

      const imageUrl =
        matchedTrack?.imageUrl ||
        playerState.getTrackImage(matchedTrack?.id || entry.id) ||
        undefined;

      return {
        id: entry.id,
        bytes: entry.bytes,
        cachedAt: entry.cachedAt,
        lastAccessed: entry.lastAccessed,
        track: matchedTrack,
        title,
        artist,
        album,
        imageUrl,
        durationSeconds: matchedTrack?.durationSeconds,
      };
    });
  }, [audioCacheStats.entries, libraryTracks, playerState, t]);

  // Filter and sort tracks
  const filteredAndSortedTracks = useMemo(() => {
    let result = [...cachedTrackItems];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.artist.toLowerCase().includes(q) ||
          item.album.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'size') {
        comparison = a.bytes - b.bytes;
      } else if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortField === 'artist') {
        comparison = a.artist.localeCompare(b.artist);
      } else if (sortField === 'date') {
        comparison = (a.cachedAt || 0) - (b.cachedAt || 0);
      }
      return sortAsc ? comparison : -comparison;
    });

    return result;
  }, [cachedTrackItems, searchQuery, sortField, sortAsc]);

  // Group by Album
  const albumGroups = useMemo(() => {
    const groups = new Map<string, { album: string; artist: string; items: CachedTrackItem[]; totalBytes: number; coverUrl?: string }>();

    for (const item of cachedTrackItems) {
      const albumKey = item.album || t('storage.unknownAlbum', 'Album khác');
      const existing = groups.get(albumKey);
      if (existing) {
        existing.items.push(item);
        existing.totalBytes += item.bytes;
        if (!existing.coverUrl && item.imageUrl) {
          existing.coverUrl = item.imageUrl;
        }
      } else {
        groups.set(albumKey, {
          album: albumKey,
          artist: item.artist,
          items: [item],
          totalBytes: item.bytes,
          coverUrl: item.imageUrl,
        });
      }
    }

    let list = Array.from(groups.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => g.album.toLowerCase().includes(q) || g.artist.toLowerCase().includes(q));
    }
    list.sort((a, b) => b.totalBytes - a.totalBytes);
    return list;
  }, [cachedTrackItems, searchQuery, t]);

  // Group by Playlist
  const playlistGroups = useMemo(() => {
    const cachedIdSet = new Set(audioCacheStats.entries.map((e) => e.id));
    const cachedItemMap = new Map<string, CachedTrackItem>();
    for (const item of cachedTrackItems) {
      cachedItemMap.set(item.id, item);
      if (item.track?.id) cachedItemMap.set(String(item.track.id), item);
      if (item.track?.driveFileId) cachedItemMap.set(`drive:${item.track.driveFileId}`, item);
    }

    const groups = playlists.map((pl) => {
      const trackIds = playlistTracksMap.get(pl.id) || [];
      const cachedItems: CachedTrackItem[] = [];
      let totalBytes = 0;

      for (const tid of trackIds) {
        if (cachedIdSet.has(tid) || cachedItemMap.has(tid)) {
          const item = cachedItemMap.get(tid);
          if (item) {
            cachedItems.push(item);
            totalBytes += item.bytes;
          }
        }
      }

      return {
        playlist: pl,
        items: cachedItems,
        totalBytes,
        totalPlaylistTracks: trackIds.length,
        cachedCount: cachedItems.length,
      };
    });

    let list = groups.filter((g) => g.cachedCount > 0);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => g.playlist.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => b.totalBytes - a.totalBytes);
    return list;
  }, [audioCacheStats.entries, cachedTrackItems, playlists, playlistTracksMap, searchQuery]);

  // Group by Artist
  const artistGroups = useMemo(() => {
    const groups = new Map<string, { artist: string; items: CachedTrackItem[]; totalBytes: number; coverUrl?: string }>();

    for (const item of cachedTrackItems) {
      const artistKey = item.artist || t('storage.unknownArtist', 'Chưa rõ nghệ sĩ');
      const existing = groups.get(artistKey);
      if (existing) {
        existing.items.push(item);
        existing.totalBytes += item.bytes;
        if (!existing.coverUrl && item.imageUrl) {
          existing.coverUrl = item.imageUrl;
        }
      } else {
        groups.set(artistKey, {
          artist: artistKey,
          items: [item],
          totalBytes: item.bytes,
          coverUrl: item.imageUrl,
        });
      }
    }

    let list = Array.from(groups.values());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((g) => g.artist.toLowerCase().includes(q));
    }
    list.sort((a, b) => b.totalBytes - a.totalBytes);
    return list;
  }, [cachedTrackItems, searchQuery, t]);

  // Selection handlers
  const toggleSelectTrack = (id: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedTrackIds.size === filteredAndSortedTracks.length && filteredAndSortedTracks.length > 0) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(filteredAndSortedTracks.map((t) => t.id)));
    }
  };

  // Actions: Delete single track cache
  const handleDeleteTrack = async (item: CachedTrackItem) => {
    const confirmed = await confirm({
      title: t('storage.deleteTrackTitle', 'Xóa bộ nhớ đệm bài hát'),
      description: t('storage.deleteTrackMsg', 'Bạn có chắc chắn muốn xóa bản lưu offline của "{{title}}" ({{size}})?', {
        title: item.title,
        size: formatBytes(item.bytes),
      }),
      confirmText: t('storage.deleteConfirm', 'Xóa Cache'),
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await removeCachedAudioTrack(item.id);
      if (item.track?.driveFileId) {
        await removeCachedAudioTrack(`drive:${item.track.driveFileId}`);
      }
      toast.success(
        t('storage.trackDeleted', 'Đã xóa bản lưu offline của "{{title}}"', { title: item.title })
      );
      setSelectedTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      await loadStats();
    } catch (e) {
      console.error('Failed to delete track cache', e);
      toast.error(t('storage.deleteError', 'Lỗi khi xóa bộ nhớ đệm'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Actions: Delete selected tracks
  const handleDeleteSelected = async () => {
    if (selectedTrackIds.size === 0) return;

    const selectedItems = cachedTrackItems.filter((item) => selectedTrackIds.has(item.id));
    const totalSelectedBytes = selectedItems.reduce((sum, item) => sum + item.bytes, 0);

    const confirmed = await confirm({
      title: t('storage.deleteSelectedTitle', 'Xóa bộ nhớ đệm đã chọn'),
      description: t(
        'storage.deleteSelectedMsg',
        'Bạn có chắc chắn muốn xóa {{count}} bài hát đã chọn (tổng cộng {{size}}) khỏi bộ nhớ offline?',
        {
          count: selectedTrackIds.size,
          size: formatBytes(totalSelectedBytes),
        }
      ),
      confirmText: t('storage.deleteConfirm', 'Xóa Cache'),
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const idsToDelete: string[] = [];
      for (const item of selectedItems) {
        idsToDelete.push(item.id);
        if (item.track?.driveFileId) {
          idsToDelete.push(`drive:${item.track.driveFileId}`);
        }
      }
      await removeCachedAudioTracks(idsToDelete);
      toast.success(
        t('storage.selectedDeleted', 'Đã xóa {{count}} bài hát ({{size}})', {
          count: selectedTrackIds.size,
          size: formatBytes(totalSelectedBytes),
        })
      );
      setSelectedTrackIds(new Set());
      await loadStats();
    } catch (e) {
      console.error('Failed to delete selected cache', e);
      toast.error(t('storage.deleteError', 'Lỗi khi xóa bộ nhớ đệm'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Actions: Delete Album cache
  const handleDeleteAlbum = async (albumName: string, items: CachedTrackItem[], totalBytes: number) => {
    const confirmed = await confirm({
      title: t('storage.deleteAlbumTitle', 'Xóa Cache Album'),
      description: t(
        'storage.deleteAlbumMsg',
        'Xóa bộ nhớ offline của tất cả {{count}} bài hát trong Album "{{album}}" ({{size}})?',
        {
          count: items.length,
          album: albumName,
          size: formatBytes(totalBytes),
        }
      ),
      confirmText: t('storage.deleteConfirm', 'Xóa Cache'),
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const ids: string[] = [];
      for (const item of items) {
        ids.push(item.id);
        if (item.track?.driveFileId) ids.push(`drive:${item.track.driveFileId}`);
      }
      await removeCachedAudioTracks(ids);
      toast.success(
        t('storage.albumDeleted', 'Đã xóa cache album "{{album}}" ({{size}})', {
          album: albumName,
          size: formatBytes(totalBytes),
        })
      );
      await loadStats();
    } catch (e) {
      console.error('Failed to delete album cache', e);
      toast.error(t('storage.deleteError', 'Lỗi khi xóa bộ nhớ đệm'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Actions: Delete Playlist cache
  const handleDeletePlaylist = async (playlistName: string, items: CachedTrackItem[], totalBytes: number) => {
    const confirmed = await confirm({
      title: t('storage.deletePlaylistTitle', 'Xóa Cache Danh sách phát'),
      description: t(
        'storage.deletePlaylistMsg',
        'Xóa bộ nhớ offline của {{count}} bài hát trong Playlist "{{name}}" ({{size}})?',
        {
          count: items.length,
          name: playlistName,
          size: formatBytes(totalBytes),
        }
      ),
      confirmText: t('storage.deleteConfirm', 'Xóa Cache'),
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const ids: string[] = [];
      for (const item of items) {
        ids.push(item.id);
        if (item.track?.driveFileId) ids.push(`drive:${item.track.driveFileId}`);
      }
      await removeCachedAudioTracks(ids);
      toast.success(
        t('storage.playlistDeleted', 'Đã xóa cache playlist "{{name}}" ({{size}})', {
          name: playlistName,
          size: formatBytes(totalBytes),
        })
      );
      await loadStats();
    } catch (e) {
      console.error('Failed to delete playlist cache', e);
      toast.error(t('storage.deleteError', 'Lỗi khi xóa bộ nhớ đệm'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Actions: Delete Artist cache
  const handleDeleteArtist = async (artistName: string, items: CachedTrackItem[], totalBytes: number) => {
    const confirmed = await confirm({
      title: t('storage.deleteArtistTitle', 'Xóa Cache Nghệ sĩ'),
      description: t(
        'storage.deleteArtistMsg',
        'Xóa bộ nhớ offline của {{count}} bài hát của nghệ sĩ "{{artist}}" ({{size}})?',
        {
          count: items.length,
          artist: artistName,
          size: formatBytes(totalBytes),
        }
      ),
      confirmText: t('storage.deleteConfirm', 'Xóa Cache'),
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const ids: string[] = [];
      for (const item of items) {
        ids.push(item.id);
        if (item.track?.driveFileId) ids.push(`drive:${item.track.driveFileId}`);
      }
      await removeCachedAudioTracks(ids);
      toast.success(
        t('storage.artistDeleted', 'Đã xóa cache nghệ sĩ "{{artist}}" ({{size}})', {
          artist: artistName,
          size: formatBytes(totalBytes),
        })
      );
      await loadStats();
    } catch (e) {
      console.error('Failed to delete artist cache', e);
      toast.error(t('storage.deleteError', 'Lỗi khi xóa bộ nhớ đệm'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Actions: Clear all cache
  const handleClearAll = async () => {
    const confirmed = await confirm({
      title: t('storage.clearAllTitle', 'Xóa toàn bộ Bộ nhớ đệm Offline'),
      description: t(
        'storage.clearAllMsg',
        'Bạn có chắc chắn muốn xóa toàn bộ {{count}} bài hát đã lưu offline ({{size}}) và bộ nhớ ảnh bìa? Bạn sẽ cần kết nối mạng để nghe lại các bài hát này.',
        {
          count: audioCacheStats.count,
          size: formatBytes(audioCacheStats.totalBytes),
        }
      ),
      confirmText: t('storage.clearAllConfirm', 'Xóa tất cả'),
      confirmColor: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30',
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await clearAllCache();
      toast.success(t('storage.allCleared', 'Đã xóa toàn bộ bộ nhớ đệm offline thành công!'));
      setSelectedTrackIds(new Set());
      await loadStats();
    } catch (e) {
      console.error('Failed to clear all cache', e);
      toast.error(t('storage.deleteError', 'Lỗi khi xóa bộ nhớ đệm'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Play track helper
  const handlePlayTrack = (item: CachedTrackItem) => {
    if (item.track) {
      playerState.playTrack(item.track, libraryTracks);
    }
  };

  // Calculate usage percentage
  const usagePercentage = Math.min(
    100,
    Math.max(0, (audioCacheStats.totalBytes / (audioCacheStats.maxBytes || DEFAULT_MAX_CACHE_BYTES)) * 100)
  );

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Storage Hero Card */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#0c192c]/90 via-[#0a1220]/90 to-[#070e1a]/95 border border-primary/25 p-5 md:p-7 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {/* Glow ambient background */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />
        </div>

        {/* Card Header & Actions */}
        <div className="relative z-30 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/[0.08]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-primary/25 to-cyan-500/10 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(0,245,255,0.3)] shrink-0">
              <HardDrive size={22} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg md:text-xl font-bold font-display text-white tracking-tight flex items-center gap-2">
                {t('storage.heroTitle', 'Bộ Nhớ Đệm Offline (Media Cache)')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-mono mt-0.5">
                {t('storage.heroDesc', 'Quản lý bài hát và album đã tải xuống để nghe mượt mà không cần mạng')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {/* Cache Limit Selector */}
            <CustomSelect<number>
              value={selectedLimit}
              options={CACHE_LIMIT_OPTIONS}
              onChange={(val) => handleLimitChange(val)}
              prefixLabel={t('storage.limitLabel', 'Giới hạn:')}
              ariaLabel={t('storage.limitAria', 'Chọn giới hạn bộ nhớ đệm')}
              tone="primary"
              align="right"
            />

            {/* Refresh Button */}
            <button
              onClick={() => void loadStats()}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title={t('storage.refresh', 'Làm mới thống kê')}
              aria-label="Làm mới thống kê bộ nhớ"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin text-primary' : ''} />
            </button>

            {/* Clear All Button */}
            <button
              onClick={handleClearAll}
              disabled={isDeleting || audioCacheStats.count === 0}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 transition-all font-semibold text-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(239,68,68,0.15)] cursor-pointer"
            >
              <Trash2 size={15} />
              <span>{t('storage.clearAll', 'Xóa toàn bộ')}</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Big Usage Text */}
        <div className="relative z-10 my-6">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-2.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl md:text-4xl font-extrabold font-mono text-white tracking-tight">
                {formatBytes(audioCacheStats.totalBytes)}
              </span>
              <span className="text-sm md:text-base font-mono text-slate-400">
                / {formatBytes(audioCacheStats.maxBytes, 0)}
              </span>
              <span className="text-xs md:text-sm font-sans font-semibold text-primary/90 ml-1">
                ({audioCacheStats.count} {t('storage.songsCount', 'bài hát')})
              </span>
            </div>
            <div className="text-xs md:text-sm font-mono font-bold text-slate-300">
              {usagePercentage.toFixed(1)}% {t('storage.usedLabel', 'đã dùng')}
            </div>
          </div>

          {/* Glowing Track Progress */}
          <div className="w-full h-4 md:h-5 rounded-full bg-[#070e1a] border border-white/[0.08] p-0.5 overflow-hidden shadow-inner relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${usagePercentage > 90
                  ? 'bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                  : usagePercentage > 75
                    ? 'bg-gradient-to-r from-amber-500 to-rose-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                    : 'bg-gradient-to-r from-primary via-cyan-400 to-indigo-500 shadow-[0_0_15px_rgba(0,245,255,0.5)]'
                }`}
              style={{ width: `${Math.max(1, usagePercentage)}%` }}
            />
          </div>
        </div>

        {/* Breakdown Metric Chips */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-3.5 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Music size={14} className="text-primary shrink-0" />
              <span className="truncate">{t('storage.audioCache', 'Âm thanh Offline')}</span>
            </div>
            <span className="text-sm sm:text-base font-bold font-mono text-white">
              {formatBytes(audioCacheStats.totalBytes)}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {audioCacheStats.count} {t('storage.tracks', 'bài')}
            </span>
          </div>

          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-3.5 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Disc size={14} className="text-cyan-400 shrink-0" />
              <span className="truncate">{t('storage.coversCache', 'Ảnh bìa & DB')}</span>
            </div>
            <span className="text-sm sm:text-base font-bold font-mono text-white">
              {formatBytes(coversStats.totalBytes)}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {coversStats.count} {t('storage.covers', 'ảnh')}
            </span>
          </div>

          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-3.5 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Sparkles size={14} className="text-emerald-400 shrink-0" />
              <span className="truncate">{t('storage.freeSpace', 'Bộ nhớ còn lại')}</span>
            </div>
            <span className="text-sm sm:text-base font-bold font-mono text-emerald-400">
              {formatBytes(Math.max(0, audioCacheStats.maxBytes - audioCacheStats.totalBytes))}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {(100 - usagePercentage).toFixed(1)}% {t('storage.available', 'trống')}
            </span>
          </div>

          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-3 sm:p-3.5 flex flex-col">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Layers size={14} className="text-indigo-400 shrink-0" />
              <span className="truncate">{t('storage.browserQuota', 'Hạn mức Trình duyệt')}</span>
            </div>
            <span className="text-sm sm:text-base font-bold font-mono text-white truncate">
              {browserStorage ? formatBytes(browserStorage.quota, 0) : 'Unlimited'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono truncate">
              {browserStorage ? `${formatBytes(browserStorage.usage)} ${t('storage.allSites', 'tổng')}` : 'IndexedDB'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area: Tabs, Search, Multi-select toolbar */}
      <div className="flex flex-col gap-4">
        {/* Navigation Mode Tabs & Search Bar */}
        <div className="relative z-20 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          {/* Subtabs */}
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0c1626]/80 p-1.5 backdrop-blur-xl shadow-lg no-scrollbar w-full lg:w-auto max-w-full">
            <button
              onClick={() => setViewMode('tracks')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${viewMode === 'tracks'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
            >
              <Music size={15} className="shrink-0" />
              <span>{t('storage.tabTracks', 'Theo Bài hát')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                {cachedTrackItems.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode('albums')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${viewMode === 'albums'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
            >
              <Disc size={15} className="shrink-0" />
              <span>{t('storage.tabAlbums', 'Theo Album')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                {albumGroups.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode('playlists')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${viewMode === 'playlists'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
            >
              <ListMusic size={15} className="shrink-0" />
              <span>{t('storage.tabPlaylists', 'Theo Playlist')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                {playlistGroups.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode('artists')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${viewMode === 'artists'
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
            >
              <Mic2 size={15} className="shrink-0" />
              <span>{t('storage.tabArtists', 'Theo Nghệ sĩ')}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300">
                {artistGroups.length}
              </span>
            </button>
          </div>

          {/* Search & Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64 md:w-72">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('storage.searchPlaceholder', 'Tìm bài hát, album, nghệ sĩ...')}
                className="w-full bg-[#0c1626]/90 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1"
                  aria-label="Xóa tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>

            {viewMode === 'tracks' && (
              <div className="flex items-center gap-1.5 shrink-0">
                <CustomSelect<SortField>
                  value={sortField}
                  options={sortOptions}
                  onChange={(val) => setSortField(val)}
                  icon={<ArrowUpDown size={13} className="text-primary" />}
                  ariaLabel={t('storage.sortAria', 'Sắp xếp theo')}
                  tone="primary"
                  align="right"
                />
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="p-2 rounded-xl bg-[#0c1626]/90 border border-white/10 hover:border-white/20 text-primary hover:text-white transition-all shrink-0 cursor-pointer active:scale-95 text-xs font-mono"
                  title={sortAsc ? 'Tăng dần' : 'Giảm dần'}
                  aria-label={sortAsc ? 'Sắp xếp tăng dần' : 'Sắp xếp giảm dần'}
                >
                  {sortAsc ? '▲' : '▼'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Action Toolbar (for Tracks View) */}
        {viewMode === 'tracks' && filteredAndSortedTracks.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white/[0.02] border border-white/[0.06] rounded-2xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={selectAllFiltered}
                className="flex items-center gap-2 text-xs font-medium text-slate-300 hover:text-primary transition-colors cursor-pointer"
              >
                {selectedTrackIds.size === filteredAndSortedTracks.length && filteredAndSortedTracks.length > 0 ? (
                  <CheckSquare size={16} className="text-primary shrink-0" />
                ) : (
                  <Square size={16} className="text-slate-400 shrink-0" />
                )}
                <span className="truncate">
                  {selectedTrackIds.size > 0
                    ? t('storage.selectedCount', 'Đã chọn {{count}} / {{total}} bài', {
                      count: selectedTrackIds.size,
                      total: filteredAndSortedTracks.length,
                    })
                    : t('storage.selectAll', 'Chọn tất cả')}
                </span>
              </button>
            </div>

            {selectedTrackIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <Trash2 size={14} className="shrink-0" />
                <span>
                  {t('storage.deleteSelectedBtn', 'Xóa {{count}} bài đã chọn', {
                    count: selectedTrackIds.size,
                  })}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {cachedTrackItems.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-white/[0.02] border border-white/[0.06] my-4">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-400 mb-3">
              <HardDrive size={32} />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {t('storage.noCacheTitle', 'Chưa có bài hát nào được lưu Offline')}
            </h3>
            <p className="text-xs text-slate-400 max-w-md font-mono">
              {t(
                'storage.noCacheDesc',
                'Khi bạn phát bài hát hoặc bấm nút tải trong thư viện/playlist, các bài hát sẽ tự động được lưu vào bộ nhớ này để nghe khi không có mạng.'
              )}
            </p>
          </div>
        )}

        {/* VIEW 1: Tracks List */}
        {viewMode === 'tracks' && filteredAndSortedTracks.length > 0 && (
          <div className="flex flex-col gap-2">
            {filteredAndSortedTracks.map((item) => {
              const isSelected = selectedTrackIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-2xl border transition-all duration-200 backdrop-blur-md group ${isSelected
                      ? 'bg-primary/10 border-primary/40 shadow-[0_0_15px_rgba(0,245,255,0.1)]'
                      : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] hover:border-primary/30'
                    }`}
                >
                  {/* Left: Checkbox + Artwork + Info */}
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => toggleSelectTrack(item.id)}
                      className="text-slate-400 hover:text-primary p-1 shrink-0 cursor-pointer"
                      aria-label="Chọn bài hát"
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-primary" />
                      ) : (
                        <Square size={18} className="text-slate-500" />
                      )}
                    </button>

                    {/* Album Art with Play Overlay */}
                    <div
                      onClick={() => handlePlayTrack(item)}
                      className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 group-hover:shadow-[0_0_15px_rgba(0,245,255,0.2)] transition-all cursor-pointer"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <Music size={18} className="text-slate-500" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play size={16} fill="currentColor" className="text-primary ml-0.5 drop-shadow" />
                      </div>
                    </div>

                    {/* Title & Artist & Album */}
                    <div className="flex flex-col min-w-0 flex-1 pr-1 sm:pr-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          onClick={() => handlePlayTrack(item)}
                          className="text-xs sm:text-sm font-semibold text-slate-100 truncate group-hover:text-primary transition-colors cursor-pointer"
                        >
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] sm:text-xs text-slate-400 font-mono min-w-0">
                        <span className="truncate max-w-[90px] sm:max-w-[160px] md:max-w-[220px]">{item.artist}</span>
                        <span className="text-slate-600 shrink-0">•</span>
                        <span className="truncate max-w-[90px] sm:max-w-[160px] md:max-w-[220px] text-slate-400">{item.album}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Size badge + Date + Action button */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div className="flex flex-col items-end text-right">
                      <span className="text-[11px] sm:text-xs font-mono font-bold text-primary px-1.5 sm:px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 shadow-sm whitespace-nowrap">
                        {formatBytes(item.bytes)}
                      </span>
                      {item.cachedAt > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 hidden md:inline">
                          {formatDate(item.cachedAt)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteTrack(item)}
                      disabled={isDeleting}
                      className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all active:scale-95 cursor-pointer"
                      title={t('storage.deleteTrack', 'Xóa bài này khỏi bộ nhớ đệm')}
                      aria-label={`Xóa cache của ${item.title}`}
                    >
                      <Trash2 size={15} className="sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW 2: Albums List */}
        {viewMode === 'albums' && albumGroups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {albumGroups.map((group) => (
              <div
                key={group.album}
                className="flex flex-col justify-between p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-primary/30 transition-all backdrop-blur-md group"
              >
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-md">
                    {group.coverUrl ? (
                      <img src={group.coverUrl} alt={group.album} className="w-full h-full object-cover" />
                    ) : (
                      <Disc size={24} className="text-primary/70" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">
                      {group.album}
                    </h4>
                    <span className="text-xs text-slate-400 font-mono truncate">{group.artist}</span>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {group.items.length} {t('storage.tracks', 'bài')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-3 border-t border-white/[0.04]">
                  <span className="text-xs font-mono font-bold text-primary shrink-0">
                    {formatBytes(group.totalBytes)}
                  </span>
                  <button
                    onClick={() => handleDeleteAlbum(group.album, group.items, group.totalBytes)}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-medium transition-all active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>{t('storage.deleteAlbumBtn', 'Xóa Cache Album')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW 3: Playlists List */}
        {viewMode === 'playlists' && (
          <div className="flex flex-col gap-3">
            {playlistGroups.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06] text-slate-400 text-xs font-mono">
                {t('storage.noPlaylistCache', 'Chưa có playlist nào có bài hát được lưu offline.')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {playlistGroups.map((group) => (
                  <div
                    key={group.playlist.id}
                    className="flex flex-col justify-between p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-primary/30 transition-all backdrop-blur-md group"
                  >
                    <div className="flex items-center gap-3.5 mb-3">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-md">
                        {group.playlist.imageUrl ? (
                          <img
                            src={group.playlist.imageUrl}
                            alt={group.playlist.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ListMusic size={24} className="text-emerald-400" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                          {group.playlist.name}
                        </h4>
                        <span className="text-xs text-slate-400 font-mono mt-0.5">
                          {group.cachedCount} / {group.totalPlaylistTracks} {t('storage.tracksOffline', 'bài offline')}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-3 border-t border-white/[0.04]">
                      <span className="text-xs font-mono font-bold text-primary shrink-0">
                        {formatBytes(group.totalBytes)}
                      </span>
                      <button
                        onClick={() =>
                          handleDeletePlaylist(group.playlist.name, group.items, group.totalBytes)
                        }
                        disabled={isDeleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-medium transition-all active:scale-95 shrink-0 cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>{t('storage.deletePlaylistBtn', 'Xóa Cache Playlist')}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: Artists List */}
        {viewMode === 'artists' && artistGroups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {artistGroups.map((group) => (
              <div
                key={group.artist}
                className="flex flex-col justify-between p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-primary/30 transition-all backdrop-blur-md group"
              >
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-md">
                    {group.coverUrl ? (
                      <img src={group.coverUrl} alt={group.artist} className="w-full h-full object-cover" />
                    ) : (
                      <Mic2 size={20} className="text-indigo-400" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                      {group.artist}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {group.items.length} {t('storage.tracks', 'bài')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-3 border-t border-white/[0.04]">
                  <span className="text-xs font-mono font-bold text-primary shrink-0">
                    {formatBytes(group.totalBytes)}
                  </span>
                  <button
                    onClick={() => handleDeleteArtist(group.artist, group.items, group.totalBytes)}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-medium transition-all active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>{t('storage.delete', 'Xóa')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
