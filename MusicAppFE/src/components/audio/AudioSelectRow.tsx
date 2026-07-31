import type { ReactNode } from 'react';

type AudioSelectRowProps = {
  title: ReactNode;
  description: ReactNode;
  value: number;
  options: { label: string; value: number }[];
  onChange: (val: number) => void;
  tone?: 'default' | 'amber';
  titleClassName?: string;
  descriptionClassName?: string;
};

export function AudioSelectRow({
  title,
  description,
  value,
  options,
  onChange,
  tone = 'default',
  titleClassName,
  descriptionClassName,
}: AudioSelectRowProps) {
  const containerStyle = tone === 'amber'
    ? 'bg-amber-500/5 border-amber-500/20'
    : 'bg-white/5 border-white/10';

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2 p-4 rounded-xl border ${containerStyle}`}>
      <div className="flex flex-col">
        <span className={`text-sm font-bold block ${titleClassName || 'text-white/80'}`}>{title}</span>
        <span className={`text-xs font-mono mt-0.5 block pr-2 ${descriptionClassName || 'text-white/50'}`}>
          {description}
        </span>
      </div>
      <div className="relative shrink-0 self-start sm:self-auto">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-black/60 text-[#00E5FF] font-mono text-xs font-bold border border-white/20 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-[#00E5FF]/60 transition-colors"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#121212] text-white font-mono">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
