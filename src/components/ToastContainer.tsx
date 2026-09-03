import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastItem, ToastType } from '../utils/toast';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastItem>;
      if (customEvent.detail && customEvent.detail.message) {
        const newToast = customEvent.detail;
        setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5

        // Auto remove after 3.2s
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, 3200);
      }
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => window.removeEventListener('app-toast', handleToastEvent);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-teal-600 shrink-0" />;
    }
  };

  const getStyle = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-emerald-900/10';
      case 'error':
        return 'bg-rose-50 border-rose-300 text-rose-950 shadow-rose-900/10';
      case 'warning':
        return 'bg-amber-50 border-amber-300 text-amber-950 shadow-amber-900/10';
      case 'info':
      default:
        return 'bg-teal-50 border-teal-300 text-teal-950 shadow-teal-900/10';
    }
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-5 z-[9999] pointer-events-none flex flex-col gap-2.5 max-w-[92vw] sm:max-w-md w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -24, scale: 0.9, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.92, y: -12, filter: 'blur(2px)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md ${getStyle(
              toast.type
            )}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {getIcon(toast.type)}
              <span className="text-xs font-extrabold leading-snug break-words">
                {toast.message}
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.15, rotate: 90 }}
              whileTap={{ scale: 0.85 }}
              onClick={() => removeToast(toast.id)}
              className="p-1 hover:bg-black/5 rounded-lg text-gray-500 hover:text-gray-800 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
