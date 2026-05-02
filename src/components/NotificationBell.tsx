import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Package, X, Clock, DollarSign } from 'lucide-react';
import { useStore, computeStatusBayar } from '../store/useStore';
import { Link } from 'react-router-dom';

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);

interface NotifItem {
  id: string;
  type: 'overdue' | 'stok' | 'piutang';
  title: string;
  desc: string;
  to: string;
  severity: 'high' | 'medium';
}

// ─── Section component (module-level, not nested) ────────────────────────────
function NotifSection({
  label, icon: Icon, color, items, emptyText, onClose,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  items: NotifItem[];
  emptyText: string;
  onClose: () => void;
}) {
  return (
    <div>
      <div className={`flex items-center gap-2 px-4 py-2 ${color}`}>
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        <span className="ml-auto text-[10px] font-semibold bg-white/70 px-1.5 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-2.5 text-xs text-slate-400 italic">{emptyText}</p>
      ) : (
        items.map(n => (
          <Link
            key={n.id}
            to={n.to}
            onClick={onClose}
            className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
              n.severity === 'high' ? 'bg-red-500' : 'bg-amber-400'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 leading-snug truncate">{n.title}</p>
              <p className="text-[11px] text-slate-400 truncate leading-snug">{n.desc}</p>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const workOrders = useStore(s => s.workOrders);
  const inventory  = useStore(s => s.inventory);
  const finance    = useStore(s => s.finance);

  const today = new Date().toISOString().split('T')[0];

  const { overdueItems, stokItems, piutangItems } = useMemo(() => {
    // WO Overdue
    const overdueItems: NotifItem[] = workOrders
      .filter(w =>
        !['Finished', 'Picked Up'].includes(w.status) &&
        w.estimasiSelesai !== '-' &&
        w.estimasiSelesai < today
      )
      .map(w => {
        const days = Math.ceil(
          (Date.parse(today) - Date.parse(w.estimasiSelesai)) / 86400000
        );
        return {
          id: `overdue-${w.id}`,
          type: 'overdue' as const,
          title: `${w.id} — ${w.merk}`,
          desc: `${w.customer} · terlambat ${days} hari`,
          to: '/work-orders',
          severity: (days >= 7 ? 'high' : 'medium') as 'high' | 'medium',
        };
      })
      .sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));

    // Stok kritis
    const stokItems: NotifItem[] = inventory
      .filter(i => i.stok < i.batasMinimum)
      .map(i => ({
        id: `stok-${i.id}`,
        type: 'stok' as const,
        title: i.nama,
        desc: `Sisa ${i.stok} ${i.satuan} (min. ${i.batasMinimum})`,
        to: '/inventory',
        severity: (i.stok === 0 ? 'high' : 'medium') as 'high' | 'medium',
      }))
      .sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));

    // Piutang (Belum Bayar & DP)
    const piutangItems: NotifItem[] = workOrders
      .filter(wo => {
        if (wo.estimatedCost <= 0) return false;
        const { status } = computeStatusBayar(wo, finance);
        return status === 'Belum Bayar' || status === 'DP';
      })
      .map(wo => {
        const { status, sisaTagihan } = computeStatusBayar(wo, finance);
        return {
          id: `piutang-${wo.id}`,
          type: 'piutang' as const,
          title: `${wo.id} — ${wo.customer}`,
          desc: `${status} · sisa Rp ${fmt(sisaTagihan)}`,
          to: '/finance',
          severity: (status === 'Belum Bayar' ? 'high' : 'medium') as 'high' | 'medium',
        };
      })
      .sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1))
      .slice(0, 10);

    return { overdueItems, stokItems, piutangItems };
  }, [workOrders, inventory, finance, today]);

  const totalCount = overdueItems.length + stokItems.length + piutangItems.length;

  // Calculate dropdown position from button's bounding rect
  const openDropdown = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const dropH = Math.min(480, window.innerHeight - 32);
    const top = rect.bottom + rect.top - dropH > 16
      ? rect.bottom - dropH  // anchor bottom to button bottom
      : rect.top;            // or open downward if near top
    setDropPos({
      top: Math.max(8, Math.min(top, window.innerHeight - dropH - 8)),
      left: rect.right + 12,
    });
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click / scroll
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // Keep open if clicking inside the dropdown (portal) or the button
      const dropEl = document.getElementById('notif-dropdown');
      if (btnRef.current?.contains(target) || dropEl?.contains(target)) return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      window.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [open, close]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Bell Button */}
      <button
        ref={btnRef}
        onClick={() => (open ? close() : openDropdown())}
        className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors shrink-0 ${
          open
            ? 'text-white bg-slate-700'
            : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`}
        title={totalCount > 0 ? `${totalCount} notifikasi` : 'Tidak ada notifikasi'}
        aria-label="Notifikasi"
      >
        <Bell className={`w-4 h-4 ${totalCount > 0 ? 'animate-[wiggle_3s_ease-in-out_infinite]' : ''}`} />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown via Portal — bypasses all parent overflow:hidden */}
      {open && createPortal(
        <div
          id="notif-dropdown"
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="w-80 bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-slate-300" />
              <h4 className="text-sm font-semibold text-white">Notifikasi</h4>
              {totalCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {totalCount}
                </span>
              )}
            </div>
            <button
              onClick={close}
              className="text-slate-400 hover:text-white transition-colors p-0.5 rounded"
              aria-label="Tutup"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          {totalCount === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Semua Beres!</p>
              <p className="text-xs text-slate-400 mt-0.5">Tidak ada notifikasi saat ini</p>
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-slate-100" style={{ maxHeight: 380 }}>
              <NotifSection
                label="WO Terlambat"
                icon={Clock}
                color="bg-red-50 text-red-600"
                items={overdueItems}
                emptyText="Tidak ada WO yang terlambat"
                onClose={close}
              />
              <NotifSection
                label="Stok Kritis"
                icon={Package}
                color="bg-amber-50 text-amber-600"
                items={stokItems}
                emptyText="Semua stok di atas batas minimum"
                onClose={close}
              />
              <NotifSection
                label="Piutang Belum Lunas"
                icon={DollarSign}
                color="bg-orange-50 text-orange-600"
                items={piutangItems}
                emptyText="Tidak ada piutang tertunggak"
                onClose={close}
              />
            </div>
          )}

          {/* Footer */}
          {totalCount > 0 && (
            <div className="border-t border-slate-100 px-4 py-2 bg-slate-50 flex justify-between text-[11px] text-slate-400 shrink-0">
              <span>
                {overdueItems.length > 0 && `${overdueItems.length} terlambat`}
                {overdueItems.length > 0 && stokItems.length > 0 && ' · '}
                {stokItems.length > 0 && `${stokItems.length} stok kritis`}
                {(overdueItems.length > 0 || stokItems.length > 0) && piutangItems.length > 0 && ' · '}
                {piutangItems.length > 0 && `${piutangItems.length} piutang`}
              </span>
              <span className="text-slate-300">Klik untuk detail →</span>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
