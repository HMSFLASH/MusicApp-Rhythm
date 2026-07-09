import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mic2, Play, Cloud, ListMusic, ListPlus, Shuffle } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useLibrary } from '../context/LibraryContext';
import type { Track } from '../hooks/useAudioPlayer';

export function ArtistsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { playerState } = useGlobalAudio();
  const { tracks } = useLibrary();
  const [selectedArtist, setSelectedArtist] = useState<string | null>(location.state?.selectedArtist || null);

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

  const handlePlayArtist = (artist: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const artistTracks = getArtistTracks(artist);
    if (artistTracks.length > 0) {
      if (playerState.isShuffle) {
        const shuffled = [...artistTracks].sort(() => Math.random() - 0.5);
        playerState.playTrack(shuffled[0], shuffled);
      } else {
        playerState.playTrack(artistTracks[0], artistTracks);
      }
    }
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
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto pb-32 overflow-y-auto">
      <div className="mb-8 border-b border-white/10 pb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-3">
            <button onClick={handleBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            {selectedArtist || 'Artists'}
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 ml-12">
            {selectedArtist
              ? `${selectedArtistTracks.length} songs by this artist.`
              : `${artists.length} artists in your library.`}
          </p>
        </div>
        {selectedArtist && (
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={() => {
                if (playerState.isShuffle) {
                  const shuffled = [...selectedArtistTracks].sort(() => Math.random() - 0.5);
                  playerState.playTrack(shuffled[0], shuffled);
                } else {
                  playerState.playTrack(selectedArtistTracks[0], selectedArtistTracks);
                }
              }}
              className="px-3 h-8 rounded-full bg-[#10b981] text-black hover:bg-[#10b981]/90 flex items-center gap-1.5 transition-all text-sm font-bold shadow-lg shadow-[#10b981]/20"
              title="Play Artist"
            >
              <Play size={14} fill="currentColor" /> Play
            </button>
            <button
              onClick={() => {
                playerState.setIsShuffle(true);
                const shuffled = [...selectedArtistTracks].sort(() => Math.random() - 0.5);
                playerState.playTrack(shuffled[0], shuffled);
              }}
              className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold"
              title="Shuffle Artist"
            >
              <Shuffle size={14} /> Shuffle
            </button>
            <button
              onClick={() => playerState.addToCurrentQueue(selectedArtistTracks)}
              className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold"
              title="Add to Queue"
            >
              <ListPlus size={14} /> Add to Queue
            </button>
            <button
              onClick={() => playerState.addToNextQueue(selectedArtistTracks)}
              className="px-3 h-8 rounded-full bg-white/10 text-white hover:bg-white hover:text-black flex items-center gap-1.5 transition-all text-sm font-bold"
              title="Play Next"
            >
              <ListMusic size={14} /> Play Next
            </button>
          </div>
        )}
      </div>

      {selectedArtist ? (
        <div className="flex flex-col gap-1.5">
          {selectedArtistTracks.map((track, idx) => (
            <div
              key={track.id}
              onClick={() => playerState.playTrack(track, selectedArtistTracks)}
              className={`flex items-center gap-4 p-3 rounded-xl border transition-colors group cursor-pointer ${playerState.currentTrack?.id === track.id
                ? 'bg-[#10b981]/10 border-[#10b981]/30'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
            >
              <span className="text-xs text-white/20 w-5 text-right md:group-hover:hidden">{idx + 1}</span>
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
              <div className="flex flex-col truncate flex-1">
                <span className={`text-sm font-medium truncate ${playerState.currentTrack?.id === track.id ? 'text-[#10b981]' : 'text-white'}`}>
                  {getTitle(track)}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <Cloud size={12} className="text-blue-400" />
                  <span className="text-xs text-white/30 truncate">{getArtist(track)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : artists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {artists.map((artist, i) => (
            <div key={i} className="flex flex-col items-center gap-3 cursor-pointer group" onClick={() => setSelectedArtist(artist)}>
              <div className="relative w-full aspect-square">
                <div className="w-full h-full rounded-full border-4 border-white/5 group-hover:border-[#10b981]/60 transition-all flex items-center justify-center overflow-hidden relative"
                  style={{ background: `linear-gradient(135deg, hsl(${(i * 37) % 360}, 70%, 25%) 0%, hsl(${(i * 37 + 80) % 360}, 90%, 15%) 100%)` }}>
                  <span className="text-5xl font-bold text-white/50 group-hover:text-white/80 transition-colors">{artist[0]}</span>
                  
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 hidden lg:flex">
                    <button onClick={(e) => { e.stopPropagation(); playerState.addToCurrentQueue(getArtistTracks(artist)); }} className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Thêm vào hàng chờ hiện tại">
                      <ListPlus size={14} className="text-white" />
                    </button>
                    <button onClick={(e) => handlePlayArtist(artist, e)} className="w-12 h-12 bg-[#10b981] rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Phát">
                      <Play size={20} fill="white" className="ml-1 text-white" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); playerState.addToNextQueue(getArtistTracks(artist)); }} className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Thêm vào hàng chờ tiếp theo">
                      <ListMusic size={14} className="text-white" />
                    </button>
                  </div>
                </div>
                <button onClick={(e) => handlePlayArtist(artist, e)} className="absolute bottom-0 right-0 lg:hidden z-10">
                  <div className="w-9 h-9 bg-[#10b981] rounded-full flex items-center justify-center shadow-lg border-2 border-[#121212]">
                    <Play size={14} fill="white" className="ml-0.5 text-white" />
                  </div>
                </button>
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
    </div>
  );
}
