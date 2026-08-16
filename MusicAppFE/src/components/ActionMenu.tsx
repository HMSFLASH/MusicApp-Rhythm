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
  buttonClassName = 'p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all',
  menuClassName = 'w-56',
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
        <MoreHorizontal size={17} />
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} ${menuClassName} max-w-[calc(100vw_-_2rem)] bg-[#0c1626]/95 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden z-50 py-1.5 backdrop-blur-2xl`}
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
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                action.tone === 'danger'
                  ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              {action.icon && <span className="shrink-0 text-slate-400 group-hover:text-primary">{action.icon}</span>}
              <span className="truncate">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
