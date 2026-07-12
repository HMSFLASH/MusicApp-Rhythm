import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
};

type ActionMenuProps = {
  actions: ActionMenuItem[];
  ariaLabel?: string;
  buttonClassName?: string;
  menuClassName?: string;
  direction?: 'up' | 'down';
  align?: 'left' | 'right';
};

export function ActionMenu({
  actions,
  ariaLabel = 'More actions',
  buttonClassName = 'p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors',
  menuClassName = 'w-52',
  direction = 'down',
  align = 'right',
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  if (actions.length === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen(open => !open);
        }}
        className={buttonClassName}
      >
        <MoreHorizontal size={18} />
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} ${menuClassName} bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50 py-1`}
          onClick={(event) => event.stopPropagation()}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return;
                action.onSelect();
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed ${
                action.tone === 'danger'
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {action.icon && <span className="shrink-0">{action.icon}</span>}
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
