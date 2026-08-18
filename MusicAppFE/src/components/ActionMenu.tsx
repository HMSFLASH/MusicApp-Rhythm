import { useEffect, useRef, useState, useLayoutEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  direction?: 'up' | 'down' | 'auto';
  align?: 'left' | 'right' | 'auto';
  icon?: ReactNode;
};

export function ActionMenu({
  actions,
  ariaLabel = 'More actions',
  className = '',
  buttonClassName = 'p-2 text-slate-400 hover:text-white hover:bg-white/[0.08] rounded-xl transition-all',
  menuClassName = 'w-56',
  direction = 'down',
  align = 'right',
  icon,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();

    if (buttonRect.width === 0 && buttonRect.height === 0) {
      return;
    }

    const menuEl = menuRef.current;
    const menuWidth = menuEl?.offsetWidth || 224;
    const menuHeight = menuEl?.offsetHeight || actions.length * 40 + 16;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 8;

    // Determine vertical direction
    let openUp = direction === 'up';
    if (direction === 'auto') {
      const spaceBelow = vh - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      openUp = spaceBelow < menuHeight + padding && spaceAbove > spaceBelow;
    }

    let top = openUp ? buttonRect.top - menuHeight - padding : buttonRect.bottom + padding;

    // Safety checks for vertical boundaries
    if (openUp && top < padding) {
      if (vh - buttonRect.bottom >= menuHeight + padding) {
        top = buttonRect.bottom + padding;
      } else {
        top = Math.max(padding, top);
      }
    } else if (!openUp && top + menuHeight > vh - padding) {
      if (buttonRect.top >= menuHeight + padding) {
        top = buttonRect.top - menuHeight - padding;
      } else {
        top = Math.max(padding, vh - menuHeight - padding);
      }
    }

    // Determine horizontal alignment
    let left: number;
    if (align === 'right') {
      left = buttonRect.right - menuWidth;
    } else if (align === 'left') {
      left = buttonRect.left;
    } else {
      if (buttonRect.right - menuWidth < padding) {
        left = buttonRect.left;
      } else {
        left = buttonRect.right - menuWidth;
      }
    }

    // Clamp horizontal position within viewport
    left = Math.max(padding, Math.min(left, vw - menuWidth - padding));

    setCoords({ top, left });
  }, [actions.length, align, direction]);

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  if (actions.length === 0) return null;

  return (
    <div className={`relative shrink-0 ${isOpen ? '!opacity-100' : ''} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
        className={buttonClassName}
      >
        {icon ?? <MoreHorizontal size={17} />}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              visibility: coords ? 'visible' : 'hidden',
              zIndex: 9999,
            }}
            className={`${menuClassName} max-w-[calc(100vw-2rem)] bg-[#0c1626]/98 border border-white/[0.12] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] overflow-hidden py-1.5 backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-150`}
            onClick={(event) => event.stopPropagation()}
          >
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={action.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (action.disabled) return;
                  action.onSelect();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium text-left hover:bg-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${
                  action.tone === 'danger'
                    ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                {action.icon && (
                  <span className="shrink-0 text-slate-400">
                    {action.icon}
                  </span>
                )}
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
