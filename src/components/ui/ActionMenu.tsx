import { useState, useRef, useEffect, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface MenuAction {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  /** Tampilkan sebagai destruktif (warna merah). */
  destructive?: boolean;
  /** Pisahkan action ini dengan separator di atasnya. */
  separator?: boolean;
}

interface ActionMenuProps {
  actions: MenuAction[];
  /** Custom trigger (default: tombol icon ⋯). */
  trigger?: ReactNode;
  /** Aria label untuk trigger button bawaan. */
  ariaLabel?: string;
  /** Posisi menu relatif trigger. */
  align?: 'left' | 'right';
}

/**
 * Dropdown menu aksi — accessible alternative untuk `<select>` aksi.
 * Sebelumnya WO pakai <select> dengan emoji 📝🖨️🗑️ — tidak konsisten OS,
 * dan mencampur action destruktif (Hapus) dengan non-destruktif (Cetak).
 */
export function ActionMenu({ actions, trigger, ariaLabel = 'Buka menu aksi', align = 'right' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 transition-colors"
      >
        {trigger ?? <MoreHorizontal className="w-4 h-4" aria-hidden="true" />}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute mt-1 ${align === 'right' ? 'right-0' : 'left-0'} min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden`}
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          {actions.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i}>
                {a.separator && <div className="border-t border-slate-100 my-1" role="separator" />}
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => { a.onClick(); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors focus-visible:outline-none focus-visible:bg-slate-100 ${
                    a.destructive
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {Icon && <Icon className={`w-4 h-4 shrink-0 ${a.destructive ? 'text-red-500' : 'text-slate-400'}`} aria-hidden="true" />}
                  <span>{a.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
