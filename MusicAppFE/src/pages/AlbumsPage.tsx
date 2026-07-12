import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Album, Cloud, ListMusic, ListPlus, Play, Shuffle, Heart } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../hooks/useAudioPlayer';
import { ActionMenu } from '../components/ActionMenu';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';

export function AlbumsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playerState } = useGlobalAudio();
  const { tracks, favorites, toggleFavorite } = useLibrary();
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(location.state?.selectedAlbum || null);
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);

  const getAlbum = (track: Track) => track.album || playerState.getTrackMetadata(track.id)?.album || '';
  const getArtist = (track: Track) => (
    track.artist ||
    playerState.getTrackMetadata(track.id)?.artist ||
    (track.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown Artist')
  );
  const getTitle = (track: Track) => (
    track.title ||
    playerState.getTrackMetadata(track.id)?.title ||
    (track.fileName ? (track.fileName.includes(' - ') ? track.fileName.split(' - ')[1].replace(/\.[^/.]+$/, "") : track.fileName.replace(/\.[^/.]+$/, "")) : 'Unknown Title')
  );

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
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      playerState.playTrack(shuffled[0], shuffled);
    } else {
      playerState.playTrack(tracks[0], tracks);
    }
  };

  const shuffleTracks = (tracks: Track[]) => {
    if (tracks.length === 0) return;
    playerState.setIsShuffle(true);
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    playerState.playTrack(shuffled[0], shuffled);
  };

  const handleBack = () => {
    if (selectedAlbum) {
      setSelectedAlbum(null);
      return;
    }
    navigate('/library');
  };

  return (
    <div className="w-full h-full flex flex-col max-w-6xl 2xl:max-w-none mx-auto pb-28 md:pb-32 overflow-y-auto">
      <div className="mb-6 md:mb-8 border-b border-white/10 pb-4 md:pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-2 md:gap-3">
            <button onClick={handleBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white shrink-0">
              <ArrowLeft size={24} />
            </button>
            <span className="truncate">{selectedAlbumGroup ? selectedAlbumGroup.name : 'Albums'}</span>
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 sm:ml-12">
            {selectedAlbumGroup
              ? `${selectedAlbumGroup.tracks.length} songs in this album.`
              : `${albumGroups.length} albums in your library.`}
          </p>
        </div>
        {selectedAlbumGroup && (
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 pb-1 sm:pb-0">
            <button
              onClick={() => playTracks(selectedAlbumGroup.tracks)}
              className="px-3 h-8 rounded-full bg-primary text-black hover:bg-primary/90 flex items-center gap-1.5 transition-all text-sm font-bold shadow-lg shadow-primary/20 whitespace-nowrap"
              title="Play Album"
            >
              <Play size={14} fill="currentColor" /> Play
            </button>
            <button
              onClick={() => shuffleTracks(selectedAlbumGroup.tracks)}
              className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold whitespace-nowrap"
              title="Shuffle Album"
            >
              <Shuffle size={14} /> Shuffle
            </button>
            <ActionMenu
              ariaLabel="More album actions"
              buttonClassName="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center justify-center transition-all"
              actions={[
                { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(selectedAlbumGroup.tracks) },
                { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(selectedAlbumGroup.tracks) },
              ]}
            />
          </div>
        )}
      </div>

      {selectedAlbumGroup ? (
        <div className="flex flex-col gap-1.5">
          {selectedAlbumGroup.tracks.map((track, idx) => (
            <div
              key={track.id}
              onClick={() => playerState.playTrack(track, selectedAlbumGroup.tracks)}
              className={`flex items-center gap-3 sm:gap-4 p-3 rounded-xl border transition-colors group cursor-pointer ${playerState.currentTrack?.id === track.id
                ? 'bg-primary/10 border-primary/30'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
            >
              <span className="hidden sm:block text-xs text-white/20 w-5 text-right md:group-hover:hidden">{idx + 1}</span>
              <button
                aria-label="Play track"
                onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, selectedAlbumGroup.tracks); }}
                className="hidden md:group-hover:flex w-5 items-center justify-center rounded-full transition-colors text-white"
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
              <div className="flex flex-col truncate flex-1 pr-2">
                <span className={`text-sm font-medium truncate ${playerState.currentTrack?.id === track.id ? 'text-primary' : 'text-white'}`}>
                  {getTitle(track)}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <Cloud size={12} className="text-blue-400" />
                  <span className="text-xs text-white/30 truncate">{getArtist(track)}</span>
                </div>
              </div>
              <ActionMenu
                ariaLabel={`Song actions for ${getTitle(track)}`}
                buttonClassName="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
                actions={[
                  { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue([track]) },
                  { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue([track]) },
                  { label: 'Add to Playlist', icon: <ListPlus size={14} />, onSelect: () => setTrackToPlaylist(track) },
                  ...(track.sourceType !== 'LOCAL'
                    ? [{
                        label: favorites.some(f => f.id === track.id) ? 'Remove Favorite' : 'Add to Favorite',
                        icon: <Heart size={14} fill={favorites.some(f => f.id === track.id) ? "currentColor" : "none"} className={favorites.some(f => f.id === track.id) ? "text-primary" : ""} />,
                        onSelect: () => void toggleFavorite(track)
                      }]
                    : [])
                ]}
              />
            </div>
          ))}
        </div>
      ) : albumGroups.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-8 4k:grid-cols-10 gap-4 md:gap-6">
          {albumGroups.map((album, i) => {
            const track = album.coverTrack;
            return (
              <div key={album.name} className="group cursor-pointer" onClick={() => setSelectedAlbum(album.name)}>
                <div className="relative w-full aspect-square mb-3">
                  <div className={`w-full h-full rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-[#f59e0b]/40 transition-all relative overflow-hidden bg-gradient-to-br`}
                    style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 60%, 20%) 0%, hsl(${(i * 47 + 60) % 360}, 80%, 10%) 100%)` }}>
                    {track?.imageUrl || playerState.getTrackImage(track.id) ? (
                      <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt={album.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-30">
                        <Album size={64} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2 z-10">
                    <ActionMenu
                      ariaLabel={`Album actions for ${album.name}`}
                      direction="up"
                      buttonClassName="h-10 w-10 rounded-full bg-[#f59e0b] text-white hover:scale-105 flex items-center justify-center shadow-lg transition-all"
                      actions={[
                        { label: 'Play', icon: <Play size={14} fill="currentColor" />, onSelect: () => playerState.playTrack(album.tracks[0], album.tracks) },
                        { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(album.tracks) },
                        { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(album.tracks) },
                      ]}
                    />
                  </div>
                </div>
                <p className="text-base font-semibold text-white truncate group-hover:text-[#f59e0b] transition-colors">{album.name}</p>
                <p className="text-sm text-white/40 truncate">{album.tracks.length} songs</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
          <Album size={64} className="mb-4 text-[#f59e0b]" />
          <p>No albums found in your library.</p>
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
