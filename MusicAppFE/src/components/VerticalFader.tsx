import React, { useRef, useEffect, useState, useCallback } from 'react';
import { formatNumberInput, parseDecimalInput } from './NumberInput';

interface VerticalFaderProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label?: string;
  trackColor?: string;
}

export function VerticalFader({ 
  value, 
  min, 
  max, 
  onChange, 
  label, 
  trackColor = '#00ff00' 
}: VerticalFaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Calculate percentage (0 = bottom/min, 100 = top/max)
  const range = max - min;
  const percentage = ((value - min) / range) * 100;

  const handleMove = useCallback((clientY: number) => {
    if (!isDragging || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    let newY = clientY - rect.top;
    
    newY = Math.max(0, Math.min(newY, rect.height));
    
    const pct = 1 - (newY / rect.height);
    const newValue = min + (pct * range);
    
    onChange(Number(newValue.toFixed(2)));
  }, [isDragging, min, range, onChange]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    handleMove(e.clientY);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientY);
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
    handleMove(e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      handleMove(e.touches[0].clientY);
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
      const nextValue = Math.max(min, Math.min(parsed, max));
      onChange(Number(formatNumberInput(nextValue)));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // The active track height goes from 0 to current value.
  // We want the green line to start at 0dB (center) and go to the thumb.
  // Or in typical DAWs, it just goes from bottom to thumb, or center to thumb.
  // The image shows the green track from the bottom going up to the thumb.
  
  return (
    <div className="flex flex-col items-center gap-4 group w-9 select-none">
      <div className="h-5 flex items-center justify-center">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value.replace(/,/g, '.'))}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className="w-11 bg-[#0c1626] text-primary text-[10px] font-mono text-center border border-primary/50 rounded-md outline-none h-5 shadow-sm"
          />
        ) : (
          <div 
            onClick={handleEditClick}
            className="text-[10px] font-mono font-medium text-slate-400 cursor-pointer hover:text-primary transition-colors"
          >
            {value > 0 ? `+${formatNumberInput(value)}` : (value < 0 ? formatNumberInput(value) : '0')}
          </div>
        )}
      </div>
      
      {/* Track Container */}
      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        className="relative h-48 w-full flex justify-center cursor-pointer touch-none"
      >
        {/* Background dark track */}
        <div className="absolute top-0 bottom-0 w-[3px] bg-white/[0.08] rounded-full"></div>
        
        {/* Step markers */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-4 flex flex-col justify-between pointer-events-none opacity-25">
          <div className="border-t border-white w-1 mx-auto"></div>
          <div className="border-t border-white w-3.5"></div> {/* +15 */}
          <div className="border-t border-white w-1 mx-auto"></div>
          <div className="border-t border-white w-3.5"></div> {/* 0 */}
          <div className="border-t border-white w-1 mx-auto"></div>
          <div className="border-t border-white w-3.5"></div> {/* -15 */}
          <div className="border-t border-white w-1 mx-auto"></div>
        </div>

        {/* Active Track (Colored) */}
        <div 
          className="absolute bottom-0 w-[3px] rounded-full pointer-events-none transition-all duration-75"
          style={{ 
            height: `${percentage}%`,
            backgroundColor: trackColor,
            boxShadow: `0 0 10px ${trackColor}` // Glow effect
          }}
        ></div>

        {/* Thumb (Pill shape) */}
        <div 
          className="absolute w-7 h-10 bg-[#0c1626] rounded-xl border border-white/20 shadow-2xl pointer-events-none flex items-center justify-center transition-transform duration-75 group-hover:border-primary/60 group-hover:scale-105"
          style={{ 
            bottom: `${percentage}%`,
            transform: 'translateY(50%)'
          }}
        >
          {/* Thumb horizontal indicator line */}
          <div className="w-3.5 h-[2px] bg-primary rounded-full shadow-[0_0_6px_rgba(0,245,255,0.8)]"></div>
        </div>
      </div>
      
      {label && (
        <div className="text-[10px] font-mono text-slate-400 mt-2 font-medium">
          {label}
        </div>
      )}
    </div>
  );
}
