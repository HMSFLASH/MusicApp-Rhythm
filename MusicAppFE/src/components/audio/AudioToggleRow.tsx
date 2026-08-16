import type { ReactNode } from 'react';

type ToggleTone = 'default' | 'amber';

type AudioToggleRowProps = {
  title: ReactNode;
  description: ReactNode;
  checked: boolean;
  onToggle: () => void;
  tone?: ToggleTone;
  titleClassName?: string;
  descriptionClassName?: string;
  disabled?: boolean;
};

const toneStyles: Record<ToggleTone, {
  container: string;
  activeSwitch: string;
  title: string;
  description: string;
}> = {
  default: {
    container: 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]',
    activeSwitch: 'bg-primary shadow-[0_0_12px_rgba(0,245,255,0.4)]',
    title: 'text-slate-100',
    description: 'text-slate-400',
  },
  amber: {
    container: 'bg-amber-500/[0.04] border-amber-500/20 hover:border-amber-500/30',
    activeSwitch: 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]',
    title: 'text-amber-300 font-semibold',
    description: 'text-amber-400/70',
  },
};

export function AudioToggleRow({
  title,
  description,
  checked,
  onToggle,
  tone = 'default',
  titleClassName,
  descriptionClassName,
  disabled = false,
}: AudioToggleRowProps) {
  const styles = toneStyles[tone];

  return (
    <div className={`flex items-center justify-between mt-2 p-4 rounded-2xl border transition-all ${styles.container} ${disabled ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
      <div>
        <span className={`text-sm font-semibold block ${titleClassName || styles.title}`}>{title}</span>
        <span className={`text-xs font-mono mt-1 block pr-4 ${descriptionClassName || styles.description}`}>
          {description}
        </span>
      </div>
      <button aria-label="Toggle action"
        onClick={onToggle}
        disabled={disabled}
        className={`shrink-0 w-11 h-6 rounded-full relative transition-colors ${checked ? styles.activeSwitch : 'bg-white/10'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
      </button>
    </div>
  );
}
