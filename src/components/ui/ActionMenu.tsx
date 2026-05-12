import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
 *
 * - Default trigger (no `trigger` prop): icon-only button 44×44 / 32×32.
 * - Custom trigger: button auto-size, hanya bawa focus-ring; styling penuh
 *   diserahkan ke caller via element yg di-pass.
 * - Dropdown panel: di-render via React portal supaya tidak ter-clip oleh
 *   ancestor yg pakai `overflow-hidden` (mis. komponen Section). Posisi
 *   dihitung via getBoundingClientRect() dan re-track scroll/resize.
 */
export function ActionMenu({ actions, trigger, ariaLabel = 'Buka menu aksi', align = 'right' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasCustomTrigger = !!trigger;

  // Track posisi trigger untuk re-position menu yg di-portal-kan
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4, // mt-1 ≈ 4px
        left: rect.left,
        right: window.innerWidth - rect.right,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
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

  const triggerClass = hasCustomTrigger
    ? 'inline-flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
    : 'inline-flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 transition-colors';

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={ariaLabel}
        onClick={() => setOpen(v => !v)}
        className={triggerClass}
      >
        {trigger ?? <MoreHorizontal className="w-4 h-4" aria-hidden="true" />}
      </button>
      {open && menuPos && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed min-w-[200px] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
          style={{
            zIndex: 'var(--z-dropdown)',
            top: menuPos.top,
            ...(align === 'right' ? { right: menuPos.right } : { left: menuPos.left }),
          }}
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
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 text-sm text-left min-h-[44px] sm:min-h-0 transition-colors focus-visible:outline-none focus-visible:bg-slate-100 ${
                    a.destructive
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {Icon && <Icon className={`w-4 h-4 shrink-0 ${a.destructive ? 'text-red-500' : 'text-slate-400'}`} aria-hidden="true" />}
                  <span className="truncate">{a.label}</span>
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
