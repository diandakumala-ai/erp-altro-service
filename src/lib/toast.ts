// Simple event-based toast system (no external library needed)

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners: ToastListener[] = [];

function notify() {
  listeners.forEach(fn => fn([...toasts]));
}

export const toast = {
  subscribe(fn: ToastListener) {
    listeners.push(fn);
    fn([...toasts]);
    return () => {
      const i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  },
  show(message: string, type: ToastType = 'info', duration = 3500) {
    const id = Math.random().toString(36).slice(2);
    toasts = [...toasts, { id, message, type }];
    notify();
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
      notify();
    }, duration);
  },
  success: (msg: string) => toast.show(msg, 'success'),
  error: (msg: string) => toast.show(msg, 'error', 5000),
  warning: (msg: string) => toast.show(msg, 'warning'),
  info: (msg: string) => toast.show(msg, 'info'),
};
