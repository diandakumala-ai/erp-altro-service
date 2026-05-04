import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Package, X, Clock, DollarSign, AlertTriangle, CalendarClock } from 'lucide-react';
import { useStore, computeStatusBayar } from '../store/useStore';
import { Link } from 'react-router-dom';
import { fmt } from '../lib/format';
import { isFinished } from './ui';

interface NotifItem {
  id: string;
  type: 'overdue' | 'stok' | 'piutang' | 'jatuhTempo' | 'akanJatuhTempo';
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
        <span className="text-2xs font-bold uppercase tracking-wider">{label}</span>
        <span className="ml-auto text-2xs font-semibold bg-white/70 px-1.5 py-0.5 rounded-full">
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
              <p className="text-tiny text-slate-400 truncate leading-snug">{n.desc}</p>
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

  const { overdueItems, stokItems, jatuhTempoItems, akanJatuhTempoItems, piutangItems } = useMemo(() => {
    // WO Overdue (operational — terlambat selesaikan, beda dari overdue pembayaran)
    const overdueItems: NotifItem[] = workOrders
      .filter(w =>
        !isFinished(w.status) &&
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

    // Stok kritis — konsisten dengan Laporan/Export (pakai <=, bukan <)
    const stokItems: NotifItem[] = inventory
      .filter(i => i.stok <= i.batasMinimum)
      .map(i => ({
        id: `stok-${i.id}`,
        type: 'stok' as const,
        title: i.nama,
        desc: `Sisa ${i.stok} ${i.satuan} (min. ${i.batasMinimum})`,
        to: '/inventory',
        severity: (i.stok === 0 ? 'high' : 'medium') as 'high' | 'medium',
      }))
      .sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));

    // Hitung piutang sekali, kategorikan ke 3 bucket
    const piutangAll = workOrders
      .filter(wo => wo.estimatedCost > 0)
      .map(wo => ({ wo, info: computeStatusBayar(wo, finance) }))
      .filter(({ info }) => info.status !== 'Lunas');

    // Bucket 1: SUDAH lewat jatuh tempo — paling urgent
    const jatuhTempoItems: NotifItem[] = piutangAll
      .filter(({ info }) => info.isOverdue)
      .map(({ wo, info }) => ({
        id: `jt-${wo.id}`,
        type: 'jatuhTempo' as const,
        title: `${wo.id} — ${wo.customer}`,
        desc: `Lewat ${Math.abs(info.hariKeJatuhTempo!)} hari · sisa Rp ${fmt(info.sisaTagihan)}`,
        to: '/finance',
        severity: 'high' as const,
      }))
      .sort((a, b) => {
        // Sort by hari lewat terbanyak dulu (yang paling lama nunggak)
        const aDays = parseInt(a.desc.match(/Lewat (\d+)/)?.[1] ?? '0', 10);
        const bDays = parseInt(b.desc.match(/Lewat (\d+)/)?.[1] ?? '0', 10);
        return bDays - aDays;
      })
      .slice(0, 10);

    // Bucket 2: AKAN jatuh tempo dalam 3 hari
    const akanJatuhTempoItems: NotifItem[] = piutangAll
      .filter(({ info }) => info.isDueSoon && !info.isOverdue)
      .map(({ wo, info }) => ({
        id: `ajt-${wo.id}`,
        type: 'akanJatuhTempo' as const,
        title: `${wo.id} — ${wo.customer}`,
        desc: info.hariKeJatuhTempo === 0
          ? `Jatuh tempo hari ini · sisa Rp ${fmt(info.sisaTagihan)}`
          : `${info.hariKeJatuhTempo} hari lagi · sisa Rp ${fmt(info.sisaTagihan)}`,
        to: '/finance',
        severity: (info.hariKeJatuhTempo === 0 ? 'high' : 'medium') as 'high' | 'medium',
      }))
      .sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1))
      .slice(0, 10);

    // Bucket 3: Piutang lain (belum jatuh tempo / COD belum bayar / NET tanpa invoice)
    // Exclude yang sudah masuk bucket 1 atau 2 untuk hindari duplikasi.
    const piutangItems: NotifItem[] = piutangAll
      .filter(({ info }) => !info.isOverdue && !info.isDueSoon)
      .map(({ wo, info }) => ({
        id: `piutang-${wo.id}`,
        type: 'piutang' as const,
        title: `${wo.id} — ${wo.customer}`,
        desc: `${info.status} · sisa Rp ${fmt(info.sisaTagihan)}`,
        to: '/finance',
        severity: (info.status === 'Belum Bayar' ? 'high' : 'medium') as 'high' | 'medium',
      }))
      .sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1))
      .slice(0, 10);

    return { overdueItems, stokItems, jatuhTempoItems, akanJatuhTempoItems, piutangItems };
  }, [workOrders, inventory, finance, today]);

  const totalCount = overdueItems.length + stokItems.length + jatuhTempoItems.length + akanJatuhTempoItems.length + piutangItems.length;

  // Calculate dropdown position from button's bounding rect
  const DROPDOWN_W = 320; // sesuai class w-80
  const computePosition = useCallback(() => {
    if (!btnRef.current) return null;
    const rect = btnRef.current.getBoundingClientRect();
    const dropH = Math.min(480, window.innerHeight - 32);
    const top = rect.bottom + rect.top - dropH > 16
      ? rect.bottom - dropH  // anchor bottom to button bottom
      : rect.top;            // or open downward if near top
    // Clamp horizontal: kalau bell di kanan layar, dropdown ke kiri bell.
    let left = rect.right + 12;
    if (left + DROPDOWN_W > window.innerWidth - 8) {
      left = Math.max(8, rect.left - DROPDOWN_W - 12);
    }
    return {
      top: Math.max(8, Math.min(top, window.innerHeight - dropH - 8)),
      left,
    };
  }, []);

  const openDropdown = useCallback(() => {
    const pos = computePosition();
    if (pos) {
      setDropPos(pos);
      setOpen(true);
    }
  }, [computePosition]);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click / page-level scroll, reposition on resize
  useEffect(() => {
    if (!open) return;
    const dropEl = () => document.getElementById('notif-dropdown');
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      // Keep open if clicking inside the dropdown (portal) or the button
      if (btnRef.current?.contains(target) || dropEl()?.contains(target)) return;
      close();
    };
    const onScroll = (e: Event) => {
      // Jangan tutup kalau user scroll DI DALAM dropdown (list panjang)
      const target = e.target as Node | null;
      if (target && dropEl()?.contains(target)) return;
      close();
    };
    const onResize = () => {
      const pos = computePosition();
      if (pos) setDropPos(pos);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onResize);
    };
  }, [open, close, computePosition]);

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
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-3xs font-bold rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown via Portal — bypasses all parent overflow:hidden */}
      {open && createPortal(
        <div
          id="notif-dropdown"
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 'var(--z-dropdown)' }}
          className="w-80 bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-slate-300" />
              <h4 className="text-sm font-semibold text-white">Notifikasi</h4>
              {totalCount > 0 && (
                <span className="bg-red-500 text-white text-2xs font-bold px-1.5 py-0.5 rounded-full leading-none">
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
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bell className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Semua Beres!</p>
              <p className="text-xs text-slate-400 mt-0.5">Tidak ada notifikasi saat ini</p>
            </div>
          ) : (
            <div className="overflow-y-auto divide-y divide-slate-100" style={{ maxHeight: 420 }}>
              {/* Urutan: paling urgent dulu */}
              {jatuhTempoItems.length > 0 && (
                <NotifSection
                  label="Tagihan Lewat Jatuh Tempo"
                  icon={AlertTriangle}
                  color="bg-red-100 text-red-700"
                  items={jatuhTempoItems}
                  emptyText=""
                  onClose={close}
                />
              )}
              {akanJatuhTempoItems.length > 0 && (
                <NotifSection
                  label="Akan Jatuh Tempo (≤3 hari)"
                  icon={CalendarClock}
                  color="bg-amber-100 text-amber-700"
                  items={akanJatuhTempoItems}
                  emptyText=""
                  onClose={close}
                />
              )}
              <NotifSection
                label="SPK Terlambat (operasional)"
                icon={Clock}
                color="bg-red-50 text-red-600"
                items={overdueItems}
                emptyText="Tidak ada WO yang terlambat selesaikan"
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
                label="Piutang Lain"
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
            <div className="border-t border-slate-100 px-4 py-2 bg-slate-50 flex justify-between text-tiny text-slate-400 shrink-0">
              <span className="truncate">
                {[
                  jatuhTempoItems.length > 0 && `${jatuhTempoItems.length} lewat tempo`,
                  akanJatuhTempoItems.length > 0 && `${akanJatuhTempoItems.length} akan tempo`,
                  overdueItems.length > 0 && `${overdueItems.length} telat selesai`,
                  stokItems.length > 0 && `${stokItems.length} stok`,
                  piutangItems.length > 0 && `${piutangItems.length} piutang`,
                ].filter(Boolean).join(' · ')}
              </span>
              <span className="text-slate-300 shrink-0 ml-2">Klik untuk detail →</span>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
