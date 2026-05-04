import { useState, useEffect } from 'react';
import { toast, type Toast } from '../lib/toast';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: { Icon: CheckCircle, cls: 'text-emerald-500' },
  error: { Icon: XCircle, cls: 'text-red-500' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-500' },
  info: { Icon: Info, cls: 'text-indigo-500' },
};

const barColors = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-indigo-500',
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return toast.subscribe(setToasts);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 flex flex-col gap-2 max-w-xs w-full pointer-events-none"
      style={{ zIndex: 'var(--z-toast)' }}
    >
      {toasts.map(t => {
        const { Icon, cls } = icons[t.type];
        const isError = t.type === 'error';
        return (
          <div
            key={t.id}
            role={isError ? 'alert' : 'status'}
            className="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-slide-up"
          >
            <div className={`h-1 ${barColors[t.type]} w-full`} />
            <div className="flex items-start gap-3 px-4 py-3">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cls}`} aria-hidden="true" />
              <p className="text-sm text-slate-700 font-medium flex-1">{t.message}</p>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-slate-300 hover:text-slate-500 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded"
                aria-label="Tutup notifikasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
