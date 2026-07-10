import { useEffect, useRef, useMemo } from 'react';

interface LyricsViewProps {
  lyrics: string;
  currentTime: number;
  onSeek?: (time: number) => void;
}

interface LyricLine {
  time: number;
  text: string;
}

export function LyricsView({ lyrics, currentTime, onSeek }: LyricsViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const parsedLyrics = useMemo(() => {
    const lines = lyrics.split('\n');
    const parsed: LyricLine[] = [];
    const lrcRegex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)/;
    
    let isSynced = false;
    
    for (const line of lines) {
      const match = lrcRegex.exec(line);
      if (match) {
        isSynced = true;
        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2]);
        const text = match[3].trim();
        parsed.push({ time: minutes * 60 + seconds, text });
      } else if (line.trim() !== '') {
        // Unsynced line
        parsed.push({ time: -1, text: line.trim() });
      }
    }
    
    return { isSynced, lines: parsed };
  }, [lyrics]);

  const activeIndex = useMemo(() => {
    if (!parsedLyrics.isSynced) return -1;
    // Find the last line whose time is <= currentTime
    for (let i = parsedLyrics.lines.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLyrics.lines[i].time) {
        return i;
      }
    }
    return -1;
  }, [parsedLyrics, currentTime]);

  useEffect(() => {
    if (parsedLyrics.isSynced && activeIndex !== -1 && containerRef.current) {
      const activeEl = containerRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement;
      if (activeEl) {
        containerRef.current.scrollTo({
          top: activeEl.offsetTop - containerRef.current.clientHeight / 2 + activeEl.clientHeight / 2,
          behavior: 'smooth'
        });
      }
    }
  }, [activeIndex, parsedLyrics.isSynced]);

  if (!parsedLyrics.isSynced) {
    return (
      <div 
        className="text-white/80 font-medium whitespace-pre-wrap leading-relaxed text-center overflow-y-auto overflow-x-hidden flex-1 w-full py-8 relative mask-image-fade scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/40"
        style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}
      >
        {lyrics}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="flex-1 w-full h-full flex flex-col gap-6 overflow-y-auto overflow-x-hidden scroll-smooth pt-8 pb-8 relative mask-image-fade scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/40"
      style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}
    >
      {parsedLyrics.lines.map((line, idx) => {
        const isActive = idx === activeIndex;
        const isPassed = idx < activeIndex;
        return (
          <div 
            key={idx} 
            data-index={idx}
            onClick={() => {
              if (onSeek && line.time >= 0) {
                onSeek(line.time);
              }
            }}
            className={`max-w-[85%] mx-auto transition-all duration-500 text-center md:text-lg font-bold ${onSeek && line.time >= 0 ? 'cursor-pointer hover:text-white/80' : ''} ${isActive ? 'text-primary scale-110 drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]' : isPassed ? 'text-white/40' : 'text-white/20'}`}
          >
            {line.text || '...'}
          </div>
        );
      })}
    </div>
  );
}
