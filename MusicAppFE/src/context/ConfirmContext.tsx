import React, { createContext, useContext, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string; // Tailwind color classes, e.g. "bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30"
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ description: '' });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = (opts: ConfirmOptions | string) => {
    if (typeof opts === 'string') {
      setOptions({ description: opts });
    } else {
      setOptions(opts);
    }
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  };

  const handleClose = (value: boolean) => {
    setIsOpen(false);
    if (resolver.current) resolver.current(value);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => handleClose(false)}>
          <div className="bg-[#0c1626]/95 border border-white/[0.1] rounded-3xl p-5 sm:p-6 w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-base sm:text-lg font-bold font-display text-white mb-2">
              {options.title || t('layout.confirmTitle', 'Xác nhận')}
            </h2>
            <p className="text-slate-300/90 mb-6 text-xs leading-relaxed whitespace-pre-line font-sans">
              {options.description}
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors font-semibold text-xs"
              >
                {options.cancelText || t('layout.cancel', 'Hủy')}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all border shadow-sm active:scale-95 ${options.confirmColor || 'bg-primary text-slate-950 hover:brightness-110 border-primary/40 shadow-[0_0_15px_rgba(0,245,255,0.3)]'
                  }`}
              >
                {options.confirmText || t('layout.confirm', 'Đồng ý')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
  return context.confirm;
}
