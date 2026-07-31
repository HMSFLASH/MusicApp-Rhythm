import { useCallback, useEffect, useRef, useMemo, useState } from 'react';

interface LyricsViewProps {
  lyrics: string;
  currentTime: number;
  duration?: number;
  onSeek?: (time: number) => void;
}

interface LyricLine {
  time: number;
  text: string;
}

export function LyricsView({ lyrics, currentTime, duration = 0, onSeek }: LyricsViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousActiveIndexRef = useRef(-1);
  const lastSeekTimeRef = useRef(0);
  const isAutoScrollingRef = useRef(false);
  const layoutScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const timestampRegex = /\[\s*(\d{1,3}):(\d{2})(?:[:.,](\d{1,3}))?\s*\]/g;
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
          const seconds = parseInt(match[2], 10);
          const fractionRaw = match[3];
          let fraction = 0;
          if (fractionRaw) {
            if (fractionRaw.length === 1) fraction = parseInt(fractionRaw, 10) / 10;
            else if (fractionRaw.length === 2) fraction = parseInt(fractionRaw, 10) / 100;
            else fraction = parseInt(fractionRaw, 10) / 1000;
          }
          parsed.push({ time: Math.max(0, minutes * 60 + seconds + fraction + offsetSeconds), text });
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

  const unsyncedLines = useMemo(() => {
    if (parsedLyrics.isSynced) return [];
    return lyrics.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  }, [lyrics, parsedLyrics.isSynced]);

  const activeIndex = useMemo(() => {
    if (parsedLyrics.isSynced) {
      for (let i = parsedLyrics.lines.length - 1; i >= 0; i--) {
        if (parsedLyrics.lines[i].time >= 0 && currentTime >= parsedLyrics.lines[i].time) {
          return i;
        }
      }
      return -1;
    }
    if (!duration || duration <= 0 || unsyncedLines.length === 0) return -1;
    const progress = Math.min(0.999, Math.max(0, currentTime / duration));
    return Math.floor(progress * unsyncedLines.length);
  }, [parsedLyrics, currentTime, duration, unsyncedLines.length]);

  useEffect(() => {
    setIsUserScrolling(false);
    previousActiveIndexRef.current = -1;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
  }, [lyrics]);

  const scrollToActiveLine = useCallback((behavior: ScrollBehavior) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const activeEl = container.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null;
    if (!activeEl) {
      if (!parsedLyrics.isSynced && duration > 0 && container.scrollHeight > container.clientHeight) {
        const progress = Math.min(1, Math.max(0, currentTime / duration));
        const targetTop = progress * (container.scrollHeight - container.clientHeight);
        isAutoScrollingRef.current = true;
        container.scrollTo({ top: targetTop, behavior });
        if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
        autoScrollTimeoutRef.current = setTimeout(() => {
          isAutoScrollingRef.current = false;
        }, behavior === 'smooth' ? 500 : 80);
      }
      return;
    }

    const targetTop = Math.max(
      0,
      activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2)
    );
    isAutoScrollingRef.current = true;
    container.scrollTo({ top: targetTop, behavior });
    if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    autoScrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, behavior === 'smooth' ? 500 : 80);
  }, [activeIndex, parsedLyrics.isSynced, duration, currentTime]);

  useEffect(() => {
    if (isUserScrolling || activeIndex === -1 || !containerRef.current) {
      previousActiveIndexRef.current = activeIndex;
      return;
    }

    const container = containerRef.current;
    const activeEl = container.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null;
    if (!activeEl) {
      if (!parsedLyrics.isSynced && duration > 0) {
        scrollToActiveLine('smooth');
      }
      previousActiveIndexRef.current = activeIndex;
      return;
    }

    const targetTop = Math.max(
      0,
      activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2)
    );
    const distance = Math.abs(container.scrollTop - targetTop);
    const indexJump = Math.abs(activeIndex - previousActiveIndexRef.current);
    const recentlySeeked = performance.now() - lastSeekTimeRef.current < 700;
    const shouldJump = indexJump > 3 || recentlySeeked || distance > container.clientHeight;
    const behavior: ScrollBehavior = shouldJump ? 'auto' : 'smooth';

    scrollToActiveLine(behavior);

    if (layoutScrollTimeoutRef.current) clearTimeout(layoutScrollTimeoutRef.current);
    if (shouldJump) {
      layoutScrollTimeoutRef.current = setTimeout(() => {
        if (!isUserScrolling) scrollToActiveLine('auto');
      }, 550);
    }

    previousActiveIndexRef.current = activeIndex;
  }, [activeIndex, isUserScrolling, scrollToActiveLine, parsedLyrics.isSynced, duration]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeIndex === -1 || isUserScrolling || typeof ResizeObserver === 'undefined') {
      return;
    }

    let frameId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        if (!isUserScrolling) scrollToActiveLine('auto');
      });
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [activeIndex, isUserScrolling, scrollToActiveLine]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
      if (layoutScrollTimeoutRef.current) clearTimeout(layoutScrollTimeoutRef.current);
    };
  }, []);

  const linesToRender = parsedLyrics.isSynced 
    ? parsedLyrics.lines 
    : unsyncedLines.map((text) => ({ time: -1, text }));

  return (
    <div 
      ref={containerRef} 
      onWheel={handleUserInteraction}
      onTouchMove={handleUserInteraction}
      onPointerDown={handleUserInteraction}
      className="flex-1 w-full h-full flex flex-col gap-6 overflow-y-auto overflow-x-hidden scroll-smooth pt-8 pb-8 relative mask-image-fade scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent hover:scrollbar-thumb-white/40"
      style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}
    >
      {linesToRender.map((line, idx) => {
        const isActive = idx === activeIndex;
        const isPassed = idx < activeIndex;
        const canSeek = parsedLyrics.isSynced ? (line.time >= 0) : (!!onSeek && duration > 0 && unsyncedLines.length > 0);

        return (
          <div 
            key={idx} 
            data-index={idx}
            onClick={() => {
              if (onSeek) {
                lastSeekTimeRef.current = performance.now();
                setIsUserScrolling(false);
                if (parsedLyrics.isSynced && line.time >= 0) {
                  onSeek(line.time);
                } else if (!parsedLyrics.isSynced && duration > 0 && unsyncedLines.length > 0) {
                  const targetTime = (idx / unsyncedLines.length) * duration;
                  onSeek(targetTime);
                }
              }
            }}
            className={`max-w-[85%] mx-auto transition-all duration-500 text-center md:text-lg font-bold ${canSeek ? 'cursor-pointer hover:text-white/80' : ''} ${isActive ? 'text-primary scale-110 drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]' : isPassed ? 'text-white/40' : 'text-white/20'}`}
          >
            {line.text || '...'}
          </div>
        );
      })}
    </div>
  );
}
