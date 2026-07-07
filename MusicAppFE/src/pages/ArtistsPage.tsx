import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic2, Play } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import type { Track } from '../hooks/useAudioPlayer';
import { axiosClient } from '../api/axiosClient';

export function ArtistsPage() {
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    const cached = localStorage.getItem('sonic_library_tracks');
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, no-empty
      try { setTracks(JSON.parse(cached)); } catch (e) { }
    }
    axiosClient.get('/api/music/list')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        const parsed = data.length > 0 ? (typeof data[0] === 'string' ? JSON.parse(data[0]) : data) : [];
        setTracks(parsed);
      })
      .catch(console.error);
  }, []);

  const artists = Array.from(new Set(
    tracks.map(t => t.artist || playerState.getTrackMetadata(t.id)?.artist || (t.fileName?.includes(' - ') ? t.fileName.split(' - ')[0] : null))
      .filter(Boolean)
  )) as string[];

  const handlePlayArtist = (artist: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const artistTracks = tracks.filter(t => t.artist === artist || playerState.getTrackMetadata(t.id)?.artist === artist || t.fileName?.startsWith(artist + ' - '));
    if (artistTracks.length > 0) {
      playerState.playTrack(artistTracks[0], artistTracks);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto pb-32 overflow-y-auto">
      <div className="mb-8 border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-3">
            <button onClick={() => navigate('/library')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            Artists
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 ml-12">
            {artists.length} artists in your library.
          </p>
        </div>
      </div>

      {artists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {artists.map((artist, i) => (
            <div key={i} className="flex flex-col items-center gap-3 cursor-pointer group" onClick={(e) => handlePlayArtist(artist, e)}>
              <div className="w-full aspect-square rounded-full border-4 border-white/5 group-hover:border-[#10b981]/60 transition-all flex items-center justify-center overflow-hidden relative"
                style={{ background: `linear-gradient(135deg, hsl(${(i * 37) % 360}, 70%, 25%) 0%, hsl(${(i * 37 + 80) % 360}, 90%, 15%) 100%)` }}>
                <span className="text-5xl font-bold text-white/50 group-hover:text-white/80 transition-colors">{artist[0]}</span>
                
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="w-12 h-12 bg-[#10b981] rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform">
                    <Play size={20} fill="white" className="ml-1 text-white" />
                  </div>
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
    </div>
  );
}
