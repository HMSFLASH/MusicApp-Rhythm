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
  }, []);

  const genres = Array.from(new Set(tracks.map(t => t.genre).filter(Boolean))) as string[];

  const handlePlayGenre = (genre: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const genreTracks = tracks.filter(t => t.genre === genre);
    if (genreTracks.length > 0) {
      playerState.playTrack(genreTracks[0], genreTracks);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-8 max-w-6xl mx-auto pb-32 overflow-y-auto">
      <div className="mb-8 border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-sans text-white tracking-tight flex items-center gap-3">
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
            const count = tracks.filter(t => t.genre === genre).length;
            const color = `hsl(${(i * 85) % 360}, 70%, 60%)`;
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-2xl p-6 cursor-pointer group hover:scale-105 transition-transform"
                style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`, border: `1px solid ${color}44` }}
                onClick={(e) => handlePlayGenre(genre, e)}
              >
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity" style={{ color: color }}>
                  <Music size={120} />
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                  <h3 className="text-2xl font-bold text-white break-words" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                    {genre}
                  </h3>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/60">{count} songs</span>
                    <button className="w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0 shadow-lg"
                      style={{ backgroundColor: color }}>
                      <Play size={18} fill="white" className="ml-1 text-white" />
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
