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
};

const toneStyles: Record<ToggleTone, {
  container: string;
  activeSwitch: string;
  title: string;
  description: string;
}> = {
  default: {
    container: 'bg-white/5 border-white/10',
    activeSwitch: 'bg-[#00E5FF]',
    title: 'text-white/80',
    description: 'text-white/80',
  },
  amber: {
    container: 'bg-amber-500/5 border-amber-500/20',
    activeSwitch: 'bg-amber-500',
    title: 'text-amber-500/90',
    description: 'text-amber-500/60',
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
}: AudioToggleRowProps) {
  const styles = toneStyles[tone];

  return (
    <div className={`flex items-center justify-between mt-2 p-4 rounded-xl border ${styles.container}`}>
      <div>
        <span className={`text-sm font-bold block ${titleClassName || styles.title}`}>{title}</span>
        <span className={`text-xs font-mono mt-1 block pr-4 ${descriptionClassName || styles.description}`}>
          {description}
        </span>
      </div>
      <button aria-label="Action"
        onClick={onToggle}
        className={`shrink-0 w-12 h-6 rounded-full relative transition-colors ${checked ? styles.activeSwitch : 'bg-white/20'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
      </button>
    </div>
  );
}
