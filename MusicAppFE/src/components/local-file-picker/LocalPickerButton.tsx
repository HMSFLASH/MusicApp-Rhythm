import type { ReactNode } from 'react';
import { FolderOpen } from 'lucide-react';

type LocalPickerButtonProps = {
  label: ReactNode;
  hint?: ReactNode;
  onClick: () => void;
  iconClassName?: string;
};

export function LocalPickerButton({
  label,
  hint,
  onClick,
  iconClassName,
}: LocalPickerButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left w-full"
    >
      <FolderOpen size={20} className={iconClassName} />
      {hint ? (
        <span className="flex flex-col gap-0.5">
          <span>{label}</span>
          <span className="text-[11px] leading-snug text-amber-400/70">
            {hint}
          </span>
        </span>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
