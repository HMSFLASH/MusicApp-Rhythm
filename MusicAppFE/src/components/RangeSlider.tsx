import React, { useRef, useEffect, useState, useCallback } from 'react';

interface RangeSliderProps {
  value: [number, number];
  min: number;
  max: number;
  onChange: (val: [number, number]) => void;
  label: string;
  color?: string;
  unit?: string;
  mode?: 'inside' | 'outside';
  isLogarithmic?: boolean;
}

export function RangeSlider({ 
  value, 
  min, 
  max, 
  onChange, 
  label, 
  color = '#00f5ff',
  unit = 'Hz',
  mode = 'inside',
  isLogarithmic = true
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = useState<'min' | 'max' | null>(null);

  const valueToPercent = useCallback((val: number) => {
    if (isLogarithmic) {
      if (val <= 0 || min <= 0) return 0;
      return ((Math.log(val) - Math.log(min)) / (Math.log(max) - Math.log(min))) * 100;
    }
    return ((val - min) / (max - min)) * 100;
  }, [min, max, isLogarithmic]);

  const percentToValue = useCallback((pct: number) => {
    let val;
    if (isLogarithmic) {
      if (min <= 0) return min;
      val = Math.exp(Math.log(min) + (pct / 100) * (Math.log(max) - Math.log(min)));
    } else {
      val = min + (pct / 100) * (max - min);
    }
    return Math.round(val);
  }, [min, max, isLogarithmic]);

  const minPercent = valueToPercent(value[0]);
  const maxPercent = valueToPercent(value[1]);

  const handleMove = useCallback((clientX: number) => {
    if (!activeThumb || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    let newX = clientX - rect.left;
    newX = Math.max(0, Math.min(newX, rect.width));
    
    const pct = (newX / rect.width) * 100;
    const newValue = percentToValue(pct);
    
    if (activeThumb === 'min') {
      onChange([Math.min(newValue, value[1] - 1), value[1]]);
    } else {
      onChange([value[0], Math.max(newValue, value[0] + 1)]);
    }
  }, [activeThumb, percentToValue, onChange, value]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    handleMove(e.clientX);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  }, [handleMove]);

  const handleEnd = useCallback(() => {
    setActiveThumb(null);
  }, []);

  useEffect(() => {
    if (activeThumb) {
      globalThis.addEventListener('pointermove', handlePointerMove);
      globalThis.addEventListener('pointerup', handleEnd);
      globalThis.addEventListener('touchmove', handleTouchMove, { passive: false });
      globalThis.addEventListener('touchend', handleEnd);
      globalThis.addEventListener('touchcancel', handleEnd);
    } else {
      globalThis.removeEventListener('pointermove', handlePointerMove);
      globalThis.removeEventListener('pointerup', handleEnd);
      globalThis.removeEventListener('touchmove', handleTouchMove);
      globalThis.removeEventListener('touchend', handleEnd);
      globalThis.removeEventListener('touchcancel', handleEnd);
    }
    return () => {
      globalThis.removeEventListener('pointermove', handlePointerMove);
      globalThis.removeEventListener('pointerup', handleEnd);
      globalThis.removeEventListener('touchmove', handleTouchMove);
      globalThis.removeEventListener('touchend', handleEnd);
      globalThis.removeEventListener('touchcancel', handleEnd);
    };
  }, [activeThumb, handlePointerMove, handleTouchMove, handleEnd]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const clickPct = ((e.clientX - rect.left) / rect.width) * 100;
    
    const distMin = Math.abs(clickPct - minPercent);
    const distMax = Math.abs(clickPct - maxPercent);
    
    const targetThumb = distMin <= distMax ? 'min' : 'max';
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveThumb(targetThumb);
    
    const newValue = percentToValue(clickPct);
    if (targetThumb === 'min') {
      onChange([Math.min(newValue, value[1] - 1), value[1]]);
    } else {
      onChange([value[0], Math.max(newValue, value[0] + 1)]);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const clickPct = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
      
      const distMin = Math.abs(clickPct - minPercent);
      const distMax = Math.abs(clickPct - maxPercent);
      
      const targetThumb = distMin <= distMax ? 'min' : 'max';
      setActiveThumb(targetThumb);
      
      const newValue = percentToValue(clickPct);
      if (targetThumb === 'min') {
        onChange([Math.min(newValue, value[1] - 1), value[1]]);
      } else {
        onChange([value[0], Math.max(newValue, value[0] + 1)]);
      }
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  return (
    <div className="flex flex-col gap-2 w-full select-none group">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">{label}</span>
        <span className="text-xs font-mono font-semibold text-slate-300">
          {formatNumber(value[0])} - {formatNumber(value[1])} <span className="text-slate-400 font-normal">{unit}</span>
        </span>
      </div>

      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        className="relative h-6 w-full flex items-center cursor-pointer touch-none"
      >
        <div className="absolute left-0 right-0 h-[5px] bg-white/[0.08] rounded-full"></div>
        
        {mode === 'inside' ? (
          <div 
            className={`absolute h-[5px] rounded-full pointer-events-none ${!activeThumb ? 'transition-all duration-75' : ''}`}
            style={{ 
              left: `${minPercent}%`,
              width: `${maxPercent - minPercent}%`,
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}`
            }}
          ></div>
        ) : (
          <>
            <div 
              className={`absolute h-[5px] rounded-full pointer-events-none ${!activeThumb ? 'transition-all duration-75' : ''}`}
              style={{ 
                left: `0%`,
                width: `${minPercent}%`,
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}`
              }}
            ></div>
            <div 
              className={`absolute h-[5px] rounded-full pointer-events-none ${!activeThumb ? 'transition-all duration-75' : ''}`}
              style={{ 
                left: `${maxPercent}%`,
                width: `${100 - maxPercent}%`,
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}`
              }}
            ></div>
          </>
        )}

        <div 
          className={`absolute w-5 h-9 bg-[#0c1626] rounded-xl border border-white/25 shadow-2xl pointer-events-none flex flex-col items-center justify-center ${activeThumb === 'min' ? 'border-primary/60 scale-105' : 'group-hover:border-primary/40'} ${!activeThumb ? 'transition-transform duration-75' : ''}`}
          style={{ 
            left: `${minPercent}%`,
            transform: 'translateX(-50%)',
            zIndex: activeThumb === 'min' ? 10 : 1
          }}
        >
          <div className="w-[2px] h-3.5 bg-primary rounded-full shadow-[0_0_6px_rgba(0,245,255,0.8)]"></div>
        </div>

        <div 
          className={`absolute w-5 h-9 bg-[#0c1626] rounded-xl border border-white/25 shadow-2xl pointer-events-none flex flex-col items-center justify-center ${activeThumb === 'max' ? 'border-primary/60 scale-105' : 'group-hover:border-primary/40'} ${!activeThumb ? 'transition-transform duration-75' : ''}`}
          style={{ 
            left: `${maxPercent}%`,
            transform: 'translateX(-50%)',
            zIndex: activeThumb === 'max' ? 10 : 1
          }}
        >
          <div className="w-[2px] h-3.5 bg-primary rounded-full shadow-[0_0_6px_rgba(0,245,255,0.8)]"></div>
        </div>
      </div>
      
      <div className="relative h-4 font-mono text-[10px] text-slate-400 mt-1.5 font-medium">
        <span className="absolute left-0">{formatNumber(min)}</span>
        <span className="absolute right-0">{formatNumber(max)}</span>
      </div>
    </div>
  );
}
