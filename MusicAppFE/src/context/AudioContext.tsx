import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

interface AudioContextType {
  jwtToken: string;
  setJwtToken: (token: string) => void;
  playerState: ReturnType<typeof useAudioPlayer>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [jwtToken, setJwtTokenState] = useState(() => {
    return localStorage.getItem('music_app_token') || '';
  });

  const setJwtToken = (token: string) => {
    if (token) {
      localStorage.setItem('music_app_token', token);
    } else {
      localStorage.removeItem('music_app_token');
    }
    setJwtTokenState(token);
  };
  const playerState = useAudioPlayer(jwtToken);

  return (
    <AudioContext.Provider value={{ jwtToken, setJwtToken, playerState }}>
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
