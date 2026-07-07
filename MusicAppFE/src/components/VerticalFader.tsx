import React, { useRef, useEffect, useState, useCallback } from 'react';

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

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    // Y is relative to the top, so we invert it for bottom-up calculation
    let newY = e.clientY - rect.top;
    
    // Clamp
    newY = Math.max(0, Math.min(newY, rect.height));
    
    const pct = 1 - (newY / rect.height);
    const newValue = min + (pct * range);
    
    // Round to nearest integer for typical EQ
    onChange(Math.round(newValue));
  }, [isDragging, min, range, onChange]);

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
    // Trigger immediate move to jump to clicked position
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
      onChange(Math.max(min, Math.min(parsed, max)));
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
    <div className="flex flex-col items-center gap-5 group w-8 select-none">
      <div className="h-4 flex items-center justify-center">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className="w-10 bg-black/50 text-white text-[9px] font-mono text-center border border-[#00E5FF]/50 rounded outline-none h-4"
          />
        ) : (
          <div 
            onClick={handleEditClick}
            className="text-[9px] font-mono text-white/50 cursor-pointer hover:text-white transition-colors"
          >
            {value > 0 ? `+${value}` : (value < 0 ? value : '0')}
          </div>
        )}
      </div>
      
      {/* Track Container */}
      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className="relative h-48 w-full flex justify-center cursor-pointer touch-none"
      >
        {/* Background dark track */}
        <div className="absolute top-0 bottom-0 w-[2px] bg-white/10 rounded-full"></div>
        
        {/* Dotted lines for steps (optional detail) */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-4 flex flex-col justify-between pointer-events-none opacity-20">
          <div className="border-t border-white w-1 mx-auto"></div>
          <div className="border-t border-white w-4"></div> {/* +15 */}
          <div className="border-t border-white w-1 mx-auto"></div>
          <div className="border-t border-white w-4"></div> {/* 0 */}
          <div className="border-t border-white w-1 mx-auto"></div>
          <div className="border-t border-white w-4"></div> {/* -15 */}
          <div className="border-t border-white w-1 mx-auto"></div>
        </div>

        {/* Active Track (Colored) */}
        <div 
          className="absolute bottom-0 w-[2px] rounded-full pointer-events-none transition-all duration-75"
          style={{ 
            height: `${percentage}%`,
            backgroundColor: trackColor,
            boxShadow: `0 0 8px ${trackColor}80` // Glow effect
          }}
        ></div>

        {/* Thumb (Pill shape) */}
        <div 
          className="absolute w-6 h-10 bg-[#1a1a1a] rounded-lg border border-white/20 shadow-lg pointer-events-none flex items-center justify-center transition-transform duration-75 group-hover:border-white/40"
          style={{ 
            bottom: `${percentage}%`,
            transform: 'translateY(50%)'
          }}
        >
          {/* Thumb horizontal indicator line */}
          <div className="w-3 h-[2px] bg-white/80 rounded-full"></div>
        </div>
      </div>
      
      {label && (
        <div className="text-[10px] font-mono text-white/60 mt-2">
          {label}
        </div>
      )}
    </div>
  );
}
