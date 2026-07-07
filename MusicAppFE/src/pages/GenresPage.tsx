import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Music, Play } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import type { Track } from '../hooks/useAudioPlayer';
import { axiosClient } from '../api/axiosClient';

export function GenresPage() {
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

    const handleMetadataUpdated = () => {
      setTracks(prev => [...prev]);
    };
    window.addEventListener('sonic_metadata_updated', handleMetadataUpdated);
    
    return () => {
      window.removeEventListener('sonic_metadata_updated', handleMetadataUpdated);
    };
  }, []);

  const genres = Array.from(new Set(tracks.map(t => t.genre || playerState.getTrackMetadata(t.id)?.genre).filter(Boolean))) as string[];

  const handlePlayGenre = (genre: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const genreTracks = tracks.filter(t => t.genre === genre || playerState.getTrackMetadata(t.id)?.genre === genre);
    if (genreTracks.length > 0) {
      playerState.playTrack(genreTracks[0], genreTracks);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto pb-32 overflow-y-auto">
      <div className="mb-6 md:mb-8 border-b border-white/10 pb-4 md:pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-3">
            <button onClick={() => navigate('/library')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            Genres
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 ml-12">
            {genres.length} genres in your library.
          </p>
        </div>
      </div>

      {genres.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {genres.map((genre, i) => {
            const count = tracks.filter(t => t.genre === genre || playerState.getTrackMetadata(t.id)?.genre === genre).length;
            const hue = (i * 137.5) % 360;
            const color1 = `hsl(${hue}, 85%, 60%)`;
            const color2 = `hsl(${(hue + 45) % 360}, 85%, 50%)`;
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-3xl p-6 cursor-pointer group hover:scale-[1.02] transition-all duration-300 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${color1}, ${color2})`, boxShadow: `0 12px 30px -10px ${color1}88` }}
                onClick={(e) => handlePlayGenre(genre, e)}
              >
                <div className="absolute -right-4 -bottom-4 opacity-[0.15] group-hover:opacity-[0.25] group-hover:rotate-6 group-hover:scale-110 transition-all duration-500 text-white">
                  <Music size={120} />
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between gap-6 md:gap-8">
                  <h3 className="text-xl md:text-2xl font-bold text-white break-words drop-shadow-md">
                    {genre}
                  </h3>

                  <div className="flex items-center justify-between">
                    <span className="text-xs md:text-sm font-medium text-white/90 bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm">{count} songs</span>
                    <button className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all transform translate-y-0 md:translate-y-4 md:group-hover:translate-y-0 shadow-xl bg-white text-black hover:scale-105"
                      >
                      <Play size={18} className="ml-1" fill="currentColor" />
                    </button>
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
    </div>
  );
}
