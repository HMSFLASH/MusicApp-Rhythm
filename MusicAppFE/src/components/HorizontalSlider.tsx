import React, { useRef, useEffect, useState, useCallback } from 'react';
import { formatNumberInput, parseDecimalInput } from './NumberInput';

interface HorizontalSliderProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label: string;
  color?: string;
  unit?: string;
  step?: number;
  hideLabels?: boolean;
}

export function HorizontalSlider({ 
  value, 
  min, 
  max, 
  onChange, 
  label, 
  color = '#00f5ff',
  unit = 'dB',
  step = 1,
  hideLabels = false
}: HorizontalSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const range = max - min;
  const isBidirectional = min < 0 && max > 0;
  
  const percentage = isBidirectional
    ? value <= 0
      ? ((value - min) / Math.abs(min)) * 50
      : 50 + (value / max) * 50
    : ((value - min) / range) * 100;

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    let newX = clientX - rect.left;
    newX = Math.max(0, Math.min(newX, rect.width));
    
    const pct = newX / rect.width;
    let newValue = min < 0 && max > 0
      ? pct <= 0.5
        ? min + (pct / 0.5) * Math.abs(min)
        : ((pct - 0.5) / 0.5) * max
      : min + (pct * range);
    
    if (step > 0) {
      newValue = Math.round(newValue / step) * step;
    }
    
    // Fix floating point errors like 1.2000000000000002
    newValue = Number(newValue.toFixed(5));
    
    onChange(newValue);
  }, [isDragging, min, max, range, onChange, step]);

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
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
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
  }, [isDragging, handlePointerMove, handleTouchMove, handleEnd]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    handleMove(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      handleMove(e.touches[0].clientX);
    }
  };

  const handleEditClick = () => {
    setInputValue(formatNumberInput(value));
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseDecimalInput(inputValue);
    if (parsed !== null) {
      let newValue = Math.max(min, Math.min(parsed, max));
      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }
      newValue = Number(formatNumberInput(newValue));
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Center point logic for bi-directional active track
  // Only use bidirectional center tracking if min < 0 and max > 0 (e.g. dB gain)
  const zeroPct = isBidirectional ? 50 : 0;
  
  // Calculate width and left for the filled portion
  const isPositive = value >= 0;
  let fillLeft = 0;
  let fillWidth = percentage;
  
  if (isBidirectional) {
    fillLeft = isPositive ? zeroPct : percentage;
    fillWidth = isPositive ? percentage - zeroPct : zeroPct - percentage;
  }

  const formattedValue = unit === 'dB' && value > 0 ? `+${formatNumberInput(value)}` : formatNumberInput(value);

  return (
    <div className="flex flex-col gap-2 w-full select-none group">
      {!hideLabels && (
        <div className="flex justify-between items-end mb-1.5">
          <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">{label}</span>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.replace(/,/g, '.'))}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                className="w-16 bg-[#0c1626] text-primary text-xs font-mono text-right border border-primary/50 rounded-lg outline-none h-6 px-1.5 shadow-sm"
              />
              <span className="text-xs font-mono text-slate-400">{unit}</span>
            </div>
          ) : (
            <span 
              onClick={handleEditClick}
              className="text-xs font-mono font-semibold text-slate-300 cursor-pointer hover:text-primary transition-colors"
            >
              {formattedValue} <span className="text-slate-400 font-normal">{unit}</span>
            </span>
          )}
        </div>
      )}

      {/* Track Container */}
      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        className="relative h-6 w-full flex items-center cursor-pointer touch-none"
      >
        {/* Background dark track */}
        <div className="absolute left-0 right-0 h-[5px] bg-white/[0.08] rounded-full"></div>
        
        {/* Center zero mark (only if bidirectional) */}
        {isBidirectional && (
          <div 
            className="absolute -translate-x-1/2 w-1 h-3.5 bg-white/25 rounded-full"
            style={{ left: `${zeroPct}%` }}
          ></div>
        )}

        {/* Active Track (Colored from 0 to value) */}
        <div 
          className={`absolute h-[5px] rounded-full pointer-events-none ${!isDragging ? 'transition-all duration-75' : ''}`}
          style={{ 
            left: `${fillLeft}%`,
            width: `${fillWidth}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`
          }}
        ></div>

        {/* Thumb */}
        <div 
          className={`absolute w-5 h-9 bg-[#0c1626] rounded-xl border border-white/25 shadow-2xl pointer-events-none flex flex-col items-center justify-center group-hover:border-primary/60 group-hover:scale-105 ${!isDragging ? 'transition-transform duration-75' : ''}`}
          style={{ 
            left: `${percentage}%`,
            transform: 'translateX(-50%)'
          }}
        >
          {/* Thumb vertical line */}
          <div className="w-[2px] h-3.5 bg-primary rounded-full shadow-[0_0_6px_rgba(0,245,255,0.8)]"></div>
        </div>
      </div>
      
      {!hideLabels && (
        <div className="relative h-4 font-mono text-[10px] text-slate-400 mt-1.5 font-medium">
          <span className="absolute left-0">{min}</span>
          {isBidirectional && (
            <span 
              className="absolute -translate-x-1/2" 
              style={{ left: `${zeroPct}%` }}
            >
              0
            </span>
          )}
          <span className="absolute right-0">{unit === 'dB' && max > 0 ? `+${max}` : max}</span>
        </div>
      )}
    </div>
  );
}
