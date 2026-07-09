import React, { useRef, useEffect, useState, useCallback } from 'react';

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

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left;
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

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    } else {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handlePointerMove(e.nativeEvent);
  };

  const handleEditClick = () => {
    setInputValue(value.toString());
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
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      let newValue = Math.max(min, Math.min(parsed, max));
      if (step > 0) {
        newValue = Math.round(newValue / step) * step;
      }
      newValue = Number(newValue.toFixed(5));
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

  const formattedValue = unit === 'dB' && value > 0 ? `+${value}` : value;

  return (
    <div className="flex flex-col gap-2 w-full select-none group">
      {!hideLabels && (
        <div className="flex justify-between items-end mb-1">
          <span className="text-sm font-mono text-white/80 uppercase tracking-widest">{label}</span>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleInputBlur}
                onKeyDown={handleKeyDown}
                className="w-14 bg-black/50 text-white text-xs font-mono text-right border border-white/20 rounded outline-none h-5 px-1"
              />
              <span className="text-xs font-mono text-white/40">{unit}</span>
            </div>
          ) : (
            <span 
              onClick={handleEditClick}
              className="text-xs font-mono text-white/60 cursor-pointer hover:text-white transition-colors"
            >
              {formattedValue} {unit}
            </span>
          )}
        </div>
      )}

      {/* Track Container */}
      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className="relative h-6 w-full flex items-center cursor-pointer touch-none"
      >
        {/* Background dark track */}
        <div className="absolute left-0 right-0 h-[4px] bg-white/10 rounded-full"></div>
        
        {/* Center zero mark (only if bidirectional) */}
        {isBidirectional && (
          <div 
            className="absolute -translate-x-1/2 w-1 h-3 bg-white/30 rounded-full"
            style={{ left: `${zeroPct}%` }}
          ></div>
        )}

        {/* Active Track (Colored from 0 to value) */}
        <div 
          className="absolute h-[4px] rounded-full pointer-events-none transition-all duration-75"
          style={{ 
            left: `${fillLeft}%`,
            width: `${fillWidth}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}80`
          }}
        ></div>

        {/* Thumb */}
        <div 
          className="absolute w-4 h-8 bg-[#1a1a1a] rounded-md border border-white/20 shadow-lg pointer-events-none flex flex-col items-center justify-center transition-transform duration-75 group-hover:border-white/40"
          style={{ 
            left: `${percentage}%`,
            transform: 'translateX(-50%)'
          }}
        >
          {/* Thumb vertical line */}
          <div className="w-[2px] h-3 bg-white/80 rounded-full"></div>
        </div>
      </div>
      
      
      {!hideLabels && (
        <div className="relative h-4 font-mono text-[10px] text-white/40 mt-1">
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
