import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell, Package, X, Clock, DollarSign, AlertTriangle, CalendarClock,
  CheckCircle2, BellOff, RotateCcw,
} from 'lucide-react';
import { useStore, computeStatusBayar } from '../store/useStore';
import { Link } from 'react-router-dom';
import { fmt } from '../lib/format';
import { isFinished } from './ui';

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = 'overdue' | 'stok' | 'piutang' | 'jatuhTempo' | 'akanJatuhTempo';
type Severity = 'high' | 'medium';

interface NotifItem {
  id: string;
  type: NotifType;
  title: string;
  desc: string;
  to: string;
  severity: Severity;
  /** Badge eksplisit (mis. "HABIS") opsional. */
  badge?: { text: string; tone: 'red' | 'amber' | 'slate' };
}

// ─── Snooze (localStorage 24h) ────────────────────────────────────────────────
const SNOOZE_KEY = 'altro-notif-snooze-v1';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 jam

type SnoozeMap = Record<string, number>; // itemId → expiry epoch ms

function loadSnooze(): SnoozeMap {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnoozeMap;
    const now = Date.now();
    // Auto-clean expired
    return Object.fromEntries(
      Object.entries(parsed).filter(([, expiry]) => expiry > now)
    );
  } catch {
    return {};
  }
}

function saveSnooze(map: SnoozeMap): void {
  try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

// ─── Item Row ────────────────────────────────────────────────────────────────
const TYPE_ICON: Record<NotifType, React.ElementType> = {
  jatuhTempo:     AlertTriangle,
  akanJatuhTempo: CalendarClock,
  overdue:        Clock,
  stok:           Package,
  piutang:        DollarSign,
};

const TYPE_ICON_COLOR: Record<NotifType, string> = {
  jatuhTempo:     'text-red-600 bg-red-50',
  akanJatuhTempo: 'text-amber-600 bg-amber-50',
  overdue:        'text-red-500 bg-red-50',
  stok:           'text-amber-600 bg-amber-50',
  piutang:        'text-orange-600 bg-orange-50',
};

const BADGE_TONE: Record<NonNullable<NotifItem['badge']>['tone'], string> = {
  red:   'bg-red-100 text-red-700 border-red-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

function NotifRow({ item, onSnooze, onClose }: {
  item: NotifItem;
  onSnooze: (id: string) => void;
  onClose: () => void;
}) {
  const Icon = TYPE_ICON[item.type];
  const iconColor = TYPE_ICON_COLOR[item.type];

  return (
    <div className="group flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 relative">
      <Link
        to={item.to}
        onClick={onClose}
        className="flex items-start gap-3 flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded -mx-1 px-1"
      >
        {/* Icon */}
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`} aria-hidden="true">
          <Icon className="w-3.5 h-3.5" />
        </div>
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-slate-700 leading-snug truncate">{item.title}</p>
            {item.badge && (
              <span className={`text-3xs font-bold uppercase px-1.5 py-0.5 rounded border ${BADGE_TONE[item.badge.tone]} shrink-0`}>
                {item.badge.text}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-snug mt-0.5 line-clamp-2">{item.desc}</p>
        </div>
        {/* Severity dot */}
        <div
          className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${item.severity === 'high' ? 'bg-red-500' : 'bg-amber-400'}`}
          aria-label={item.severity === 'high' ? 'prioritas tinggi' : 'prioritas medium'}
        />
      </Link>
      {/* Snooze button — visible on hover/focus */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSnooze(item.id); }}
        title="Tunda 24 jam"
        aria-label={`Tunda notifikasi "${item.title}" selama 24 jam`}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      >
        <BellOff className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────
function NotifSection({
  label, icon: Icon, color, items, hiddenCount, onSnooze, onClose,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  items: NotifItem[];
  /** Item ekstra yang ter-cap karena slice. */
  hiddenCount: number;
  onSnooze: (id: string) => void;
  onClose: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`flex items-center gap-2 px-4 py-2 ${color} sticky top-0`} style={{ zIndex: 1 }}>
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="ml-auto text-2xs font-bold bg-white/80 px-1.5 py-0.5 rounded-full">
          {items.length + hiddenCount}
        </span>
      </div>
      {items.map(n => (
        <NotifRow key={n.id} item={n} onSnooze={onSnooze} onClose={onClose} />
      ))}
      {hiddenCount > 0 && (
        <div className="px-4 py-1.5 bg-slate-50 text-xs text-slate-500 text-center border-b border-slate-100">
          +{hiddenCount} lainnya · buka halaman terkait untuk melihat semua
        </div>
      )}
    </div>
  );
}

// ─── Helper: today yang refresh otomatis ──────────────────────────────────────
function useTodayISO(): string {
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const tick = () => {
      const next = new Date().toISOString().slice(0, 10);
      setToday(prev => (prev !== next ? next : prev));
    };
    // Refresh saat tab kembali aktif (kalau lewat tengah malam saat idle)
    const onVisibility = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    // Polling per menit sebagai safety net
    const i = window.setInterval(tick, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(i);
    };
  }, []);
  return today;
}

