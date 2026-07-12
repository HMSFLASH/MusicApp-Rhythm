import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mic2, Play, Cloud, ListMusic, ListPlus, Shuffle, Heart } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../hooks/useAudioPlayer';
import { ActionMenu } from '../components/ActionMenu';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';

export function ArtistsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playerState } = useGlobalAudio();
  const { tracks, favorites, toggleFavorite } = useLibrary();
  const [selectedArtist, setSelectedArtist] = useState<string | null>(location.state?.selectedArtist || null);
  const [trackToPlaylist, setTrackToPlaylist] = useState<Track | null>(null);

  const artists = Array.from(new Set(
    tracks.map(t => t.artist || playerState.getTrackMetadata(t.id)?.artist || (t.fileName?.includes(' - ') ? t.fileName.split(' - ')[0] : null))
      .filter(Boolean)
  )) as string[];

  const getArtistTracks = (artist: string) => tracks.filter(t => t.artist === artist || playerState.getTrackMetadata(t.id)?.artist === artist || t.fileName?.startsWith(artist + ' - '));

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

  const playTracks = (artistTracks: Track[]) => {
    if (artistTracks.length === 0) return;
    if (playerState.isShuffle) {
      const shuffled = [...artistTracks].sort(() => Math.random() - 0.5);
      playerState.playTrack(shuffled[0], shuffled);
    } else {
      playerState.playTrack(artistTracks[0], artistTracks);
    }
  };

  const shuffleTracks = (artistTracks: Track[]) => {
    if (artistTracks.length === 0) return;
    playerState.setIsShuffle(true);
    const shuffled = [...artistTracks].sort(() => Math.random() - 0.5);
    playerState.playTrack(shuffled[0], shuffled);
  };

  const selectedArtistTracks = selectedArtist ? getArtistTracks(selectedArtist) : [];

  const handleBack = () => {
    if (selectedArtist) {
      setSelectedArtist(null);
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
            <span className="truncate">{selectedArtist || 'Artists'}</span>
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 sm:ml-12">
            {selectedArtist
              ? `${selectedArtistTracks.length} songs by this artist.`
              : `${artists.length} artists in your library.`}
          </p>
        </div>
        {selectedArtist && (
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2 pb-1 sm:pb-0">
            <button
              onClick={() => playTracks(selectedArtistTracks)}
              className="px-3 h-8 rounded-full bg-[#10b981] text-black hover:bg-[#10b981]/90 flex items-center gap-1.5 transition-all text-sm font-bold shadow-lg shadow-[#10b981]/20 whitespace-nowrap"
              title="Play Artist"
            >
              <Play size={14} fill="currentColor" /> Play
            </button>
            <button
              onClick={() => shuffleTracks(selectedArtistTracks)}
              className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold whitespace-nowrap"
              title="Shuffle Artist"
            >
              <Shuffle size={14} /> Shuffle
            </button>
            <ActionMenu
              ariaLabel="More artist actions"
              buttonClassName="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center justify-center transition-all"
              actions={[
                { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(selectedArtistTracks) },
                { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(selectedArtistTracks) },
              ]}
            />
          </div>
        )}
      </div>

      {selectedArtist ? (
        <div className="flex flex-col gap-1.5">
          {selectedArtistTracks.map((track, idx) => (
            <div
              key={track.id}
              onClick={() => playerState.playTrack(track, selectedArtistTracks)}
              className={`flex items-center gap-3 sm:gap-4 p-3 rounded-xl border transition-colors group cursor-pointer ${playerState.currentTrack?.id === track.id
                ? 'bg-[#10b981]/10 border-[#10b981]/30'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
            >
              <span className="hidden sm:block text-xs text-white/20 w-5 text-right md:group-hover:hidden">{idx + 1}</span>
              <button
                aria-label="Play track"
                onClick={(e) => { e.stopPropagation(); playerState.playTrack(track, selectedArtistTracks); }}
                className="hidden md:group-hover:flex w-5 items-center justify-center rounded-full transition-colors text-white"
              >
                <Play size={13} fill="currentColor" />
              </button>
              <div className="w-10 h-10 rounded-md bg-white/5 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                {track.imageUrl || playerState.getTrackImage(track.id) ? (
                  <img src={track.imageUrl || playerState.getTrackImage(track.id)} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <Mic2 size={16} className="text-white/40" />
                )}
              </div>
              <div className="flex flex-col truncate flex-1 pr-2">
                <span className={`text-sm font-medium truncate ${playerState.currentTrack?.id === track.id ? 'text-[#10b981]' : 'text-white'}`}>
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
                        icon: <Heart size={14} fill={favorites.some(f => f.id === track.id) ? "currentColor" : "none"} className={favorites.some(f => f.id === track.id) ? "text-[#10b981]" : ""} />,
                        onSelect: () => void toggleFavorite(track)
                      }]
                    : [])
                ]}
              />
            </div>
          ))}
        </div>
      ) : artists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 3xl:grid-cols-10 4k:grid-cols-12 gap-4 md:gap-6">
          {artists.map((artist, i) => (
            <div key={i} className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => setSelectedArtist(artist)}>
              <div className="relative w-full aspect-square">
                <div className="w-full h-full rounded-full border-4 border-white/5 group-hover:border-[#10b981]/60 transition-all flex items-center justify-center overflow-hidden relative"
                  style={{ background: `linear-gradient(135deg, hsl(${(i * 37) % 360}, 70%, 25%) 0%, hsl(${(i * 37 + 80) % 360}, 90%, 15%) 100%)` }}>
                  <span className="text-5xl font-bold text-white/50 group-hover:text-white/80 transition-colors">{artist[0]}</span>
                  
                </div>
                <div className="absolute bottom-0 right-0 z-10">
                  <ActionMenu
                    ariaLabel={`Artist actions for ${artist}`}
                    direction="up"
                    buttonClassName="h-9 w-9 rounded-full bg-[#10b981] text-white flex items-center justify-center shadow-lg border-2 border-[#121212] hover:scale-105 transition-all"
                    actions={[
                      { label: 'Play', icon: <Play size={14} fill="currentColor" />, onSelect: () => playTracks(getArtistTracks(artist)) },
                      { label: 'Add to Queue', icon: <ListPlus size={14} />, onSelect: () => playerState.addToCurrentQueue(getArtistTracks(artist)) },
                      { label: 'Play Next', icon: <ListMusic size={14} />, onSelect: () => playerState.addToNextQueue(getArtistTracks(artist)) },
                    ]}
                  />
                </div>
              </div>
              <span className="text-sm font-semibold text-white/80 group-hover:text-white text-center w-full truncate px-2">{artist}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
          <Mic2 size={64} className="mb-4 text-[#10b981]" />
          <p>No artists found in your library.</p>
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
