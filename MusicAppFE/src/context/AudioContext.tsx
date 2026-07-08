import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAuth } from './AuthContext';

interface AudioContextType {
  playerState: ReturnType<typeof useAudioPlayer>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const { jwtToken, driveToken, fetchDriveToken } = useAuth();
  const playerState = useAudioPlayer(jwtToken, driveToken, fetchDriveToken);

  return (
    <AudioContext.Provider value={{ playerState }}>
      {children}
    </AudioContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGlobalAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useGlobalAudio must be used within an AudioProvider');
  }
  return context;
}
