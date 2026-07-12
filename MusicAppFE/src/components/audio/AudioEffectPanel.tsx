import type { ReactNode } from 'react';
import { Power } from 'lucide-react';

type EffectPowerButtonSize = 'sm' | 'md' | 'lg';

const powerButtonSizes: Record<EffectPowerButtonSize, {
  button: string;
  icon: number;
}> = {
  sm: { button: 'w-6 h-6', icon: 10 },
  md: { button: 'w-8 h-8', icon: 14 },
  lg: { button: 'w-10 h-10', icon: 18 },
};

type EffectPowerButtonProps = {
  active: boolean;
  onClick: () => void;
  activeClassName: string;
  size?: EffectPowerButtonSize;
  ariaLabel?: string;
  className?: string;
};

export function EffectPowerButton({
  active,
  onClick,
  activeClassName,
  size = 'md',
  ariaLabel = 'Toggle effect',
  className = '',
}: EffectPowerButtonProps) {
  const sizeStyles = powerButtonSizes[size];

  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      className={`${sizeStyles.button} flex-shrink-0 rounded-full flex items-center justify-center transition-all ${active ? activeClassName : 'bg-white/5 text-white/80 hover:bg-white/10'} ${className}`}
    >
      <Power size={sizeStyles.icon} />
    </button>
  );
}

type AudioEffectPanelProps = {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  headerClassName?: string;
};

export function AudioEffectPanel({
  title,
  description,
  children,
  leading,
  trailing,
  className = '',
  headerClassName = '',
}: AudioEffectPanelProps) {
  return (
    <div className={`bg-[#0a0a0a] rounded-2xl border border-white/5 shadow-2xl p-4 md:p-8 flex flex-col gap-6 md:gap-8 w-full ${className}`}>
      <div className={`flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center ${trailing ? 'sm:justify-between' : ''} ${headerClassName}`}>
        <div className="flex items-center gap-3 min-w-0">
          {leading}
          <div className="min-w-0">
            <h2 className="text-xl font-bold font-sans text-white/80 tracking-tight">{title}</h2>
            <p className="text-secondary/60 text-xs font-mono mt-1">{description}</p>
          </div>
        </div>
        {trailing && <div className="shrink-0 self-start sm:self-auto">{trailing}</div>}
      </div>
      {children}
    </div>
  );
}

type EffectControlsGateProps = {
  active: boolean;
  children: ReactNode;
  className?: string;
  inactiveOpacityClassName?: string;
};

export function EffectControlsGate({
  active,
  children,
  className = '',
  inactiveOpacityClassName = 'opacity-30',
}: EffectControlsGateProps) {
  return (
    <div className={`transition-opacity duration-300 ${active ? 'opacity-100' : `${inactiveOpacityClassName} pointer-events-none`} ${className}`}>
      {children}
    </div>
  );
}
