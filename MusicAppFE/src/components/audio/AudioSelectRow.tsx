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
    <div className={`flex flex-col gap-3 mt-2 p-4 rounded-xl border ${containerStyle} w-full`}>
      <div className="flex flex-col w-full">
        <span className={`text-sm font-bold block leading-snug break-words ${titleClassName || 'text-white/80'}`}>{title}</span>
        <span className={`text-xs font-mono mt-1 block leading-normal break-words ${descriptionClassName || 'text-white/50'}`}>
          {description}
        </span>
      </div>
      <div className="relative w-full">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-black/70 text-[#00E5FF] font-mono text-xs font-bold border border-white/20 rounded-lg px-3 py-2 outline-none cursor-pointer hover:border-[#00E5FF]/60 focus:border-[#00E5FF] transition-colors truncate"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#121212] text-white font-mono py-1">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
