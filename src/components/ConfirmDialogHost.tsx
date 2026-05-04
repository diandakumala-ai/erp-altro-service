import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { __confirmHost, type ActiveConfirm } from '../lib/confirm';

const VARIANT_ICON = {
  danger:  { Icon: AlertTriangle, bg: 'bg-red-100',    fg: 'text-red-600'    },
  warning: { Icon: AlertCircle,   bg: 'bg-amber-100',  fg: 'text-amber-600'  },
  primary: { Icon: Info,          bg: 'bg-indigo-100', fg: 'text-indigo-600' },
} as const;

/**
 * Singleton renderer untuk confirm dialog imperative API.
 * Mount sekali di App root (sudah di App.tsx).
 */
export function ConfirmDialogHost() {
  const [active, setActive] = useState<ActiveConfirm | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => __confirmHost.subscribe(setActive), []);

  if (!active) return null;

  const variant = active.variant ?? (active.destructive ? 'danger' : 'primary');
  const { Icon, bg, fg } = VARIANT_ICON[variant];
  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';

  const cancelLabel = active.cancelLabel ?? 'Batal';
  const confirmLabel = active.confirmLabel ?? (active.destructive ? 'Hapus' : 'Konfirmasi');

  return (
    <Dialog
      open
      onClose={() => __confirmHost.resolve(false)}
      title={active.title}
      size="sm"
      hideCloseButton
      // Auto-focus tombol Batal — pola aman untuk action destruktif
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" size="md" onClick={() => __confirmHost.resolve(false)}>
            {cancelLabel}
          </Button>
          <Button variant={buttonVariant} size="md" onClick={() => __confirmHost.resolve(true)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 flex gap-4 bg-white">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
          <Icon className={`w-5 h-5 ${fg}`} aria-hidden="true" />
        </div>
        <div className="text-sm text-slate-700 leading-relaxed flex-1 min-w-0">
          {active.message}
        </div>
      </div>
    </Dialog>
  );
}
