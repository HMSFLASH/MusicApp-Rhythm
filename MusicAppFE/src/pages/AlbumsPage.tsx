import { getSecureRandom } from '../utils/randomUtils';
import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Album, ListMusic, ListPlus, Play, Shuffle, Heart } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../hooks/useAudioPlayer';
import { ActionMenu } from '../components/ActionMenu';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { useVirtualList } from '../hooks/useVirtualList';

const ALBUM_TRACK_ROW_HEIGHT = 72;

export function AlbumsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playerState } = useGlobalAudio();
  const { tracks, favorites, toggleFavorite } = useLibrary();
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(location.state?.selectedAlbum || null);
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);

  const getAlbum = (track: Track) => track.album || playerState.getTrackMetadata(track.id)?.album || '';
  const getArtist = (track: Track) => {
    if (track.artist) return track.artist;
    const metaArtist = playerState.getTrackMetadata(track.id)?.artist;
    if (metaArtist) return metaArtist;
    if (track.fileName?.includes(' - ')) return track.fileName.split(' - ')[0];
    return 'Unknown Artist';
  };

  const getTitle = (track: Track) => {
    if (track.title) return track.title;
    const metaTitle = playerState.getTrackMetadata(track.id)?.title;
    if (metaTitle) return metaTitle;
    if (!track.fileName) return 'Unknown Title';
    const cleanName = track.fileName.replace(/\.[^/.]+$/, '');
    if (cleanName.includes(' - ')) return cleanName.split(' - ')[1];
    return cleanName;
  };

  const albumGroups = useMemo(() => {
    const groups = new Map<string, Track[]>();
    tracks.forEach((track) => {
      const album = getAlbum(track);
      if (!album) return;
      groups.set(album, [...(groups.get(album) || []), track]);
    });
    return Array.from(groups.entries()).map(([name, albumTracks]) => ({
      name,
      tracks: albumTracks,
      coverTrack: albumTracks.find(track => track.imageUrl || playerState.getTrackImage(track.id)) || albumTracks[0],
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, playerState.metadataVersion]);

  const selectedAlbumGroup = selectedAlbum
    ? albumGroups.find(album => album.name === selectedAlbum)
    : null;

  const playTracks = (tracks: Track[]) => {
    if (tracks.length === 0) return;
    if (playerState.isShuffle) {
      const shuffled = [...tracks].sort(() => getSecureRandom() - 0.5);
      playerState.playTrack(shuffled[0], shuffled);
    } else {
      playerState.playTrack(tracks[0], tracks);
    }
  };

  const shuffleTracks = (tracks: Track[]) => {
    if (tracks.length === 0) return;
    playerState.setIsShuffle(true);
    const shuffled = [...tracks].sort(() => getSecureRandom() - 0.5);
    playerState.playTrack(shuffled[0], shuffled);
  };

  const handleBack = () => {
    if (selectedAlbum) {
      setSelectedAlbum(null);
      return;
    }
    navigate('/library');
  };

  const albumTracksList = selectedAlbumGroup?.tracks || [];
  const {
    containerRef: albumTracksContainerRef,
    handleScroll: handleAlbumTracksScroll,
    offsetY: albumTracksOffsetY,
    totalHeight: albumTracksTotalHeight,
    visibleIndexes: albumTracksVisibleIndexes,
  } = useVirtualList({
    itemCount: albumTracksList.length,
    itemHeight: ALBUM_TRACK_ROW_HEIGHT,
  });

  return (
    <div className="w-full h-full flex flex-col max-w-6xl 2xl:max-w-none mx-auto pb-28 md:pb-32 overflow-y-auto no-scrollbar">
      <div className="mb-6 md:mb-8 border-b border-white/[0.06] pb-4 md:pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white shrink-0">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-white tracking-tight">
              {selectedAlbumGroup ? selectedAlbumGroup.name : 'Albums'}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm font-mono mt-0.5">
              {selectedAlbumGroup
                ? `${selectedAlbumGroup.tracks.length} songs in this album.`
                : `${albumGroups.length} albums in your library.`}
            </p>
          </div>
        </div>
        {selectedAlbumGroup && (
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 pb-1 sm:pb-0">
            <button
              onClick={() => playTracks(selectedAlbumGroup.tracks)}
              className="px-3.5 h-8.5 rounded-xl bg-primary text-slate-950 hover:brightness-110 flex items-center gap-1.5 transition-all text-xs font-bold shadow-[0_0_15px_rgba(0,245,255,0.3)] whitespace-nowrap hover:scale-105 active:scale-95"
              title="Play Album"
            >
              <Play size={13} fill="currentColor" /> Play
            </button>
            <button
              onClick={() => shuffleTracks(selectedAlbumGroup.tracks)}
              className="px-3.5 h-8.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-200 hover:bg-white/[0.12] hover:text-white flex items-center gap-1.5 transition-all text-xs font-semibold whitespace-nowrap"
              title="Shuffle Album"
            >
              <Shuffle size={13} /> Shuffle
            </button>
            <ActionMenu
              ariaLabel="More album actions"
              buttonClassName="h-8.5 w-8.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:bg-white/[0.12] hover:text-white flex items-center justify-center transition-all"
              actions={[
                { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(selectedAlbumGroup.tracks) },
                { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(selectedAlbumGroup.tracks) },
              ]}
            />
          </div>
        )}
      </div>

      {selectedAlbumGroup ? (
        <div
          ref={albumTracksContainerRef}
          onScroll={handleAlbumTracksScroll}
          className="relative w-full"
          style={{ height: albumTracksTotalHeight }}
        >
          <div
            className="absolute inset-x-0 top-0 will-change-transform"
            style={{ transform: `translateY(${albumTracksOffsetY}px)` }}
          >
            {albumTracksVisibleIndexes.map((idx) => {
              const track = albumTracksList[idx];
              if (!track) return null;
              const isActive = playerState.currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  style={{ height: ALBUM_TRACK_ROW_HEIGHT }}
                  className="relative"
                >
                  <div
                    onClick={() => playerState.playTrack(track, selectedAlbumGroup.tracks)}
                    className={`flex h-[64px] items-center gap-3 sm:gap-3.5 p-2.5 sm:p-3 rounded-xl border transition-all duration-200 group cursor-pointer ${isActive
                      ? 'bg-primary/15 border-primary/30 text-primary shadow-[inset_0_0_15px_rgba(0,245,255,0.1)]'
                      : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.06] hover:border-primary/25 backdrop-blur-md'
                      }`}
                  >
                    <div className="w-5 text-center shrink-0">
                      {isActive && playerState.isPlaying ? (
                        <div className="flex items-end justify-center gap-0.5 h-3">
                          <span className="w-0.5 bg-primary rounded-full animate-eq-1" />
                          <span className="w-0.5 bg-primary rounded-full animate-eq-2" />
                          <span className="w-0.5 bg-primary rounded-full animate-eq-3" />
                        </div>
                      ) : (
                        <span className="hidden sm:block text-[11px] font-mono text-slate-500">{idx + 1}</span>
                      )}
                    </div>
                    <button
                      aria-label="Play track"
                      onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, selectedAlbumGroup.tracks); }}
                      className="hidden md:group-hover:flex w-5 items-center justify-center rounded-full transition-colors text-primary"
                    >
                      <Play size={13} fill="currentColor" />
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-sm">
                      {track.imageUrl || playerState.getTrackImage(track.id) ? (
                        <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <ListMusic size={16} className="text-slate-500" />
                      )}
                    </div>
                    <div className="flex flex-col truncate flex-1 pr-2">
                      <span className={`text-xs sm:text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-slate-100'}`}>
                        {getTitle(track)}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[11px] text-slate-400">
                        <span className="truncate">{getArtist(track)}</span>
                      </div>
                    </div>
                    <ActionMenu
                      ariaLabel={`Song actions for ${getTitle(track)}`}
                      buttonClassName="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                      actions={[
                        { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue([track]) },
                        { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue([track]) },
                        { label: 'Add to Playlist', icon: <ListPlus size={14} />, onSelect: () => setTrackToPlaylist(track) },
                        ...(track.sourceType !== 'LOCAL'
                          ? [{
                              label: favorites.some(f => f.id === track.id) ? 'Remove Favorite' : 'Add to Favorite',
                              icon: <Heart size={14} fill={favorites.some(f => f.id === track.id) ? "currentColor" : "none"} className={favorites.some(f => f.id === track.id) ? "text-primary" : "text-slate-400"} />,
                              onSelect: () => void toggleFavorite(track)
                            }]
                          : [])
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : albumGroups.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 4k:grid-cols-10 gap-3.5 md:gap-4.5">
          {albumGroups.map((album, i) => {
            const track = album.coverTrack;
            return (
              <div
                key={album.name}
                className="group cursor-pointer p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-amber-500/40 hover:bg-white/[0.05] transition-all duration-300 backdrop-blur-md hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(245,158,11,0.12)]"
                onClick={() => setSelectedAlbum(album.name)}
              >
                <div className="relative w-full aspect-square mb-2.5 rounded-xl overflow-hidden shadow-md">
                  <div
                    className="w-full h-full flex items-center justify-center relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 60%, 15%) 0%, hsl(${(i * 47 + 60) % 360}, 80%, 8%) 100%)` }}
                  >
                    {track?.imageUrl || playerState.getTrackImage(track.id) ? (
                      <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt={album.name} className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-30 text-amber-400">
                        <Album size={48} />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionMenu
                      ariaLabel={`Album actions for ${album.name}`}
                      direction="up"
                      buttonClassName="h-8.5 w-8.5 rounded-full bg-amber-500 text-slate-950 hover:scale-110 flex items-center justify-center shadow-lg transition-all"
                      actions={[
                        { label: 'Play', icon: <Play size={13} fill="currentColor" />, onSelect: () => playerState.playTrack(album.tracks[0], album.tracks) },
                        { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(album.tracks) },
                        { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(album.tracks) },
                      ]}
                    />
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-100 truncate group-hover:text-amber-400 transition-colors">{album.name}</p>
                <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">{album.tracks.length} songs</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50 py-16">
          <Album size={56} className="mb-3 text-amber-400" />
          <p className="text-sm font-mono text-slate-400">No albums found in your library.</p>
        </div>
      )}

      <AddToPlaylistModal
        isOpen={!!trackToPlaylist}
        onClose={() => setTrackToPlaylist(null)}
        track={trackToPlaylist}
      />
    </div>
  );
}
