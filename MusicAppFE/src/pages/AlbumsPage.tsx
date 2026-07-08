import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Album, Play, ListPlus, ListMusic } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import type { Track } from '../hooks/useAudioPlayer';
import { useLibrary } from '../context/LibraryContext';

export function AlbumsPage() {
  const navigate = useNavigate();
  const { playerState } = useGlobalAudio();
  const { tracks } = useLibrary();

  const albums = Array.from(new Set(tracks.map(t => t.album || playerState.getTrackMetadata(t.id)?.album).filter(Boolean))) as string[];

  const handlePlayAlbum = (album: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const albumTracks = tracks.filter(t => t.album === album || playerState.getTrackMetadata(t.id)?.album === album);
    if (albumTracks.length > 0) {
      playerState.playTrack(albumTracks[0], albumTracks);
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
            Albums
          </h1>
          <p className="text-secondary/60 text-sm font-mono mt-1 ml-12">
            {albums.length} albums in your library.
          </p>
        </div>
      </div>

      {albums.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {albums.map((album, i) => {
            const track = tracks.find(t => t.album === album || playerState.getTrackMetadata(t.id)?.album === album);
            return (
              <div key={i} className="group cursor-pointer" onClick={(e) => handlePlayAlbum(album, e)}>
                <div className={`w-full aspect-square rounded-2xl mb-3 flex items-center justify-center border border-white/5 group-hover:border-[#f59e0b]/40 transition-all relative overflow-hidden bg-gradient-to-br`}
                  style={{ background: `linear-gradient(135deg, hsl(${(i * 47) % 360}, 60%, 20%) 0%, hsl(${(i * 47 + 60) % 360}, 80%, 10%) 100%)` }}>
                  {track?.imageUrl ? (
                    <img src={track.imageUrl} alt={album} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-30">
                      <Album size={64} className="text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); const albumTracks = tracks.filter(t => t.album === album || playerState.getTrackMetadata(t.id)?.album === album); playerState.addToCurrentQueue(albumTracks); }} className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Thêm vào hàng chờ hiện tại">
                      <ListPlus size={16} className="text-white" />
                    </button>
                    <button onClick={(e) => handlePlayAlbum(album, e)} className="w-12 h-12 bg-[#f59e0b] rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Phát album">
                      <Play size={20} fill="white" className="ml-1 text-white" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); const albumTracks = tracks.filter(t => t.album === album || playerState.getTrackMetadata(t.id)?.album === album); playerState.addToNextQueue(albumTracks); }} className="w-10 h-10 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center hover:scale-110 shadow-lg transition-transform mx-1" title="Thêm vào hàng chờ tiếp theo">
                      <ListMusic size={16} className="text-white" />
                    </button>
                  </div>
                </div>
                <p className="text-base font-semibold text-white truncate group-hover:text-[#f59e0b] transition-colors">{album}</p>
                <p className="text-sm text-white/40 truncate">{track?.artist || (track && playerState.getTrackMetadata(track.id)?.artist) || (track?.fileName?.includes(' - ') ? track.fileName.split(' - ')[0] : 'Unknown')}</p>
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
    </div>
  );
}
