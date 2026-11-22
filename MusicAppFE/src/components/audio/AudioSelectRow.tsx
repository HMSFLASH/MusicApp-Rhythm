import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';

type AudioSelectRowProps<T extends string | number> = {
  title: ReactNode;
  description: ReactNode;
  value: T;
  options: { label: string; value: T }[];
  onChange: (val: T) => void;
  tone?: 'default' | 'amber';
  direction?: 'up' | 'down' | 'auto';
  disabled?: boolean;
  titleClassName?: string;
  descriptionClassName?: string;
  zIndex?: number;
};

export function AudioSelectRow<T extends string | number>({
  title,
  description,
  value,
  options,
  onChange,
  tone = 'default',
  direction = 'auto',
  disabled = false,
  titleClassName,
  descriptionClassName,
  zIndex,
}: AudioSelectRowProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [autoOpenUpwards, setAutoOpenUpwards] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  const openUpwards = direction === 'up' ? true : direction === 'down' ? false : autoOpenUpwards;
  const menuOpen = isOpen && !disabled;

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const containerStyle = tone === 'amber'
    ? 'bg-amber-500/[0.04] border-amber-500/20 hover:border-amber-500/30'
    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]';

  return (
    <div 
      className={`flex flex-col gap-3 mt-2 p-4 sm:p-5 rounded-2xl border transition-all ${containerStyle} ${disabled ? 'opacity-50' : ''} w-full relative`}
      style={{ zIndex: menuOpen ? 50 : (zIndex ?? 1) }}
    >
      <div className="flex flex-col w-full">
        <span className={`text-sm font-semibold block leading-snug break-words ${titleClassName || 'text-slate-100'}`}>{title}</span>
        <span className={`text-xs font-mono mt-1 block leading-normal break-words ${descriptionClassName || 'text-slate-400'}`}>
          {description}
        </span>
      </div>

      <div ref={containerRef} className={`relative w-full ${menuOpen ? 'z-40' : ''}`}>
        {/* Custom Dropdown Trigger */}
        <button
          type="button"
          disabled={disabled}
          aria-expanded={menuOpen}
          onClick={() => {
            if (disabled) return;
            setIsOpen((prev) => {
              const next = !prev;
              if (next && direction === 'auto' && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const estimatedHeight = Math.min(options.length * 44 + 20, 260);
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                setAutoOpenUpwards(spaceBelow < estimatedHeight && spaceAbove > spaceBelow);
              }
              return next;
            });
          }}
          className={`w-full flex items-center justify-between gap-3 bg-[#0c1626] text-primary font-mono text-xs font-semibold border rounded-xl px-4 py-3 outline-none transition-all shadow-md active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed disabled:active:scale-100 ${
            menuOpen 
              ? 'border-primary shadow-[0_0_15px_rgba(0,245,255,0.25)] ring-1 ring-primary/40' 
              : 'border-white/[0.1] hover:border-primary/50'
          }`}
        >
          <span className="truncate text-left">{selectedOption ? selectedOption.label : String(value)}</span>
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform duration-300 shrink-0 ${menuOpen ? 'rotate-180 text-primary' : ''}`}
          />
        </button>

        {/* Custom Glassmorphic Popover Menu */}
        {menuOpen && (
          <div
            className={`absolute ${
              openUpwards ? 'bottom-full mb-2' : 'top-full mt-2'
            } left-0 right-0 bg-[#0c1626]/98 border border-white/[0.12] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 py-1.5 backdrop-blur-2xl max-h-64 overflow-y-auto no-scrollbar animate-in zoom-in-95 fade-in duration-200`}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 px-4 py-2.5 text-xs font-mono text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/15 text-primary font-bold shadow-[inset_0_0_10px_rgba(0,245,255,0.1)]'
                      : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-primary shrink-0 drop-shadow-[0_0_6px_rgba(0,245,255,0.8)]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
