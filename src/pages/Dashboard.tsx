import { useMemo } from 'react';
import { useStore, computeStatusBayar } from '../store/useStore';
import {
  Wrench, Package, TrendingUp, TrendingDown, AlertTriangle,
  Clock, CheckCircle, Users, ArrowRight, Activity,
  Eye, FlaskConical, PackageCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ── Status Pill terpusat dengan ikon (WCAG color-only fix) ───────────────────
const STATUS_CONFIG: Record<string, { bg: string; icon: React.ElementType }> = {
  'Queue':      { bg: 'bg-slate-100 text-slate-600',   icon: Clock },
  'Inspecting': { bg: 'bg-yellow-100 text-yellow-700', icon: Eye },
  'Repairing':  { bg: 'bg-blue-100 text-blue-700',     icon: Wrench },
  'Testing':    { bg: 'bg-purple-100 text-purple-700', icon: FlaskConical },
  'Finished':   { bg: 'bg-green-100 text-green-700',   icon: CheckCircle },
  'Picked Up':  { bg: 'bg-teal-100 text-teal-700',     icon: PackageCheck },
};

export function StatusPill({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' }) {
  const cfg = STATUS_CONFIG[status] ?? { bg: 'bg-slate-100 text-slate-600', icon: Clock };
  const Icon = cfg.icon;
  const textSize = size === 'xs' ? 'text-2xs' : 'text-xs';
  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${textSize} ${cfg.bg}`}>
      <Icon className={`${iconSize} shrink-0`} />
      {status}
    </span>
  );
}

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} Rb`;
  return String(n);
};

function KpiCard({
  title, value, sub, icon: Icon, color, to
}: {
  title: string; value: string; sub?: string;
  icon: React.ElementType; color: string; to?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start justify-between group transition-all hover:shadow-md ${to ? 'cursor-pointer hover:border-indigo-300' : ''}`}>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-black text-slate-800 mt-1">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      {to && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 absolute right-4 bottom-4 transition-colors" />}
    </div>
  );
  return to ? <Link to={to} className="relative block">{inner}</Link> : <div className="relative">{inner}</div>;
}

export default function Dashboard() {
  const workOrders = useStore(s => s.workOrders);
  const inventory = useStore(s => s.inventory);
  const finance = useStore(s => s.finance);
  const customers = useStore(s => s.customers);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  const stats = useMemo(() => {
    const aktif = workOrders.filter(w => !['Finished', 'Picked Up'].includes(w.status));
    const selesai = workOrders.filter(w => ['Finished', 'Picked Up'].includes(w.status));
    const overdue = aktif.filter(w => w.estimasiSelesai !== '-' && w.estimasiSelesai < today);

    const stokKritis = inventory.filter(i => i.stok <= i.batasMinimum);

    const pemasukan = finance.filter(f => f.nominal > 0 && f.tanggal.startsWith(thisMonth));
    const pengeluaran = finance.filter(f => f.nominal < 0 && f.tanggal.startsWith(thisMonth));
    const revBulanIni = pemasukan.reduce((a, f) => a + f.nominal, 0);
    const expBulanIni = Math.abs(pengeluaran.reduce((a, f) => a + f.nominal, 0));

    // Piutang belum lunas
    const piutangWOs = workOrders.filter(wo => {
      if (wo.estimatedCost <= 0) return false;
      const { status } = computeStatusBayar(wo, finance);
      return status !== 'Lunas';
    });
    const totalPiutang = piutangWOs.reduce((acc, wo) => {
      const { sisaTagihan } = computeStatusBayar(wo, finance);
      return acc + sisaTagihan;
    }, 0);

    // Grafik 6 bulan terakhir
    const months: { label: string; key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      });
    }
    const chartData = months.map(m => ({
      label: m.label,
      pemasukan: finance.filter(f => f.nominal > 0 && f.tanggal.startsWith(m.key)).reduce((a, f) => a + f.nominal, 0),
      pengeluaran: Math.abs(finance.filter(f => f.nominal < 0 && f.tanggal.startsWith(m.key)).reduce((a, f) => a + f.nominal, 0)),
    }));

    // Aktivitas terbaru (5 WO terakhir masuk)
    const recentWOs = [...workOrders]
      .sort((a, b) => b.dateIn.localeCompare(a.dateIn))
      .slice(0, 5);

    return { aktif, selesai, overdue, stokKritis, revBulanIni, expBulanIni, totalPiutang, chartData, recentWOs, piutangWOs };
  }, [workOrders, inventory, finance, today, thisMonth]);

  const maxChart = Math.max(...stats.chartData.map(d => Math.max(d.pemasukan, d.pengeluaran)), 1);

  // statusColor masih digunakan untuk chart progress bar section
  const statusColor: Record<string, string> = {
    'Queue': 'bg-slate-100 text-slate-600',
    'Inspecting': 'bg-yellow-100 text-yellow-700',
    'Repairing': 'bg-blue-100 text-blue-700',
    'Testing': 'bg-purple-100 text-purple-700',
    'Finished': 'bg-green-100 text-green-700',
    'Picked Up': 'bg-teal-100 text-teal-700',
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-12 flex items-center px-6 justify-between shrink-0">
        <h2 className="text-base font-semibold text-slate-800">Dashboard</h2>
        <p className="text-xs text-slate-400">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </header>

      <main className="flex-1 p-5 overflow-y-auto">
        {/* Alert overdue & stok kritis */}
        {(stats.overdue.length > 0 || stats.stokKritis.length > 0) && (
          <div className="mb-4 flex flex-col gap-2">
            {stats.overdue.length > 0 && (
              <Link to="/work-orders" className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm hover:bg-red-100 transition-colors">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span><b>{stats.overdue.length} Work Order</b> melewati estimasi selesai dan belum diselesaikan!</span>
                <ArrowRight className="w-4 h-4 ml-auto shrink-0" />
              </Link>
            )}
            {stats.stokKritis.length > 0 && (
              <Link to="/inventory" className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 rounded-xl text-sm hover:bg-amber-100 transition-colors">
                <Package className="w-4 h-4 shrink-0" />
                <span><b>{stats.stokKritis.length} item stok</b> sudah di bawah batas minimum, segera restok!</span>
                <ArrowRight className="w-4 h-4 ml-auto shrink-0" />
              </Link>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <KpiCard
            title="Revenue Bulan Ini"
            value={`Rp ${fmtShort(stats.revBulanIni)}`}
            sub={`Pengeluaran: Rp ${fmtShort(stats.expBulanIni)}`}
            icon={TrendingUp}
            color="bg-green-100 text-green-600"
            to="/finance"
          />
          <KpiCard
            title="WO Aktif"
            value={String(stats.aktif.length)}
            sub={`${stats.selesai.length} sudah selesai`}
            icon={Wrench}
            color="bg-indigo-100 text-indigo-600"
            to="/work-orders"
          />
          <KpiCard
            title="Piutang Belum Lunas"
            value={`Rp ${fmtShort(stats.totalPiutang)}`}
            sub={`${stats.piutangWOs.length} WO belum lunas`}
            icon={TrendingDown}
            color="bg-orange-100 text-orange-600"
            to="/finance"
          />
          <KpiCard
            title="Total Pelanggan"
            value={String(customers.length)}
            sub={`${customers.filter(c => c.totalWo > 0).length} pelanggan aktif`}
            icon={Users}
            color="bg-purple-100 text-purple-600"
            to="/customers"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {/* Grafik Pendapatan 6 Bulan */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm">Arus Kas 6 Bulan Terakhir</h3>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" />Pemasukan</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-300 inline-block" />Pengeluaran</span>
              </div>
            </div>
            <div className="flex items-end gap-3 h-44">
              {stats.chartData.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end gap-1 h-36">
                    <div
                      className="flex-1 bg-green-400 rounded-t-md transition-all duration-500 hover:bg-green-500"
                      title={`Pemasukan: Rp ${fmt(d.pemasukan)}`}
                      style={{ height: `${maxChart > 0 ? (d.pemasukan / maxChart) * 100 : 0}%`, minHeight: d.pemasukan > 0 ? '4px' : '0' }}
                    />
                    <div
                      className="flex-1 bg-red-300 rounded-t-md transition-all duration-500 hover:bg-red-400"
                      title={`Pengeluaran: Rp ${fmt(d.pengeluaran)}`}
                      style={{ height: `${maxChart > 0 ? (d.pengeluaran / maxChart) * 100 : 0}%`, minHeight: d.pengeluaran > 0 ? '4px' : '0' }}
                    />
                  </div>
                  <span className="text-2xs text-slate-400 font-medium">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status WO Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Status WO
            </h3>
            <div className="space-y-2">
              {['Queue', 'Inspecting', 'Repairing', 'Testing', 'Finished', 'Picked Up'].map(s => {
                const count = workOrders.filter(w => w.status === s).length;
                const pct = workOrders.length > 0 ? Math.round((count / workOrders.length) * 100) : 0;
                return (
                  <div key={s}>
                    <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                      <StatusPill status={s} size="xs" />
                      <span className="font-semibold">{count} <span className="font-normal text-slate-400">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Aktivitas Terbaru */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400" /> WO Terbaru Masuk</h3>
              <Link to="/work-orders" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Lihat semua →</Link>
            </div>
            <div className="space-y-2">
              {stats.recentWOs.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Belum ada pekerjaan.</p>}
              {stats.recentWOs.map(wo => (
                <div key={wo.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                    <Wrench className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{wo.customer}</p>
                    <p className="text-xs text-slate-400 truncate">{wo.merk} · {wo.id}</p>
                  </div>
                  <StatusPill status={wo.status} size="xs" />
                </div>
              ))}
            </div>
          </div>

          {/* Stok Kritis */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Stok Kritis
              </h3>
              <Link to="/inventory" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Kelola stok →</Link>
            </div>
            {stats.stokKritis.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
                <CheckCircle className="w-8 h-8 text-green-400" />
                <p className="text-sm">Semua stok dalam kondisi aman.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.stokKritis.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{item.nama}</p>
                      <p className="text-xs text-slate-400">Min: {item.batasMinimum} {item.satuan}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.stok === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.stok} {item.satuan}
                    </span>
                  </div>
                ))}
                {stats.stokKritis.length > 5 && (
                  <p className="text-xs text-slate-400 text-center pt-1">+{stats.stokKritis.length - 5} item lainnya</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
