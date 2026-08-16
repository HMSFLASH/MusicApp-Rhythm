import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
  };
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(({ type, title, message, duration = 3000 }: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastMessage = { id, type, title, message, duration };

    setToasts(prev => [...prev.slice(-4), newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: useCallback((message: string, title?: string, duration?: number) => addToast({ type: 'success', message, title, duration }), [addToast]),
    error: useCallback((message: string, title?: string, duration?: number) => addToast({ type: 'error', message, title, duration }), [addToast]),
    info: useCallback((message: string, title?: string, duration?: number) => addToast({ type: 'info', message, title, duration }), [addToast]),
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      <div className="fixed top-5 right-5 z-[150] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map(t => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#0c1626]/95 border shadow-[0_15px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-in slide-in-from-top-3 fade-in duration-300 transition-all ${
                isSuccess
                  ? 'border-emerald-500/30 text-emerald-300'
                  : isError
                  ? 'border-rose-500/30 text-rose-300'
                  : 'border-primary/30 text-primary'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 size={18} className="text-emerald-400" />}
                {isError && <AlertCircle size={18} className="text-rose-400" />}
                {!isSuccess && !isError && <Info size={18} className="text-primary" />}
              </div>

              <div className="flex-1 min-w-0">
                {t.title && (
                  <h4 className="text-xs font-bold font-display uppercase tracking-wider text-white mb-0.5">
                    {t.title}
                  </h4>
                )}
                <p className="text-xs text-slate-200 leading-snug font-sans break-words">
                  {t.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-slate-400 hover:text-white transition-colors p-1 -mr-1 -mt-1 rounded-lg hover:bg-white/[0.08]"
                aria-label="Close notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
