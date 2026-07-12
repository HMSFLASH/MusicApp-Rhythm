import { useEffect, useRef, useMemo, useState } from 'react';

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
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousActiveIndexRef = useRef(-1);
  const lastSeekTimeRef = useRef(0);
  const isAutoScrollingRef = useRef(false);

  const handleUserInteraction = () => {
    if (isAutoScrollingRef.current) return;
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 5000);
  };


  const parsedLyrics = useMemo(() => {
    const lines = lyrics.split('\n');
    const parsed: LyricLine[] = [];
    const timestampRegex = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
    const metadataRegex = /^\[[a-zA-Z]+:.*\]$/;
    const offsetMatch = lyrics.match(/\[offset:([+-]?\d+)\]/i);
    const offsetSeconds = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
    
    let isSynced = false;
    
    for (const line of lines) {
      const matches = [...line.matchAll(timestampRegex)];
      if (matches.length > 0) {
        isSynced = true;
        const text = line.replace(timestampRegex, '').trim();
        for (const match of matches) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseFloat(match[2]);
          parsed.push({ time: Math.max(0, minutes * 60 + seconds + offsetSeconds), text });
        }
      } else if (line.trim() !== '' && !metadataRegex.test(line.trim())) {
        parsed.push({ time: -1, text: line.trim() });
      }
    }
    
    return {
      isSynced,
      lines: isSynced ? parsed.sort((a, b) => a.time - b.time) : parsed,
    };
  }, [lyrics]);

  const activeIndex = useMemo(() => {
    if (!parsedLyrics.isSynced) return -1;
    for (let i = parsedLyrics.lines.length - 1; i >= 0; i--) {
      if (parsedLyrics.lines[i].time >= 0 && currentTime >= parsedLyrics.lines[i].time) {
        return i;
      }
    }
    return -1;
  }, [parsedLyrics, currentTime]);

  useEffect(() => {
    setIsUserScrolling(false);
    previousActiveIndexRef.current = -1;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
  }, [lyrics]);

  useEffect(() => {
    if (isUserScrolling || !parsedLyrics.isSynced || activeIndex === -1 || !containerRef.current) {
      previousActiveIndexRef.current = activeIndex;
      return;
    }

    const container = containerRef.current;
    const activeEl = container.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null;
    if (!activeEl) return;

    const targetTop = Math.max(
      0,
      activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2)
    );
    const distance = Math.abs(container.scrollTop - targetTop);
    const indexJump = Math.abs(activeIndex - previousActiveIndexRef.current);
    const recentlySeeked = performance.now() - lastSeekTimeRef.current < 700;
    const behavior: ScrollBehavior = indexJump > 3 || recentlySeeked || distance > container.clientHeight
      ? 'auto'
      : 'smooth';

    isAutoScrollingRef.current = true;
    container.scrollTo({ top: targetTop, behavior });
    if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    autoScrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, behavior === 'smooth' ? 500 : 80);

    previousActiveIndexRef.current = activeIndex;
  }, [activeIndex, parsedLyrics.isSynced, isUserScrolling]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    };
  }, []);

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
      onWheel={handleUserInteraction}
      onTouchMove={handleUserInteraction}
      onPointerDown={handleUserInteraction}
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
                lastSeekTimeRef.current = performance.now();
                setIsUserScrolling(false);
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
