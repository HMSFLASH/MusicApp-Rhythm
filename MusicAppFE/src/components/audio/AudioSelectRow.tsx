import type { ReactNode } from 'react';

type AudioSelectRowProps<T extends string | number> = {
  title: ReactNode;
  description: ReactNode;
  value: T;
  options: { label: string; value: T }[];
  onChange: (val: T) => void;
  tone?: 'default' | 'amber';
  titleClassName?: string;
  descriptionClassName?: string;
};

export function AudioSelectRow<T extends string | number>({
  title,
  description,
  value,
  options,
  onChange,
  tone = 'default',
  titleClassName,
  descriptionClassName,
}: AudioSelectRowProps<T>) {
  const containerStyle = tone === 'amber'
    ? 'bg-amber-500/[0.04] border-amber-500/20 hover:border-amber-500/30'
    : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]';

  return (
    <div className={`flex flex-col gap-3 mt-2 p-4 rounded-2xl border transition-all ${containerStyle} w-full`}>
      <div className="flex flex-col w-full">
        <span className={`text-sm font-semibold block leading-snug break-words ${titleClassName || 'text-slate-100'}`}>{title}</span>
        <span className={`text-xs font-mono mt-1 block leading-normal break-words ${descriptionClassName || 'text-slate-400'}`}>
          {description}
        </span>
      </div>
      <div className="relative w-full">
        <select
          value={value}
          onChange={(e) => {
            const val = e.target.value;
            if (options.length > 0 && typeof options[0].value === 'number') {
              onChange(Number(val) as T);
            } else {
              onChange(val as T);
            }
          }}
          className="w-full bg-[#0c1626] text-primary font-mono text-xs font-semibold border border-white/[0.1] rounded-xl px-3.5 py-2.5 outline-none cursor-pointer hover:border-primary/50 focus:border-primary transition-all truncate shadow-md"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#0c1626] text-slate-200 font-mono py-1.5">
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
