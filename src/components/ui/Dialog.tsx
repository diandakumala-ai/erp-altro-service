import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Stack global untuk multiple dialog (mis. ConfirmDialog di atas Dialog lain).
 * Hanya dialog teratas yang menerima Escape — mencegah Esc menutup semua sekaligus.
 */
const dialogStack: Array<() => void> = [];

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: Size;
  /** Footer (mis. tombol Batal/Simpan). Render di bottom bar dengan border-top. */
  footer?: ReactNode;
  /** Klik backdrop = close. Default true. */
  closeOnBackdrop?: boolean;
  /** Sembunyikan tombol X di header. Default false. */
  hideCloseButton?: boolean;
  /** Element yang difokuskan saat dialog terbuka (default: kontainer dialog). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Tone accent ikon di sebelah judul (opsional). */
  children: ReactNode;
}

/**
 * Modal accessible primitive — WCAG-compliant.
 * - role="dialog" + aria-modal + aria-labelledby/describedby
 * - Focus trap: Tab/Shift+Tab tidak keluar dari dialog
 * - Esc → onClose (hanya dialog teratas yang merespons jika ada stack)
 * - Body scroll lock saat open
 * - Restore focus ke trigger saat close
 * - Backdrop blur + animate-slide-up
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'lg',
  footer,
  closeOnBackdrop = true,
  hideCloseButton = false,
  initialFocusRef,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Body scroll lock + restore focus saat tutup
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
      // Restore focus ke trigger jika masih ada di DOM
      if (previouslyFocused.current && document.contains(previouslyFocused.current)) {
        previouslyFocused.current.focus();
      }
    };
  }, [open]);

  // Initial focus
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        dialogRef.current?.focus();
      }
    }, 50);
    return () => window.clearTimeout(t);
  }, [open, initialFocusRef]);

  // ESC + Tab focus trap, dengan stack-awareness
  useEffect(() => {
    if (!open) return;
    const closeRef = onClose;
    dialogStack.push(closeRef);

    const handler = (e: KeyboardEvent) => {
      // Hanya dialog teratas yang merespons
      if (dialogStack[dialogStack.length - 1] !== closeRef) return;

      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef();
        return;
      }

      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const all = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      // Filter yang benar-benar visible
      const focusable = Array.from(all).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (focusable.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || active === root) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      const i = dialogStack.indexOf(closeRef);
      if (i >= 0) dialogStack.splice(i, 1);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: 'var(--z-modal)' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => { if (closeOnBackdrop) onClose(); }}
      />

      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative bg-white rounded-xl shadow-xl w-full ${SIZE_CLASS[size]} flex flex-col max-h-[85vh] animate-slide-up focus:outline-none`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between shrink-0 gap-4">
          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-lg font-bold text-slate-800">{title}</h3>
            {description && (
              <p id={descId} className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          {!hideCloseButton && (
            <button
              type="button"
              title="Tutup"
              aria-label="Tutup dialog"
              onClick={onClose}
              className="shrink-0 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
