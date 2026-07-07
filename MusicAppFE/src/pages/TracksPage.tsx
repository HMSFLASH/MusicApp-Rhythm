import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, ListMusic, Cloud, Star, Clock, ListPlus, Play, ArrowLeft, Shuffle, MoreHorizontal, Info, X, ListEnd, ListStart } from 'lucide-react';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { useGlobalAudio } from '../context/AudioContext';
import type { Track } from '../hooks/useAudioPlayer';
import { axiosClient } from '../api/axiosClient';

export function TracksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { jwtToken, playerState } = useGlobalAudio();
  
  const [tracks, setTracks] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const activeTab = searchParams.get('tab') === 'favorites' ? 'favorites' : 'all';
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | number | null>(null);
  const [infoTrack, setInfoTrack] = useState<Track | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const cached = localStorage.getItem('sonic_library_tracks');
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty
      try { setTracks(JSON.parse(cached)); } catch (e) { }
    }

    axiosClient.get('/api/music/list')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        const parsed = data.length > 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? data.map((d: any) => ({ id: d.id, fileName: d.name, sourceType: d.sourceType, imageUrl: d.imageUrl, artist: d.artist, title: d.title, album: d.album, genre: d.genre, durationSeconds: d.durationSeconds }))
          : [];
        setTracks(parsed);
        localStorage.setItem('sonic_library_tracks', JSON.stringify(parsed));
      })
      .catch(() => setTracks([]));
  }, [jwtToken]);

  useEffect(() => {
    if (!jwtToken) return;
    
    const cachedFavs = localStorage.getItem('sonic_favorites');
    if (cachedFavs) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty
      try { setFavorites(JSON.parse(cachedFavs)); } catch (e) { }
    }

    axiosClient.get('/api/favorites')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        const parsed = data.length > 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? data.map((d: any) => ({ id: d.id, fileName: d.name, sourceType: d.sourceType, imageUrl: d.imageUrl, artist: d.artist, title: d.title, album: d.album, genre: d.genre, durationSeconds: d.durationSeconds }))
          : [];
        setFavorites(parsed);
        localStorage.setItem('sonic_favorites', JSON.stringify(parsed));
      })
      .catch(() => setFavorites([]));
  }, [jwtToken]);

  useEffect(() => {
    const handleRestore = () => {
      if (jwtToken) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        axiosClient.get('/api/music/list').then((data: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed = data.length > 0 ? data.map((d: any) => ({ id: d.id, fileName: d.name, sourceType: d.sourceType, imageUrl: d.imageUrl, artist: d.artist, title: d.title, album: d.album, genre: d.genre, durationSeconds: d.durationSeconds })) : [];
          setTracks(parsed);
          localStorage.setItem('sonic_library_tracks', JSON.stringify(parsed));
        }).catch(() => setTracks([]));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        axiosClient.get('/api/favorites').then((data: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed = data.length > 0 ? data.map((d: any) => ({ id: d.id, fileName: d.name, sourceType: d.sourceType, imageUrl: d.imageUrl, artist: d.artist, title: d.title, album: d.album, genre: d.genre, durationSeconds: d.durationSeconds })) : [];
          setFavorites(parsed);
          localStorage.setItem('sonic_favorites', JSON.stringify(parsed));
        }).catch(() => setFavorites([]));
      }
    };
    
    // Force re-render when background metadata loads
    const handleMetadataUpdated = () => {
      setTracks(prev => [...prev]);
      setFavorites(prev => [...prev]);
    };

    window.addEventListener('DriveConfigRestored', handleRestore);
    window.addEventListener('sonic_metadata_updated', handleMetadataUpdated);
    
    return () => {
      window.removeEventListener('DriveConfigRestored', handleRestore);
      window.removeEventListener('sonic_metadata_updated', handleMetadataUpdated);
    };
  }, [jwtToken]);
  const toggleFavorite = async (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFav = favorites.some(f => f.id === track.id);
    try {
      if (isFav) {
        await axiosClient.delete(`/api/favorites/${track.id}`);
        setFavorites(prev => {
          const newFavs = prev.filter(f => f.id !== track.id);
          localStorage.setItem('sonic_favorites', JSON.stringify(newFavs));
          return newFavs;
        });
      } else {
        await axiosClient.post(`/api/favorites/${track.id}`);
        setFavorites(prev => {
          const newFavs = [...prev, track];
          localStorage.setItem('sonic_favorites', JSON.stringify(newFavs));
          return newFavs;
        });
      }
      setOpenMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlayNext = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentQueue = playerState.queue;
    if (currentQueue.length === 0 && !playerState.currentTrack) {
      playerState.playTrack(track, displayTracks);
    } else {
      const currentIndex = currentQueue.findIndex(t => t.id === playerState.currentTrack?.id);
      if (currentIndex !== -1) {
        const newQueue = [...currentQueue];
        newQueue.splice(currentIndex + 1, 0, track);
        playerState.setQueue(newQueue);
      } else {
        playerState.setQueue([...currentQueue, track]);
      }
    }
    setOpenMenuId(null);
  };

  const handleAddToQueue = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playerState.queue.length === 0 && !playerState.currentTrack) {
      playerState.playTrack(track, displayTracks);
    } else {
      playerState.setQueue([...playerState.queue, track]);
    }
    setOpenMenuId(null);
  };

  const displayTracks = activeTab === 'favorites' ? favorites : tracks;
  
  const totalPages = Math.ceil(displayTracks.length / ITEMS_PER_PAGE);
  const currentTracks = displayTracks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto pb-32 overflow-y-auto">
      <div className="mb-6 md:mb-8 border-b border-white/10 pb-4 md:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-3">
            <button onClick={() => navigate('/library')} aria-label="Back to library" className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            {activeTab === 'all' ? 'All Songs' : 'Favorites'}
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 ml-12">
            {displayTracks.length} {activeTab === 'all' ? 'songs in your library' : 'favorite songs'}.
          </p>
        </div>
      </div>

      <AddToPlaylistModal
        isOpen={!!trackToPlaylist}
        onClose={() => setTrackToPlaylist(null)}
        jwtToken={jwtToken}
        track={trackToPlaylist}
      />

      <div className="flex items-center justify-between mb-4 mt-2 flex-wrap gap-4">
        <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
          {activeTab === 'all' ? <><Clock size={18} className="text-[#00E5FF]" /> Songs List</> : <><Star size={18} className="text-yellow-400" /> Favorites List</>}
        </h2>
        {displayTracks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                if (playerState.isShuffle) {
                  const shuffled = [...displayTracks].sort(() => Math.random() - 0.5);
                  playerState.playTrack(shuffled[0], shuffled);
                } else {
                  playerState.playTrack(displayTracks[0], displayTracks);
                }
              }}
              className="px-4 h-9 rounded-full bg-primary text-black hover:bg-primary/90 flex items-center gap-1.5 transition-all text-sm font-bold shadow-lg shadow-primary/20"
              title="Play All"
            >
              <Play size={15} fill="currentColor" /> Play
            </button>
            <button
              onClick={() => {
                playerState.setIsShuffle(true);
                const shuffled = [...displayTracks].sort(() => Math.random() - 0.5);
                playerState.playTrack(shuffled[0], shuffled);
              }}
              className="px-4 h-9 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold"
              title="Shuffle & Play"
            >
              <Shuffle size={15} /> Shuffle
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {currentTracks.map((track, idx) => (
          <div
            key={track.id}
            onMouseLeave={() => setOpenMenuId(null)}
            onClick={() => playerState.playTrack(track, displayTracks)}
            className={`flex items-center gap-4 p-3 rounded-xl border transition-colors group cursor-pointer ${playerState.currentTrack?.id === track.id
              ? 'bg-primary/10 border-primary/30'
              : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
              }`}
          >
            <span className="text-xs text-white/20 w-5 text-right md:group-hover:hidden">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</span>
            <button
              aria-label="Play track"
              onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, displayTracks); }}
              className={`hidden md:group-hover:flex w-5 items-center justify-center rounded-full transition-colors text-white`}
            >
              <Play size={13} fill="currentColor" />
            </button>
            <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
              {track.imageUrl || playerState.getTrackImage(track.id) ? (
                <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <ListMusic size={16} className="text-white/40" />
              )}
            </div>
            <div className="flex flex-col truncate flex-1">
              <span className={`text-sm font-medium truncate ${playerState.currentTrack?.id === track.id ? 'text-primary' : 'text-white'}`}>
                {track.title || playerState.getTrackMetadata(track.id)?.title || (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Cloud size={12} className="text-blue-400" />
                <span className="text-xs text-white/30 truncate">{track.artist || playerState.getTrackMetadata(track.id)?.artist || (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')}</span>
              </div>
            </div>
            <div className={`relative flex items-center gap-2 transition-opacity ${openMenuId === track.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}>
              <button
                aria-label="More options"
                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === track.id ? null : track.id); }}
                className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="More options"
              >
                <MoreHorizontal size={18} />
              </button>

              {openMenuId === track.id && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 py-1">
                  <button
                    onClick={(e) => handlePlayNext(track, e)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10"
                  >
                    <ListStart size={14} /> Play Next
                  </button>
                  <button
                    onClick={(e) => handleAddToQueue(track, e)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10"
                  >
                    <ListEnd size={14} /> Add to Queue
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setTrackToPlaylist(track); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10"
                  >
                    <ListPlus size={14} /> Add to Playlist
                  </button>
                  <button
                    onClick={(e) => toggleFavorite(track, e)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10"
                  >
                    <Heart size={14} fill={favorites.some(f => f.id === track.id) ? "currentColor" : "none"} className={favorites.some(f => f.id === track.id) ? "text-primary" : ""} /> 
                    {favorites.some(f => f.id === track.id) ? "Remove from Favorites" : "Add to Favorites"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setInfoTrack(track); setOpenMenuId(null); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/10 border-t border-white/10"
                  >
                    <Info size={14} /> Info
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <button
            aria-label="Previous page"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors border border-white/5"
          >
            Previous
          </button>
          <div className="text-sm text-white/50">
            Page <span className="text-white font-bold">{currentPage}</span> of <span className="text-white font-bold">{totalPages}</span>
          </div>
          <button
            aria-label="Next page"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium transition-colors border border-white/5"
          >
            Next
          </button>
        </div>
      )}

      {/* Info Modal */}
      {infoTrack && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setInfoTrack(null)}
        >
          <div
            className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3 text-white">
                <Info size={24} className="text-primary" />
                <h3 className="font-semibold text-lg">Track Metadata</h3>
              </div>
              <button
                aria-label="Close info"
                onClick={() => setInfoTrack(null)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
              <div className="bg-white/5 rounded-xl p-4 flex flex-col gap-3">
                {[
                  { label: 'Title', value: infoTrack.title || playerState.getTrackMetadata(infoTrack.id)?.title },
                  { label: 'Artist', value: infoTrack.artist || playerState.getTrackMetadata(infoTrack.id)?.artist },
                  { label: 'Album', value: infoTrack.album || playerState.getTrackMetadata(infoTrack.id)?.album },
                  { label: 'Genre', value: infoTrack.genre || playerState.getTrackMetadata(infoTrack.id)?.genre },
                  { label: 'Duration', value: infoTrack.durationSeconds ? `${Math.floor(infoTrack.durationSeconds / 60)}:${Math.floor(infoTrack.durationSeconds % 60).toString().padStart(2, '0')}` : null },
                  { label: 'File Name', value: infoTrack.fileName },
                  { label: 'Source', value: infoTrack.sourceType },
                  { label: 'Track ID', value: String(infoTrack.id) },
                  { label: 'File Type', value: infoTrack.fileFormat || playerState.getTrackMetadata(infoTrack.id)?.fileFormat },
                  { label: 'Codec', value: infoTrack.codec || playerState.getTrackMetadata(infoTrack.id)?.codec },
                  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  { label: 'Size', value: (infoTrack.fileSize || playerState.getTrackMetadata(infoTrack.id)?.fileSize) ? `${((infoTrack.fileSize || playerState.getTrackMetadata(infoTrack.id)?.fileSize!) / 1024 / 1024).toFixed(2)} MB` : null },
                  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  { label: 'Bit Rate', value: (infoTrack.bitrate || playerState.getTrackMetadata(infoTrack.id)?.bitrate) ? `${Math.round((infoTrack.bitrate || playerState.getTrackMetadata(infoTrack.id)?.bitrate!) / 1000)} kbps` : null },
                  // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
                  { label: 'Channels', value: (infoTrack.numberOfChannels || playerState.getTrackMetadata(infoTrack.id)?.numberOfChannels) ? `${infoTrack.numberOfChannels || playerState.getTrackMetadata(infoTrack.id)?.numberOfChannels} ${[2].includes(infoTrack.numberOfChannels || playerState.getTrackMetadata(infoTrack.id)?.numberOfChannels!) ? '(stereo)' : ''}` : null },
                  { label: 'Audio Sample Rate', value: (infoTrack.sampleRate || playerState.getTrackMetadata(infoTrack.id)?.sampleRate) ? `${((infoTrack.sampleRate || playerState.getTrackMetadata(infoTrack.id)?.sampleRate!) / 1000).toFixed(3)} kHz` : null },
                  { label: 'Bit Depth', value: (infoTrack.bitsPerSample || playerState.getTrackMetadata(infoTrack.id)?.bitsPerSample) ? `${infoTrack.bitsPerSample || playerState.getTrackMetadata(infoTrack.id)?.bitsPerSample} bit` : null }
                ].map((item, index) => (
                  <div key={index} className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">{item.label}</span>
                    <span className="text-sm text-white/90 font-medium break-all">{item.value || 'unknown'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