// ─── Main component ───────────────────────────────────────────────────────────
const ITEMS_PER_BUCKET = 5; // tampil maks 5 per kategori, sisanya "+N lainnya"

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const workOrders = useStore(s => s.workOrders);
  const inventory  = useStore(s => s.inventory);
  const finance    = useStore(s => s.finance);

  const today = useTodayISO();

  // Snooze state — disimpan di localStorage, di-prune saat dimuat
  const [snoozeMap, setSnoozeMap] = useState<SnoozeMap>(loadSnooze);
  const snooze = useCallback((id: string) => {
    const next = { ...snoozeMap, [id]: Date.now() + SNOOZE_DURATION_MS };
    setSnoozeMap(next);
    saveSnooze(next);
  }, [snoozeMap]);
  const resetSnooze = useCallback(() => {
    setSnoozeMap({});
    saveSnooze({});
  }, []);
  const isSnoozed = useCallback((id: string) => {
    const exp = snoozeMap[id];
    return exp != null && exp > Date.now();
  }, [snoozeMap]);

  // ── Compute notif buckets ───────────────────────────────────────────────────
  const buckets = useMemo(() => {
    // SPK telat selesai (operational)
    const overdueAll: NotifItem[] = workOrders
      .filter(w => !isFinished(w.status) && w.estimasiSelesai && w.estimasiSelesai !== '-' && w.estimasiSelesai < today)
      .map(w => {
        const days = Math.ceil((Date.parse(today) - Date.parse(w.estimasiSelesai)) / 86_400_000);
        return {
          id: `overdue-${w.id}`,
          type: 'overdue' as const,
          title: `${w.id} — ${w.merk}`,
          desc: `${w.customer} · terlambat ${days} hari (est. ${w.estimasiSelesai})`,
          to: '/work-orders',
          severity: (days >= 7 ? 'high' : 'medium') as Severity,
        };
      })
      .sort((a, b) => {
        const aDays = parseInt(a.desc.match(/terlambat (\d+)/)?.[1] ?? '0', 10);
        const bDays = parseInt(b.desc.match(/terlambat (\d+)/)?.[1] ?? '0', 10);
        return bDays - aDays;
      });

    // Stok kritis
    const stokAll: NotifItem[] = inventory
      .filter(i => i.stok <= i.batasMinimum)
      .map(i => {
        const isHabis = i.stok === 0;
        return {
          id: `stok-${i.id}`,
          type: 'stok' as const,
          title: i.nama,
          desc: isHabis
            ? `Stok kosong! Min. ${i.batasMinimum} ${i.satuan}`
            : `Sisa ${i.stok} ${i.satuan} dari minimum ${i.batasMinimum} ${i.satuan}`,
          to: '/inventory',
          severity: (isHabis ? 'high' : 'medium') as Severity,
          badge: isHabis ? { text: 'Habis', tone: 'red' as const } : undefined,
        };
      })
      .sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));

    // Piutang — hitung sekali, kategorikan
    const piutangAll = workOrders
      .filter(wo => wo.estimatedCost > 0)
      .map(wo => ({ wo, info: computeStatusBayar(wo, finance) }))
      .filter(({ info }) => info.status !== 'Lunas');

    // Bucket: SUDAH lewat jatuh tempo
    const jatuhTempoAll: NotifItem[] = piutangAll
      .filter(({ info }) => info.isOverdue)
      .map(({ wo, info }) => {
        const lewat = Math.abs(info.hariKeJatuhTempo!);
        return {
          id: `jt-${wo.id}`,
          type: 'jatuhTempo' as const,
          title: `${wo.id} — ${wo.customer}`,
          desc: `Lewat jatuh tempo ${lewat} hari · sisa Rp ${fmt(info.sisaTagihan)}`,
          to: '/finance',
          severity: 'high' as Severity,
          badge: lewat >= 30
            ? { text: `${lewat}h`, tone: 'red' as const }
            : undefined,
        };
      })
      .sort((a, b) => {
        const aDays = parseInt(a.desc.match(/(\d+) hari/)?.[1] ?? '0', 10);
        const bDays = parseInt(b.desc.match(/(\d+) hari/)?.[1] ?? '0', 10);
        return bDays - aDays;
      });

    // Bucket: AKAN jatuh tempo dalam 3 hari (bukan overdue)
    const akanJatuhTempoAll: NotifItem[] = piutangAll
      .filter(({ info }) => info.isDueSoon && !info.isOverdue)
      .map(({ wo, info }) => ({
        id: `ajt-${wo.id}`,
        type: 'akanJatuhTempo' as const,
        title: `${wo.id} — ${wo.customer}`,
        desc: info.hariKeJatuhTempo === 0
          ? `Jatuh tempo HARI INI · sisa Rp ${fmt(info.sisaTagihan)}`
          : `${info.hariKeJatuhTempo} hari lagi · sisa Rp ${fmt(info.sisaTagihan)}`,
        to: '/finance',
        severity: (info.hariKeJatuhTempo === 0 ? 'high' : 'medium') as Severity,
      }))
      // Sort by hari ascending (paling dekat dulu)
      .sort((a, b) => {
        const aDays = a.desc.startsWith('Jatuh tempo HARI INI') ? 0 : parseInt(a.desc.match(/(\d+) hari/)?.[1] ?? '99', 10);
        const bDays = b.desc.startsWith('Jatuh tempo HARI INI') ? 0 : parseInt(b.desc.match(/(\d+) hari/)?.[1] ?? '99', 10);
        return aDays - bDays;
      });

    // Bucket: Piutang lain (belum tempo / COD / NET tanpa invoice)
    const piutangLainAll: NotifItem[] = piutangAll
      .filter(({ info }) => !info.isOverdue && !info.isDueSoon)
      .map(({ wo, info }) => ({
        id: `piutang-${wo.id}`,
        type: 'piutang' as const,
        title: `${wo.id} — ${wo.customer}`,
        desc: `${info.status === 'DP' ? 'DP sebagian' : info.status} · sisa Rp ${fmt(info.sisaTagihan)}`,
        to: '/finance',
        severity: (info.status === 'Belum Bayar' ? 'high' : 'medium') as Severity,
      }))
      .sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1));

    // Filter snoozed dari setiap bucket
    const filterSnoozed = (arr: NotifItem[]) => arr.filter(item => !isSnoozed(item.id));

    const overdue       = filterSnoozed(overdueAll);
    const stok          = filterSnoozed(stokAll);
    const jatuhTempo    = filterSnoozed(jatuhTempoAll);
    const akanJatuhTempo= filterSnoozed(akanJatuhTempoAll);
    const piutangLain   = filterSnoozed(piutangLainAll);

    const snoozedCount =
      (overdueAll.length - overdue.length) +
      (stokAll.length - stok.length) +
      (jatuhTempoAll.length - jatuhTempo.length) +
      (akanJatuhTempoAll.length - akanJatuhTempo.length) +
      (piutangLainAll.length - piutangLain.length);

    return { overdue, stok, jatuhTempo, akanJatuhTempo, piutangLain, snoozedCount };
  }, [workOrders, inventory, finance, today, isSnoozed]);

  // Sliced views (untuk tampilan) + hidden count (untuk badge "+N lainnya")
  const sliced = useMemo(() => {
    const slice = (items: NotifItem[]) => ({
      items: items.slice(0, ITEMS_PER_BUCKET),
      hidden: Math.max(0, items.length - ITEMS_PER_BUCKET),
    });
    return {
      overdue: slice(buckets.overdue),
      stok: slice(buckets.stok),
      jatuhTempo: slice(buckets.jatuhTempo),
      akanJatuhTempo: slice(buckets.akanJatuhTempo),
      piutangLain: slice(buckets.piutangLain),
    };
  }, [buckets]);

  const totalActive =
    buckets.overdue.length + buckets.stok.length +
    buckets.jatuhTempo.length + buckets.akanJatuhTempo.length +
    buckets.piutangLain.length;

  // ── Wiggle animation hanya saat count berubah (bukan terus) ─────────────────
  const [wiggle, setWiggle] = useState(false);
  const prevCountRef = useRef(totalActive);
  useEffect(() => {
    if (totalActive > prevCountRef.current) {
      setWiggle(true);
      const t = window.setTimeout(() => setWiggle(false), 1000);
      prevCountRef.current = totalActive;
      return () => window.clearTimeout(t);
    }
    prevCountRef.current = totalActive;
  }, [totalActive]);

  // ── Drop position ──────────────────────────────────────────────────────────
  const DROPDOWN_W = 384; // w-96
  const computePosition = useCallback(() => {
    if (!btnRef.current) return null;
    const rect = btnRef.current.getBoundingClientRect();
    const dropH = Math.min(560, window.innerHeight - 32);
    const top = rect.bottom + rect.top - dropH > 16 ? rect.bottom - dropH : rect.top;
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

  // Outside click + Esc + reposition on resize
  useEffect(() => {
    if (!open) return;
    const dropEl = () => document.getElementById('notif-dropdown');
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || dropEl()?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); btnRef.current?.focus(); }
    };
    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && dropEl()?.contains(target)) return;
      close();
    };
    const onResize = () => {
      const pos = computePosition();
      if (pos) setDropPos(pos);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onResize);
    };
  }, [open, close, computePosition]);

  // ── Last updated label ──────────────────────────────────────────────────────
  // Refresh tiap kali data berubah (workOrders/inventory/finance via useMemo trigger)
  // Dipakai untuk indikator "Diperbarui baru saja"
  const lastUpdated = useMemo(() => Date.now(), [workOrders, inventory, finance]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!open) return;
    const i = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(i);
  }, [open]);
  const lastUpdatedLabel = useMemo(() => {
    const diffSec = Math.floor((now - lastUpdated) / 1000);
    if (diffSec < 30) return 'baru saja';
    if (diffSec < 60) return `${diffSec} detik lalu`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} jam lalu`;
    return `${Math.floor(diffH / 24)} hari lalu`;
  }, [now, lastUpdated]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <button
        ref={btnRef}
        onClick={() => (open ? close() : openDropdown())}
        className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          open ? 'text-white bg-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }`}
        title={totalActive > 0 ? `${totalActive} notifikasi aktif` : 'Tidak ada notifikasi'}
        aria-label={`Notifikasi${totalActive > 0 ? ` (${totalActive})` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className={`w-4 h-4 ${wiggle ? 'animate-[wiggle_0.8s_ease-in-out]' : ''}`} aria-hidden="true" />
        {totalActive > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-3xs font-bold rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
            {totalActive > 99 ? '99+' : totalActive}
          </span>
        )}
      </button>

      {open && dropPos && createPortal(
        <div
          id="notif-dropdown"
          role="dialog"
          aria-label="Daftar notifikasi"
          style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 'var(--z-dropdown)' }}
          className="w-96 max-w-[calc(100vw-1rem)] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
              <h4 className="text-sm font-semibold text-white">Notifikasi</h4>
              {totalActive > 0 && (
                <span className="bg-red-500 text-white text-2xs font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0">
                  {totalActive}
                </span>
              )}
              {buckets.snoozedCount > 0 && (
                <span
                  className="text-2xs text-slate-300 truncate"
                  title={`${buckets.snoozedCount} notifikasi sedang ditunda`}
                >
                  · {buckets.snoozedCount} ditunda
                </span>
              )}
            </div>
            <button
              onClick={close}
              className="text-slate-400 hover:text-white transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          {totalActive === 0 ? (
            <div className="py-12 px-6 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Semua beres!</p>
              <p className="text-xs text-slate-500 mt-1">
                {buckets.snoozedCount > 0
                  ? `${buckets.snoozedCount} notifikasi sedang ditunda.`
                  : 'Tidak ada item yang perlu diperhatikan saat ini.'}
              </p>
              {buckets.snoozedCount > 0 && (
                <button
                  type="button"
                  onClick={resetSnooze}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium focus-visible:outline-none focus-visible:underline"
                >
                  <RotateCcw className="w-3 h-3" /> Tampilkan kembali
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
              {/* Urutan: paling urgent dulu */}
              <NotifSection
                label="Lewat Jatuh Tempo"
                icon={AlertTriangle}
                color="bg-red-100 text-red-700"
                items={sliced.jatuhTempo.items}
                hiddenCount={sliced.jatuhTempo.hidden}
                onSnooze={snooze}
                onClose={close}
              />
              <NotifSection
                label="Akan Jatuh Tempo (≤3 hari)"
                icon={CalendarClock}
                color="bg-amber-100 text-amber-700"
                items={sliced.akanJatuhTempo.items}
                hiddenCount={sliced.akanJatuhTempo.hidden}
                onSnooze={snooze}
                onClose={close}
              />
              <NotifSection
                label="SPK Telat Selesai"
                icon={Clock}
                color="bg-red-50 text-red-600"
                items={sliced.overdue.items}
                hiddenCount={sliced.overdue.hidden}
                onSnooze={snooze}
                onClose={close}
              />
              <NotifSection
                label="Stok Kritis"
                icon={Package}
                color="bg-amber-50 text-amber-700"
                items={sliced.stok.items}
                hiddenCount={sliced.stok.hidden}
                onSnooze={snooze}
                onClose={close}
              />
              <NotifSection
                label="Piutang Belum Tempo"
                icon={DollarSign}
                color="bg-orange-50 text-orange-700"
                items={sliced.piutangLain.items}
                hiddenCount={sliced.piutangLain.hidden}
                onSnooze={snooze}
                onClose={close}
              />
            </div>
          )}

          {/* Footer */}
          {totalActive > 0 && (
            <div className="border-t border-slate-100 px-4 py-2.5 bg-slate-50 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xs text-slate-500">
                  Diperbarui {lastUpdatedLabel}
                </span>
                {buckets.snoozedCount > 0 && (
                  <button
                    type="button"
                    onClick={resetSnooze}
                    className="inline-flex items-center gap-1 text-2xs text-indigo-600 hover:text-indigo-800 font-medium focus-visible:outline-none focus-visible:underline"
                    title="Tampilkan kembali notifikasi yang ditunda"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset {buckets.snoozedCount} tunda
                  </button>
                )}
              </div>
              <p className="text-2xs text-slate-400 mt-1 italic">
                Tip: arahkan kursor ke notifikasi → klik <BellOff className="w-2.5 h-2.5 inline-block" /> untuk tunda 24 jam.
              </p>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
