import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Track } from '../hooks/useAudioPlayer';
import { Cloud, Play, Plus, ListMusic, ChevronLeft, Trash2, ListPlus, X, Shuffle, Pencil, Check } from 'lucide-react';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import { AddTracksModal } from './AddTracksModal';
import { axiosClient } from '../api/axiosClient';
import { useGlobalAudio } from '../context/AudioContext';

interface PlaylistProps {
  jwtToken: string;
  onPlay: (track: Track, queue?: Track[]) => void;
  currentTrackId?: string | number;
}

export function Playlist({ jwtToken, onPlay, currentTrackId }: PlaylistProps) {
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPlaylistId = searchParams.get('playlistId') ? parseInt(searchParams.get('playlistId')!) : null;
  
  const setSelectedPlaylistId = (id: number | null) => {
    if (id) {
      setSearchParams({ playlistId: id.toString() });
    } else {
      setSearchParams({});
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedPlaylistDetails, setSelectedPlaylistDetails] = useState<any | null>(null);
  const { playerState } = useGlobalAudio();
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddTracksModalOpen, setIsAddTracksModalOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingListPlaylistId, setEditingListPlaylistId] = useState<number | null>(null);
  const [editListName, setEditListName] = useState('');

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      const data = await axiosClient.get('/api/playlists');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPlaylists(data as unknown as any[]);
      localStorage.setItem('sonic_playlists', JSON.stringify(data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlaylistDetails = async (id: number) => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await axiosClient.get(`/api/playlists/${id}`);
      // Map backend tracks to our Track interface
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedTracks = (data.tracks || []).map((d: any) => ({
          id: d.id,
          fileName: d.name,
          sourceType: d.sourceType,
          imageUrl: d.imageUrl,
          artist: d.artist,
          title: d.title,
          album: d.album,
          genre: d.genre,
          durationSeconds: d.durationSeconds
      }));
      const details = { ...data, tracks: mappedTracks };
      setSelectedPlaylistDetails(details);
      localStorage.setItem(`sonic_playlist_${id}`, JSON.stringify(details));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jwtToken) {
      const cached = localStorage.getItem('sonic_playlists');
      if (cached) {
        // eslint-disable-next-line react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty
        try { setPlaylists(JSON.parse(cached)); } catch (e) {}
      }
      fetchPlaylists();
    }
  }, [jwtToken]);

  useEffect(() => {
    if (selectedPlaylistId) {
      const cached = localStorage.getItem(`sonic_playlist_${selectedPlaylistId}`);
      if (cached) {
        // eslint-disable-next-line react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty
        try { setSelectedPlaylistDetails(JSON.parse(cached)); } catch (e) {}
      }
      fetchPlaylistDetails(selectedPlaylistId);
      setIsEditingName(false);
    } else {
      setSelectedPlaylistDetails(null);
      setIsEditingName(false);
    }
  }, [selectedPlaylistId]);

  useEffect(() => {
    const handleRestore = () => {
      if (jwtToken) {
        fetchPlaylists();
        if (selectedPlaylistId) {
          fetchPlaylistDetails(selectedPlaylistId);
        }
      }
    };
    window.addEventListener('DriveConfigRestored', handleRestore);
    return () => window.removeEventListener('DriveConfigRestored', handleRestore);
  }, [jwtToken, selectedPlaylistId]);

  useEffect(() => {
    let isCancelled = false;
    const preloadMissingTracks = async () => {
      if (!selectedPlaylistDetails?.tracks) return;
      for (const track of selectedPlaylistDetails.tracks) {
        if (isCancelled) break;
        if (!track.imageUrl && !playerState.getTrackImage(track.id) && !track.title) {
           try {
             await playerState.preloadTrack(track);
             await new Promise(r => setTimeout(r, 800)); // Rate limit
           } catch (e) {
             console.error("Preload track error", e);
           }
        }
      }
    };
    preloadMissingTracks();
    return () => { isCancelled = true; };
  }, [selectedPlaylistDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  const deletePlaylist = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('playlist.deleteConfirm'))) return;

    try {
      await axiosClient.delete(`/api/playlists/${id}`);
      fetchPlaylists();
      if (selectedPlaylistId === id) setSelectedPlaylistId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const renamePlaylist = async () => {
    if (!selectedPlaylistId || !editName.trim() || editName.trim() === selectedPlaylistDetails?.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await axiosClient.put(`/api/playlists/${selectedPlaylistId}`, {
        name: editName.trim()
      });
      fetchPlaylistDetails(selectedPlaylistId);
      fetchPlaylists();
      setIsEditingName(false);
    } catch (e) {
      console.error(e);
    }
  };

  const renamePlaylistFromList = async (id: number, currentName: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!editListName.trim() || editListName.trim() === currentName) {
      setEditingListPlaylistId(null);
      return;
    }
    try {
      await axiosClient.put(`/api/playlists/${id}`, {
        name: editListName.trim()
      });
      fetchPlaylists();
      setEditingListPlaylistId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const removeTrackFromPlaylist = async (trackId: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedPlaylistId) return;

    try {
      await axiosClient.delete(`/api/playlists/${selectedPlaylistId}/tracks/${trackId}`);
      fetchPlaylistDetails(selectedPlaylistId);
      fetchPlaylists(); // update track counts in the list view
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-surface rounded-xl p-6 shadow-2xl border border-white/5 flex flex-col h-full">
      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchPlaylists}
      />
      <AddTracksModal
        isOpen={isAddTracksModalOpen}
        onClose={() => setIsAddTracksModalOpen(false)}
        jwtToken={jwtToken}
        playlistId={selectedPlaylistId as number}
        playlistTracks={selectedPlaylistDetails?.tracks || []}
        onSuccess={() => {
          fetchPlaylistDetails(selectedPlaylistId as number);
          fetchPlaylists(); // update track counts in the list view
        }}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold font-sans text-white flex items-center gap-2 flex-wrap min-w-0">
          {selectedPlaylistId ? (
            <button
              onClick={() => setSelectedPlaylistId(null)}
              className="hover:bg-white/10 p-1.5 rounded-full transition-colors -ml-2"
            >
              <ChevronLeft size={24} />
            </button>
          ) : (
            <ListMusic size={24} className="text-primary" />
          )}
          {selectedPlaylistId && selectedPlaylistDetails ? (
            isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renamePlaylist();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  autoFocus
                  className="bg-black/20 border border-white/20 rounded-md px-2 py-0.5 text-white text-xl font-bold focus:outline-none focus:border-primary w-full max-w-[200px]"
                />
                <button onClick={renamePlaylist} className="text-primary hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors">
                  <Check size={18} />
                </button>
                <button onClick={() => setIsEditingName(false)} className="text-red-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 group/title cursor-pointer hover:bg-white/5 px-2 py-0.5 -ml-2 rounded-md transition-colors min-w-0" 
                onClick={() => { setEditName(selectedPlaylistDetails.name); setIsEditingName(true); }}
              >
                <span className="truncate">{selectedPlaylistDetails.name}</span>
                <button className="opacity-100 md:opacity-0 group-hover/title:opacity-100 text-white/40 hover:text-white transition-opacity p-1 shrink-0">
                  <Pencil size={16} />
                </button>
              </div>
            )
          ) : (
            t('playlist.yourPlaylists')
          )}
        </h2>

        {selectedPlaylistId ? (
          <div className="flex flex-wrap gap-2 items-center">
            {selectedPlaylistDetails && selectedPlaylistDetails.tracks && selectedPlaylistDetails.tracks.length > 0 && (
              <>
                <button
                  onClick={() => {
                    const tracks = selectedPlaylistDetails.tracks;
                    if (playerState.isShuffle) {
                      playerState.playTrack(null, tracks, true, true);
                    } else {
                      playerState.playTrack(tracks[0], tracks);
                    }
                  }}
                  className="px-3 h-8 rounded-full bg-primary text-black hover:bg-primary/90 flex items-center gap-1.5 transition-all text-sm font-bold shadow-lg shadow-primary/20"
                  title={t('playlist.playPlaylist')}
                >
                  <Play size={14} fill="currentColor" /> {t('playlist.play')}
                </button>
                <button
                  onClick={() => {
                    playerState.setIsShuffle(true);
                    const tracks = selectedPlaylistDetails.tracks;
                    playerState.playTrack(null, tracks, true, true);
                  }}
                  className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold"
                  title={t('playlist.shuffleTitle')}
                >
                  <Shuffle size={14} /> {t('playlist.shuffle')}
                </button>
                <button
                  onClick={() => {
                    playerState.addToCurrentQueue(selectedPlaylistDetails.tracks);
                  }}
                  className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold"
                  title={t('playlist.addToQueueTitle')}
                >
                  <ListPlus size={14} /> {t('playlist.addToQueue')}
                </button>
                <button
                  onClick={() => {
                    playerState.addToNextQueue(selectedPlaylistDetails.tracks);
                  }}
                  className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold"
                  title={t('playlist.addToNextQueueTitle')}
                >
                  <ListMusic size={14} /> {t('playlist.nextQueue')}
                </button>
              </>
            )}
            <button
              onClick={() => setIsAddTracksModalOpen(true)}
              className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center justify-center transition-all ml-2"
              title={t('playlist.addTracks')}
            >
              <ListPlus size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="w-8 h-8 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-black flex items-center justify-center transition-all"
            title={t('playlist.createPlaylist')}
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !selectedPlaylistId ? (
          /* PLAYLISTS LIST VIEW */
          playlists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-5 animate-in fade-in zoom-in-95 duration-300">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-20 h-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 hover:border-[#00E5FF] hover:text-[#00E5FF] hover:bg-[#00E5FF]/10 transition-all group"
              >
                <Plus size={40} className="group-hover:scale-110 transition-transform" />
              </button>
              <div className="flex flex-col items-center gap-1">
                <span className="text-white font-medium text-lg">{t('playlist.createFirst')}</span>
                <span className="text-sm text-white/40 text-center">
                  {t('playlist.libraryEmpty')}
                </span>
              </div>
            </div>
          ) : (
            playlists.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedPlaylistId(p.id)}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover rounded-md" />
                    ) : (
                      <ListMusic size={20} className="text-white/40" />
                    )}
                  </div>
                  <div className="flex flex-col truncate flex-1 pr-4">
                    {editingListPlaylistId === p.id ? (
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editListName}
                          onChange={(e) => setEditListName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renamePlaylistFromList(p.id, p.name, e);
                            if (e.key === 'Escape') setEditingListPlaylistId(null);
                          }}
                          autoFocus
                          className="bg-black/50 border border-white/20 rounded-md px-2 py-0.5 text-white text-sm font-bold focus:outline-none focus:border-primary w-full max-w-[150px]"
                        />
                        <button onClick={(e) => renamePlaylistFromList(p.id, p.name, e)} className="text-primary hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                          <Check size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingListPlaylistId(null); }} className="text-red-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/title min-w-0">
                        <span className="text-sm font-bold text-white truncate">{p.name}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditListName(p.name);
                            setEditingListPlaylistId(p.id);
                          }}
                          className="opacity-100 md:opacity-0 group-hover/title:opacity-100 text-white/40 hover:text-white transition-opacity p-1 shrink-0"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                    <span className="text-xs text-white/40 truncate">{p.trackCount} {t('playlist.tracks')}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => deletePlaylist(p.id, e)}
                  className="p-2 text-white/30 md:text-transparent md:group-hover:text-red-400/50 hover:!text-red-400 transition-colors rounded-full hover:bg-red-400/10 shrink-0"
                  title={t('playlist.deletePlaylist')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )
        ) : (
          /* PLAYLIST DETAILS VIEW (TRACKS) */
          selectedPlaylistDetails && (
            selectedPlaylistDetails.tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-5 animate-in fade-in zoom-in-95 duration-300">
                <button
                  onClick={() => setIsAddTracksModalOpen(true)}
                  className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 hover:border-white hover:text-white hover:bg-white/10 transition-all group"
                >
                  <ListPlus size={32} className="group-hover:scale-110 transition-transform" />
                </button>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-white font-medium">{t('playlist.playlistEmpty')}</span>
                  <span className="text-sm text-white/40 text-center max-w-[200px]">
                    {t('playlist.clickSearch')}
                  </span>
                </div>
              </div>
            ) : (
              selectedPlaylistDetails.tracks.map((track: Track) => (
                <div
                  key={track.id}
                  onClick={() => onPlay(track, selectedPlaylistDetails.tracks)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors group cursor-pointer ${currentTrackId === track.id
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-background/50 border-white/5 hover:border-white/10 hover:bg-white/5'
                    }`}
                >
                  <div className="flex items-center gap-4 overflow-hidden w-full">
                    <button
                      onClick={(e) => { e.stopPropagation(); onPlay(track, selectedPlaylistDetails.tracks); }}
                      className={`flex items-center justify-center p-2 rounded-full transition-colors shrink-0 ${currentTrackId === track.id
                          ? "bg-primary text-black"
                          : "bg-white/10 text-white group-hover:bg-primary group-hover:text-black"
                        }`}
                    >
                      <Play size={14} fill="currentColor" className={currentTrackId !== track.id ? "ml-0.5" : ""} />
                    </button>
                    <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                      {track.imageUrl || playerState.getTrackImage(track.id) ? (
                        <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover" />
                      ) : (
                        <ListMusic size={16} className="text-white/40" />
                      )}
                    </div>
                    <div className="flex flex-col truncate w-full pr-2">
                      <span className={`text-sm font-medium truncate ${currentTrackId === track.id ? 'text-primary' : 'text-white'}`}>
                        {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, ""))}
                      </span>
                      <span className="text-xs text-secondary/60 font-mono mt-0.5 flex items-center gap-1 truncate">
                        {track.sourceType === 'DRIVE' && <Cloud size={10} className="text-primary shrink-0" />}
                        <span className="truncate">{track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => removeTrackFromPlaylist(track.id, e)}
                    className="p-2 text-white/30 md:text-transparent md:group-hover:text-white/40 hover:!text-red-400 transition-colors rounded-full hover:bg-red-400/10 shrink-0"
                    title={t('playlist.removeFromPlaylist')}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )
          )
        )}
      </div>
    </div>
  );
}
