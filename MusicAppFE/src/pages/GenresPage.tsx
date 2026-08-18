import { getSecureRandom } from '../utils/randomUtils';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Play, ListMusic, ListPlus, Shuffle, Heart } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../hooks/useAudioPlayer';
import { ActionMenu } from '../components/ActionMenu';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { useVirtualList } from '../hooks/useVirtualList';

const GENRE_TRACK_ROW_HEIGHT = 72;

export function GenresPage() {
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const { tracks, favorites, toggleFavorite } = useLibrary();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);

  const genres = Array.from(new Set(tracks.map(t => t.genre || playerState.getTrackMetadata(t.id)?.genre).filter(Boolean))) as string[];

  const getGenreTracks = (genre: string) => tracks.filter(t => t.genre === genre || playerState.getTrackMetadata(t.id)?.genre === genre);

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

  const playTracks = (genreTracks: Track[]) => {
    if (genreTracks.length === 0) return;
    if (playerState.isShuffle) {
      const shuffled = [...genreTracks].sort(() => getSecureRandom() - 0.5);
      playerState.playTrack(shuffled[0], shuffled);
    } else {
      playerState.playTrack(genreTracks[0], genreTracks);
    }
  };

  const shuffleTracks = (genreTracks: Track[]) => {
    if (genreTracks.length === 0) return;
    playerState.setIsShuffle(true);
    const shuffled = [...genreTracks].sort(() => getSecureRandom() - 0.5);
    playerState.playTrack(shuffled[0], shuffled);
  };

  const selectedGenreTracks = selectedGenre ? getGenreTracks(selectedGenre) : [];

  const {
    containerRef: genreTracksContainerRef,
    handleScroll: handleGenreTracksScroll,
    offsetY: genreTracksOffsetY,
    totalHeight: genreTracksTotalHeight,
    visibleIndexes: genreTracksVisibleIndexes,
  } = useVirtualList({
    itemCount: selectedGenreTracks.length,
    itemHeight: GENRE_TRACK_ROW_HEIGHT,
  });

  const handleBack = () => {
    if (selectedGenre) {
      setSelectedGenre(null);
      return;
    }
    navigate('/library');
  };

  return (
    <div className="w-full h-full flex flex-col max-w-6xl 2xl:max-w-none mx-auto pb-28 md:pb-32 overflow-y-auto no-scrollbar">
      <div className="mb-6 md:mb-8 border-b border-white/[0.06] pb-4 md:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white shrink-0">
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-white tracking-tight">
              {selectedGenre || 'Genres'}
            </h1>
            <p className="text-slate-400 text-xs md:text-sm font-mono mt-0.5">
              {selectedGenre
                ? `${selectedGenreTracks.length} songs in this genre.`
                : `${genres.length} genres in your library.`}
            </p>
          </div>
        </div>
        {selectedGenre && (
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 pb-1 sm:pb-0">
            <button
              onClick={() => playTracks(selectedGenreTracks)}
              className="px-3.5 h-8.5 rounded-xl bg-primary text-slate-950 hover:brightness-110 flex items-center gap-1.5 transition-all text-xs font-bold shadow-[0_0_15px_rgba(0,245,255,0.3)] whitespace-nowrap hover:scale-105 active:scale-95"
              title="Play Genre"
            >
              <Play size={13} fill="currentColor" /> Play
            </button>
            <button
              onClick={() => shuffleTracks(selectedGenreTracks)}
              className="px-3.5 h-8.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-200 hover:bg-white/[0.12] hover:text-white flex items-center gap-1.5 transition-all text-xs font-semibold whitespace-nowrap"
              title="Shuffle Genre"
            >
              <Shuffle size={13} /> Shuffle
            </button>
            <ActionMenu
              ariaLabel="More genre actions"
              buttonClassName="h-8.5 w-8.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:bg-white/[0.12] hover:text-white flex items-center justify-center transition-all"
              actions={[
                { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(selectedGenreTracks) },
                { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(selectedGenreTracks) },
              ]}
            />
          </div>
        )}
      </div>

      {selectedGenre ? (
        <div
          ref={genreTracksContainerRef}
          onScroll={handleGenreTracksScroll}
          className="relative w-full"
          style={{ height: genreTracksTotalHeight }}
        >
          <div
            className="absolute inset-x-0 top-0 will-change-transform"
            style={{ transform: `translateY(${genreTracksOffsetY}px)` }}
          >
            {genreTracksVisibleIndexes.map((idx) => {
              const track = selectedGenreTracks[idx];
              if (!track) return null;
              const isActive = playerState.currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  style={{ height: GENRE_TRACK_ROW_HEIGHT }}
                  className="relative"
                >
                  <div
                    onClick={() => playerState.playTrack(track, selectedGenreTracks)}
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
                      onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, selectedGenreTracks); }}
                      className="hidden md:group-hover:flex w-5 items-center justify-center rounded-full transition-colors text-primary"
                    >
                      <Play size={13} fill="currentColor" />
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden border border-white/10 shadow-sm">
                      {track.imageUrl || playerState.getTrackImage(track.id) ? (
                        <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Music size={16} className="text-slate-500" />
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
      ) : genres.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4k:grid-cols-8 gap-3.5 md:gap-4.5">
          {genres.map((genre, i) => {
            const count = getGenreTracks(genre).length;
            const hue = (i * 137.5) % 360;
            return (
              <div
                key={i}
                className="relative rounded-2xl p-5 cursor-pointer group hover:scale-[1.02] transition-all duration-300 shadow-lg border border-white/[0.08] overflow-hidden backdrop-blur-md"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue}, 60%, 16%) 0%, hsl(${(hue + 45) % 360}, 70%, 8%) 100%)`,
                  boxShadow: `0 10px 25px -10px hsl(${hue}, 60%, 20%)`
                }}
                onClick={() => setSelectedGenre(genre)}
              >
                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                  <div className="absolute -right-4 -bottom-4 opacity-[0.12] group-hover:opacity-[0.22] group-hover:rotate-6 group-hover:scale-110 transition-all duration-500 text-white">
                    <Music size={110} />
                  </div>
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between gap-5 pointer-events-none">
                  <h3 className="text-lg md:text-xl font-bold font-display text-white break-words drop-shadow">
                    {genre}
                  </h3>

                  <div className="flex items-center justify-between pointer-events-auto">
                    <span className="text-xs font-mono font-medium text-slate-300 bg-black/40 border border-white/10 px-2.5 py-1 rounded-lg backdrop-blur-sm shadow-sm">{count} songs</span>
                    <ActionMenu
                      ariaLabel={`Genre actions for ${genre}`}
                      direction="up"
                      buttonClassName="h-8.5 w-8.5 rounded-full bg-white text-slate-950 hover:scale-110 flex items-center justify-center shadow-lg transition-all"
                      actions={[
                        { label: 'Play', icon: <Play size={13} fill="currentColor" />, onSelect: () => playTracks(getGenreTracks(genre)) },
                        { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(getGenreTracks(genre)) },
                        { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(getGenreTracks(genre)) },
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50 py-16">
          <Music size={56} className="mb-3 text-purple-400" />
          <p className="text-sm font-mono text-slate-400">No genres found in your library.</p>
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
