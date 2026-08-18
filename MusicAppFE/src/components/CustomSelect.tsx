import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type CustomSelectOption<T extends string | number> = {
  value: T;
  label: string;
  icon?: ReactNode;
  description?: string;
};

export type CustomSelectProps<T extends string | number> = {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  prefixLabel?: ReactNode;
  icon?: ReactNode;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  direction?: 'up' | 'down';
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  tone?: 'primary' | 'cyan' | 'purple' | 'default';
  variant?: 'solid' | 'glass' | 'ghost';
  size?: 'sm' | 'md';
};

export function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  prefixLabel,
  icon,
  ariaLabel = 'Select option',
  placeholder = 'Select...',
  disabled = false,
  align = 'left',
  direction = 'down',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  optionClassName = '',
  tone = 'primary',
  variant = 'glass',
  size = 'sm',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toneColorMap = {
    primary: {
      text: 'text-primary',
      border: 'border-primary/40',
      activeBg: 'bg-primary/15',
      glow: 'shadow-[0_0_15px_rgba(0,245,255,0.25)]',
      ring: 'ring-1 ring-primary/40',
    },
    cyan: {
      text: 'text-cyan-400',
      border: 'border-cyan-500/40',
      activeBg: 'bg-cyan-500/15',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.25)]',
      ring: 'ring-1 ring-cyan-500/40',
    },
    purple: {
      text: 'text-purple-400',
      border: 'border-purple-500/40',
      activeBg: 'bg-purple-500/15',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.25)]',
      ring: 'ring-1 ring-purple-500/40',
    },
    default: {
      text: 'text-slate-200',
      border: 'border-white/20',
      activeBg: 'bg-white/10',
      glow: 'shadow-lg',
      ring: 'ring-1 ring-white/20',
    },
  }[tone];

  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2.5 py-1.5 gap-1.5' 
    : 'text-sm px-3.5 py-2.5 gap-2.5';

  const defaultBg = variant === 'glass' 
    ? 'bg-[#0c1626]/90 backdrop-blur-xl border border-white/10 hover:border-white/20'
    : variant === 'solid'
    ? 'bg-[#0c1626] border border-white/10 hover:border-white/20'
    : 'bg-transparent border border-transparent hover:bg-white/[0.05]';

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`flex items-center justify-between rounded-xl font-mono transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${
          isOpen
            ? `${toneColorMap.border} ${toneColorMap.glow} ${toneColorMap.ring} bg-[#0c1626]`
            : defaultBg
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {prefixLabel && (
            <span className="text-slate-400 shrink-0 select-none">{prefixLabel}</span>
          )}
          <span className={`truncate font-semibold ${selectedOption ? toneColorMap.text : 'text-slate-400'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          size={size === 'sm' ? 14 : 16}
          className={`shrink-0 ml-1.5 text-slate-400 transition-transform duration-300 ${
            isOpen ? `rotate-180 ${toneColorMap.text}` : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${
            direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } min-w-full w-max max-w-[calc(100vw-2rem)] sm:max-w-xs bg-[#0c1626]/98 border border-white/[0.12] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 py-1.5 backdrop-blur-2xl max-h-60 overflow-y-auto no-scrollbar animate-in zoom-in-95 fade-in duration-200 ${menuClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-xs font-mono text-left transition-all cursor-pointer ${
                  isSelected
                    ? `${toneColorMap.activeBg} ${toneColorMap.text} font-bold shadow-[inset_0_0_10px_rgba(0,245,255,0.08)]`
                    : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                } ${optionClassName}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{opt.label}</span>
                    {opt.description && (
                      <span className="text-[10px] text-slate-400 font-sans mt-0.5 truncate">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check
                    size={14}
                    className={`shrink-0 drop-shadow-[0_0_6px_rgba(0,245,255,0.8)] ${toneColorMap.text}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
