import { useGlobalAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { Playlist } from '../components/Playlist';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PlaylistPage() {
  const { isAuthenticated } = useAuth();
  const { playerState } = useGlobalAudio();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl 2xl:max-w-none mx-auto pb-28 md:pb-32">
      <div className="mb-6 md:mb-8 flex items-center gap-3 md:gap-4">
        <button 
          onClick={() => navigate('/library')} 
          className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors text-white shrink-0"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold font-sans text-white tracking-tight truncate">Your Playlist</h1>
          <p className="text-secondary/60 text-sm font-mono mt-1">Manage and sync your Dual-Storage tracks.</p>
        </div>
      </div>
      
      <Playlist 
        isAuthenticated={isAuthenticated}
        onPlay={playerState.playTrack}
        currentTrackId={playerState.currentTrack?.id}
      />
    </div>
  );
}
