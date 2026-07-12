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
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => handleClose(false)}>
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-4 sm:p-6 w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl scale-100 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">
              {options.title || t('layout.confirmTitle', 'Xác nhận')}
            </h2>
            <p className="text-white/70 mb-6 text-sm whitespace-pre-line leading-relaxed">
              {options.description}
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors font-semibold text-sm"
              >
                {options.cancelText || t('layout.cancel', 'Hủy')}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors border ${options.confirmColor || 'bg-primary/20 text-primary hover:bg-primary/30 border-primary/30'
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
