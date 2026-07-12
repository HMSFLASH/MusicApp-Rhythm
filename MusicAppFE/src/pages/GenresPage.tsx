import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Play, Cloud, ListMusic, ListPlus, Shuffle, Heart } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../hooks/useAudioPlayer';
import { ActionMenu } from '../components/ActionMenu';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';

export function GenresPage() {
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const { tracks, favorites, toggleFavorite } = useLibrary();
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);

  const genres = Array.from(new Set(tracks.map(t => t.genre || playerState.getTrackMetadata(t.id)?.genre).filter(Boolean))) as string[];

  const getGenreTracks = (genre: string) => tracks.filter(t => t.genre === genre || playerState.getTrackMetadata(t.id)?.genre === genre);

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

  const playTracks = (genreTracks: Track[]) => {
    if (genreTracks.length === 0) return;
    if (playerState.isShuffle) {
      const shuffled = [...genreTracks].sort(() => Math.random() - 0.5);
      playerState.playTrack(shuffled[0], shuffled);
    } else {
      playerState.playTrack(genreTracks[0], genreTracks);
    }
  };

  const shuffleTracks = (genreTracks: Track[]) => {
    if (genreTracks.length === 0) return;
    playerState.setIsShuffle(true);
    const shuffled = [...genreTracks].sort(() => Math.random() - 0.5);
    playerState.playTrack(shuffled[0], shuffled);
  };

  const selectedGenreTracks = selectedGenre ? getGenreTracks(selectedGenre) : [];

  const handleBack = () => {
    if (selectedGenre) {
      setSelectedGenre(null);
      return;
    }
    navigate('/library');
  };

  return (
    <div className="w-full h-full flex flex-col max-w-6xl 2xl:max-w-none mx-auto pb-28 md:pb-32 overflow-y-auto">
      <div className="mb-6 md:mb-8 border-b border-white/10 pb-4 md:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-2 md:gap-3">
            <button onClick={handleBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white shrink-0">
              <ArrowLeft size={24} />
            </button>
            <span className="truncate">{selectedGenre || 'Genres'}</span>
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 sm:ml-12">
            {selectedGenre
              ? `${selectedGenreTracks.length} songs in this genre.`
              : `${genres.length} genres in your library.`}
          </p>
        </div>
        {selectedGenre && (
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 pb-1 sm:pb-0">
            <button
              onClick={() => playTracks(selectedGenreTracks)}
              className="px-3 h-8 rounded-full bg-[#ec4899] text-white hover:bg-[#ec4899]/90 flex items-center gap-1.5 transition-all text-sm font-bold shadow-lg shadow-[#ec4899]/20 whitespace-nowrap"
              title="Play Genre"
            >
              <Play size={14} fill="currentColor" /> Play
            </button>
            <button
              onClick={() => shuffleTracks(selectedGenreTracks)}
              className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold whitespace-nowrap"
              title="Shuffle Genre"
            >
              <Shuffle size={14} /> Shuffle
            </button>
            <ActionMenu
              ariaLabel="More genre actions"
              buttonClassName="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center justify-center transition-all"
              actions={[
                { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(selectedGenreTracks) },
                { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(selectedGenreTracks) },
              ]}
            />
          </div>
        )}
      </div>

      {selectedGenre ? (
        <div className="flex flex-col gap-1.5">
          {selectedGenreTracks.map((track, idx) => (
            <div
              key={track.id}
              onClick={() => playerState.playTrack(track, selectedGenreTracks)}
              className={`flex items-center gap-3 sm:gap-4 p-3 rounded-xl border transition-colors group cursor-pointer ${playerState.currentTrack?.id === track.id
                ? 'bg-[#ec4899]/10 border-[#ec4899]/30'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
            >
              <span className="hidden sm:block text-xs text-white/20 w-5 text-right md:group-hover:hidden">{idx + 1}</span>
              <button
                aria-label="Play track"
                onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, selectedGenreTracks); }}
                className="hidden md:group-hover:flex w-5 items-center justify-center rounded-full transition-colors text-white"
              >
                <Play size={13} fill="currentColor" />
              </button>
              <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                {track.imageUrl || playerState.getTrackImage(track.id) ? (
                  <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <Music size={16} className="text-white/40" />
                )}
              </div>
              <div className="flex flex-col truncate flex-1 pr-2">
                <span className={`text-sm font-medium truncate ${playerState.currentTrack?.id === track.id ? 'text-[#ec4899]' : 'text-white'}`}>
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
                        icon: <Heart size={14} fill={favorites.some(f => f.id === track.id) ? "currentColor" : "none"} className={favorites.some(f => f.id === track.id) ? "text-[#ec4899]" : ""} />,
                        onSelect: () => void toggleFavorite(track)
                      }]
                    : [])
                ]}
              />
            </div>
          ))}
        </div>
      ) : genres.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4k:grid-cols-8 gap-4 md:gap-6">
          {genres.map((genre, i) => {
            const count = getGenreTracks(genre).length;
            const hue = (i * 137.5) % 360;
            const color1 = `hsl(${hue}, 85%, 60%)`;
            const color2 = `hsl(${(hue + 45) % 360}, 85%, 50%)`;
            return (
              <div
                key={i}
                className="relative rounded-2xl md:rounded-3xl p-5 md:p-6 cursor-pointer group hover:scale-[1.02] transition-all duration-300 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${color1}, ${color2})`, boxShadow: `0 12px 30px -10px ${color1}88` }}
                onClick={() => setSelectedGenre(genre)}
              >
                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                  <div className="absolute -right-4 -bottom-4 opacity-[0.15] group-hover:opacity-[0.25] group-hover:rotate-6 group-hover:scale-110 transition-all duration-500 text-white">
                    <Music size={120} />
                  </div>
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between gap-6 md:gap-8 pointer-events-none">
                  <h3 className="text-xl md:text-2xl font-bold text-white break-words drop-shadow-md">
                    {genre}
                  </h3>

                  <div className="flex items-center justify-between pointer-events-auto">
                    <span className="text-xs md:text-sm font-medium text-white/90 bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm">{count} songs</span>
                    <ActionMenu
                      ariaLabel={`Genre actions for ${genre}`}
                      direction="up"
                      buttonClassName="h-10 w-10 rounded-full bg-white text-black hover:scale-105 flex items-center justify-center shadow-xl transition-all"
                      actions={[
                        { label: 'Play', icon: <Play size={14} fill="currentColor" />, onSelect: () => playTracks(getGenreTracks(genre)) },
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
        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
          <Music size={64} className="mb-4 text-[#ec4899]" />
          <p>No genres found in your library.</p>
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
