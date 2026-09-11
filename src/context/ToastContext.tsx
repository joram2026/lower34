import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration = 4500) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 active

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((msg: string, title?: string, dur?: number) => showToast(msg, 'success', title, dur), [showToast]);
  const error = useCallback((msg: string, title?: string, dur?: number) => showToast(msg, 'error', title, dur), [showToast]);
  const info = useCallback((msg: string, title?: string, dur?: number) => showToast(msg, 'info', title, dur), [showToast]);
  const warning = useCallback((msg: string, title?: string, dur?: number) => showToast(msg, 'warning', title, dur), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning, removeToast }}>
      {children}
      {/* Toast Overlay Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-4 sm:translate-x-0 z-[99999] flex flex-col gap-2.5 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md text-xs font-sans transition-all ${
                toast.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500/40 text-emerald-200 shadow-emerald-950/30'
                  : toast.type === 'error'
                  ? 'bg-red-950/95 border-red-500/40 text-red-200 shadow-red-950/30'
                  : toast.type === 'warning'
                  ? 'bg-amber-950/95 border-amber-500/40 text-amber-200 shadow-amber-950/30'
                  : 'bg-zinc-900/95 border-zinc-700/60 text-zinc-100 shadow-zinc-950/40'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
                {toast.type === 'error' && <AlertCircle size={18} className="text-red-400" />}
                {toast.type === 'warning' && <AlertTriangle size={18} className="text-amber-400" />}
                {toast.type === 'info' && <Info size={18} className="text-cyan-400" />}
              </div>
              <div className="flex-1 min-w-0 pr-1">
                {toast.title && <h4 className="font-extrabold uppercase tracking-wider text-[10px] mb-0.5 opacity-90">{toast.title}</h4>}
                <p className="font-medium leading-relaxed break-words">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
