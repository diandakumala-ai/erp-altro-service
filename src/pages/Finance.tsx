import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Download, X, ChevronDown, FileText, BarChart2, BellRing, Printer, Wallet, FileSpreadsheet, Filter as FilterIcon, Receipt, TrendingUp, TrendingDown, Percent, Calculator, CalendarRange, Search } from 'lucide-react';
import { useStore, computeStatusBayar, computeLabaRugi, periodeBulan, periodeTahun, type FinanceTransaction } from '../store/useStore';
import { exportBukuKas, exportLaporanBulanan, exportPiutang, exportLaporanLengkap } from '../lib/exportExcel';
import { toast } from '../lib/toast';
import { Button, DataHeader, DataCell, EmptyRow, EmptyState, StatCard, SearchInput, ActionMenu, Section, type SortDir } from '../components/ui';
import { confirm } from '../lib/confirm';
import { fmt as fmtNumber, fmtBulanTahun, fmtBulanPendekTahun, fmtTanggalPendekTahun } from '../lib/format';

// Finance memakai versi absolut untuk display (tanda +/− digabung manual)
const fmt = (n: number) => fmtNumber(Math.abs(n));

function NominalCell({ value, onSave }: { value: number; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(Math.abs(value)));
  return editing ? (
    <input aria-label="Edit nominal" title="Edit nominal" autoFocus type="number"
      className="w-full border border-indigo-400 rounded px-1.5 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { onSave(val); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(val); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
  ) : (
    <span
      className={`cursor-pointer font-semibold transition-colors ${value >= 0 ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-600 hover:text-red-700'}`}
      onDoubleClick={() => { setVal(String(Math.abs(value))); setEditing(true); }}>
      {value >= 0 ? '+' : '−'} Rp {fmt(value)}
    </span>
  );
}

function KategoriCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <select title="Pilih kategori" aria-label="Pilih kategori" autoFocus
      className="text-xs border border-indigo-400 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 bg-white"
      value={value} onChange={e => { onSave(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}>
      <option value="Pemasukan">Pemasukan</option>
      <option value="Pengeluaran">Pengeluaran</option>
    </select>
  ) : (
    <span onDoubleClick={() => setEditing(true)} className={`cursor-pointer inline-block px-2.5 py-0.5 rounded-full text-2xs uppercase tracking-wider font-bold ${value === 'Pemasukan' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      {value}
    </span>
  );
}

function SubKategoriCell({ value, onSave, kategori }: { value: string; onSave: (v: string) => void; kategori: string }) {
  const [editing, setEditing] = useState(false);

  const options = kategori === 'Pemasukan'
    ? ['DP', 'Pelunasan', 'Lain-lain']
    : ['Material/Suku Cadang', 'Listrik & Operasional', 'Gaji Teknisi', 'Lain-lain'];

  return editing ? (
    <select title="Pilih Sub-Kategori" aria-label="Pilih Sub-Kategori" autoFocus
      className="w-full text-xs border border-indigo-400 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 bg-white"
      value={value || ''} onChange={e => { onSave(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}>
      <option value="" disabled>Pilih...</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  ) : (
    <span className="cursor-pointer hover:text-indigo-600 transition-colors text-xs font-medium text-slate-600" onDoubleClick={() => setEditing(true)}>
      {value || <span className="text-slate-300 italic">Set Sub-Kategori...</span>}
    </span>
  );
}

function DeskripsiCell({ value, onSave, onFill, kategori, subKategori }: {
  value: string; onSave: (v: string) => void;
  onFill: (label: string, nominal: number, woId?: string) => void;
  kategori: string;
  /** Filter suggestion berdasarkan sub-kategori (DP / Pelunasan / Lain-lain). */
  subKategori?: string;
}) {
  const workOrders = useStore(s => s.workOrders);
  const finance = useStore(s => s.finance);
  const inventory = useStore(s => s.inventory);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Helper: total bayar untuk WO (link via woId atau substring legacy)
  const sumBayarForWo = (woId: string, filterSub?: 'DP') =>
    finance
      .filter(f =>
        f.kategori === 'Pemasukan' && f.nominal > 0 &&
        (f.woId === woId || (!f.woId && f.deskripsi.includes(woId))) &&
        (filterSub === undefined || f.subKategori === filterSub || (filterSub === 'DP' && !f.subKategori && f.deskripsi.includes('Pembayaran DP')))
      )
      .reduce((sum, f) => sum + f.nominal, 0);

  /**
   * Build suggestions berdasarkan subKategori:
   * - 'DP' → hanya WO yang BELUM punya DP atau pembayaran apapun
   * - 'Pelunasan' → hanya WO yang belum lunas (status DP atau Belum Bayar)
   * - undefined / 'Lain-lain' → tampilkan semua (legacy behavior)
   */
  const suggestionsPemasukan = kategori === 'Pemasukan'
    ? workOrders.flatMap(wo => {
        const effectiveTotal = Math.max((wo.estimatedCost || 0) - (wo.diskon || 0), 0);
        if (effectiveTotal === 0) return [];
        const dpPaid = sumBayarForWo(wo.id, 'DP');
        const totalPaid = sumBayarForWo(wo.id);
        const remaining = Math.max(effectiveTotal - totalPaid, 0);

        // Suggestion DP — pakai dpAmount yang direncanakan, fallback 50%
        const dpSuggested = (wo.dpAmount ?? 0) > 0 ? wo.dpAmount! : Math.round(effectiveTotal * 0.5);

        // FILTER SMART per sub-kategori
        if (subKategori === 'DP') {
          // Skip WO yang sudah ada DP-nya
          if (dpPaid > 0) return [];
          // Skip WO yang sudah ada pembayaran apapun (sudah lunas/sudah pelunasan)
          if (totalPaid >= effectiveTotal) return [];
          return [
            { label: `Pembayaran DP - ${wo.id} (${wo.customer})`, nominal: dpSuggested, type: 'dp' as const, woId: wo.id },
          ];
        }
        if (subKategori === 'Pelunasan') {
          // Skip WO yang sudah lunas
          if (remaining === 0) return [];
          return [
            { label: `Pelunasan - ${wo.id} (${wo.customer})`, nominal: remaining, type: 'lunas' as const, woId: wo.id },
          ];
        }
        // Default: tampilkan semua (untuk subKategori 'Lain-lain' atau belum di-set)
        return [
          { label: `Pembayaran DP - ${wo.id} (${wo.customer})`, nominal: dpSuggested, type: 'dp' as const, woId: wo.id },
          { label: `Pelunasan - ${wo.id} (${wo.customer})`, nominal: remaining, type: 'lunas' as const, woId: wo.id },
        ];
      })
    : [];

  const suggestionsPengeluaran = kategori === 'Pengeluaran'
    ? inventory.map(inv => ({
        label: `Beli Material - ${inv.nama}`, nominal: inv.hargaBeli, type: 'material' as const
      }))
    : [];

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  if (editing) {
    return (
      <input aria-label="Edit deskripsi" title="Edit deskripsi" autoFocus
        className="w-full border border-indigo-400 rounded px-1.5 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        value={val} onChange={e => setVal(e.target.value)}
        onBlur={() => { onSave(val); setEditing(false); }}
        onKeyDown={e => { if (e.key === 'Enter') { onSave(val); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
    );
  }

  return (
    <div className="flex items-center gap-1 group">
      <span
        className="cursor-pointer hover:text-indigo-600 transition-colors flex-1 truncate"
        onDoubleClick={() => { setVal(value); setEditing(true); }}>
        {value || <span className="text-slate-300">—</span>}
      </span>
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          title="Opsi Cepat"
          onClick={() => setShowDropdown(v => !v)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {showDropdown && (
          <div className="absolute left-0 top-6 bg-white border border-slate-200 rounded-lg shadow-xl w-80 max-h-64 overflow-y-auto" style={{ zIndex: 'var(--z-dropdown)' }}>
            <p className="px-3 py-1.5 text-2xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              {kategori === 'Pemasukan'
                ? subKategori === 'DP'
                  ? 'WO yang Belum Bayar DP'
                  : subKategori === 'Pelunasan'
                  ? 'WO yang Belum Lunas'
                  : 'Pilih dari Work Order'
                : 'Pilih dari Inventory'}
            </p>

            {kategori === 'Pemasukan' && suggestionsPemasukan.length === 0 && (
              <p className="px-3 py-3 text-xs text-slate-400 italic">
                {subKategori === 'DP'
                  ? 'Semua WO sudah ada DP / sudah dibayar.'
                  : subKategori === 'Pelunasan'
                  ? 'Semua WO sudah lunas.'
                  : 'Tidak ada data.'}
              </p>
            )}
            {kategori === 'Pemasukan' && suggestionsPemasukan.map((s, idx) => (
              <button key={idx}
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onFill(s.label, s.nominal, s.woId); setShowDropdown(false); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-bold ${s.type === 'dp' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {s.type === 'dp' ? '⬡ DP' : '✓ Lunas'}
                    </span>
                    <span className="ml-2 text-slate-600">{s.label.replace(/^(Pembayaran DP|Pelunasan) - /, '')}</span>
                  </div>
                  <span className={`ml-2 shrink-0 font-semibold ${s.type === 'lunas' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    Rp {fmtNumber(s.nominal)}
                  </span>
                </div>
                {s.type === 'lunas' && s.nominal === 0 && (
                  <span className="text-2xs text-slate-400 italic">Sudah lunas / tidak ada DP tercatat</span>
                )}
              </button>
            ))}

            {kategori === 'Pengeluaran' && suggestionsPengeluaran.length === 0 && <p className="px-3 py-3 text-xs text-slate-400">Tidak ada barang.</p>}
            {kategori === 'Pengeluaran' && suggestionsPengeluaran.map((s, idx) => (
              <button key={idx}
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onFill(s.label, s.nominal); setShowDropdown(false); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-600">📦 Material</span>
                    <span className="ml-2 text-slate-600">{s.label.replace(/^Beli Material - /, '')}</span>
                  </div>
                  <span className="ml-2 shrink-0 font-semibold text-slate-500">
                    Rp {fmtNumber(s.nominal)} / satuan
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Finance() {
  const finance = useStore(s => s.finance);
  const addFinance = useStore(s => s.addFinance);
  const updateFinance = useStore(s => s.updateFinance);
  const deleteFinance = useStore(s => s.deleteFinance);

  const [activeTab, setActiveTab] = useState<'table' | 'report' | 'piutang'>('table');
  const workOrders = useStore(s => s.workOrders);
  const inventory = useStore(s => s.inventory);
  const bengkelSettings = useStore(s => s.bengkelSettings);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>('tanggal');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const [showFilter, setShowFilter] = useState(false);
  const [filterKategori, setFilterKategori] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Laporan: periode yang dipilih (format YYYY-MM)
  const nowForReport = new Date();
  const defaultPeriod = `${nowForReport.getFullYear()}-${String(nowForReport.getMonth() + 1).padStart(2, '0')}`;
  const [reportPeriod, setReportPeriod] = useState(defaultPeriod);

  const activeFilterCount = [filterKategori, filterDateFrom, filterDateTo].filter(Boolean).length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = finance.filter(t =>
      t.id.toLowerCase().includes(q) || t.deskripsi.toLowerCase().includes(q) ||
      t.kategori.toLowerCase().includes(q) || t.tanggal.includes(q) ||
      (t.subKategori && t.subKategori.toLowerCase().includes(q)) ||
      (t.catatan && t.catatan.toLowerCase().includes(q))
    );
    if (filterKategori) rows = rows.filter(t => t.kategori === filterKategori);
    if (filterDateFrom) rows = rows.filter(t => t.tanggal >= filterDateFrom);
    if (filterDateTo) rows = rows.filter(t => t.tanggal <= filterDateTo);
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sortField] ?? '');
        const bv = String((b as unknown as Record<string, unknown>)[sortField] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true });
      });
    }
    return rows;
  }, [finance, search, sortField, sortDir, filterKategori, filterDateFrom, filterDateTo]);

  // Running balance sorted by tanggal asc for calculation
  const runningBalanceMap = useMemo(() => {
    const sorted = [...finance].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const map: Record<string, number> = {};
    let running = 0;
    sorted.forEach(t => { running += t.nominal; map[t.id] = running; });
    return map;
  }, [finance]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const update = (trx: FinanceTransaction, field: keyof FinanceTransaction, value: string) => {
    let updated: FinanceTransaction = { ...trx, [field]: field === 'nominal' ? Number(value) : value };
    if (updated.kategori === 'Pengeluaran' && updated.nominal > 0) updated = { ...updated, nominal: -Math.abs(updated.nominal) };
    else if (updated.kategori === 'Pemasukan' && updated.nominal < 0) updated = { ...updated, nominal: Math.abs(updated.nominal) };
    updateFinance(updated);
  };

  const handleAdd = () => {
    let max = 0;
    finance.forEach(t => { const n = parseInt(t.id.split('-').at(-1)!, 10); if (!isNaN(n) && n > max) max = n; });
    const newId = `TRX-${String(max + 1).padStart(3, '0')}`;
    setSortField('tanggal');
    setSortDir('asc');
    addFinance({ id: newId, tanggal: new Date().toISOString().split('T')[0], kategori: 'Pemasukan', deskripsi: 'Transaksi Baru', nominal: 0, catatan: '', subKategori: '' });
    setTimeout(() => {
      const newRow = tableBodyRef.current?.querySelector(`[data-id="${newId}"]`);
      newRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleExportCSV = () => {
    const header = 'ID,Tanggal,Kategori,Sub-Kategori,Deskripsi,Catatan,Nominal,Saldo Berjalan';
    const rows = [...finance]
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
      .map(t => `${t.id},${t.tanggal},${t.kategori},${t.subKategori||'-'},${t.deskripsi},${t.catatan||'-'},${t.nominal},${runningBalanceMap[t.id] ?? ''}`);
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'BukuKas.csv'; a.click();
  };

  const clearFilters = () => { setFilterKategori(''); setFilterDateFrom(''); setFilterDateTo(''); };

  // Summary: bulan berjalan
  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthTrx = finance.filter(t => t.tanggal.startsWith(thisMonthStr));
  const pemasukanBulanIni = thisMonthTrx.filter(r => r.nominal > 0).reduce((a, r) => a + r.nominal, 0);
  const pengeluaranBulanIni = Math.abs(thisMonthTrx.filter(r => r.nominal < 0).reduce((a, r) => a + r.nominal, 0));

  // Summary: total semua waktu
  const totalPemasukan = finance.filter(r => r.nominal > 0).reduce((a, r) => a + r.nominal, 0);
  const totalPengeluaran = Math.abs(finance.filter(r => r.nominal < 0).reduce((a, r) => a + r.nominal, 0));
  const saldo = totalPemasukan - totalPengeluaran;

  // Routine Expenses Alert
  const routineItems = useMemo(() => {
    const routines = finance.filter(f => f.isRutin && f.kategori === 'Pengeluaran');
    const uniqueDescs = Array.from(new Set(routines.map(r => r.deskripsi)));
    
    return uniqueDescs.map(desc => {
      const items = routines.filter(r => r.deskripsi === desc);
      const lastPaid = items.reduce((latest, current) => current.tanggal > latest.tanggal ? current : latest, items[0]);
      const isPaidThisMonth = lastPaid.tanggal.startsWith(thisMonthStr);
      return { deskripsi: desc, isPaidThisMonth, nominal: Math.abs(lastPaid.nominal) };
    }).filter(r => !r.isPaidThisMonth);
  }, [finance, thisMonthStr]);

  const thProps = { sortField, sortDir, onSort: handleSort };

  // --- REPORT TAB LOGIC ---
  const last6Months = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = fmtBulanPendekTahun(str);
      const trxs = finance.filter(t => t.tanggal.startsWith(str));
      const pem = trxs.filter(t => t.nominal > 0).reduce((a, b) => a + b.nominal, 0);
      const peng = Math.abs(trxs.filter(t => t.nominal < 0).reduce((a, b) => a + b.nominal, 0));
      months.push({ label, pem, peng });
    }
    return months;
  }, [finance, now]);

  const maxChartValue = Math.max(...last6Months.flatMap(m => [m.pem, m.peng]), 1);

  // --- LAPORAN PERIODE ---
  const reportTrx = useMemo(() =>
    finance.filter(t => t.tanggal.startsWith(reportPeriod)),
    [finance, reportPeriod]
  );
  const reportPemasukan = useMemo(() => reportTrx.filter(t => t.nominal > 0).reduce((a, b) => a + b.nominal, 0), [reportTrx]);
  const reportPengeluaran = useMemo(() => Math.abs(reportTrx.filter(t => t.nominal < 0).reduce((a, b) => a + b.nominal, 0)), [reportTrx]);
  const reportLaba = reportPemasukan - reportPengeluaran;

  // Breakdown pemasukan per sub-kategori untuk periode dipilih
  const subPemasukan = useMemo(() => {
    const subs = ['DP', 'Pelunasan', 'Lain-lain'];
    return subs.map(sub => ({
      sub,
      total: reportTrx.filter(t => t.nominal > 0 && t.subKategori === sub).reduce((a, b) => a + b.nominal, 0),
    })).concat([{
      sub: 'Tanpa Sub-Kategori',
      total: reportTrx.filter(t => t.nominal > 0 && !t.subKategori).reduce((a, b) => a + b.nominal, 0),
    }]).filter(s => s.total > 0);
  }, [reportTrx]);

  // Breakdown pengeluaran per sub-kategori untuk periode dipilih
  const subPengeluaran = useMemo(() => {
    const subs = ['Material/Suku Cadang', 'Listrik & Operasional', 'Gaji Teknisi', 'Lain-lain'];
    return subs.map(sub => ({
      sub,
      total: Math.abs(reportTrx.filter(t => t.nominal < 0 && t.subKategori === sub).reduce((a, b) => a + b.nominal, 0)),
    })).concat([{
      sub: 'Tanpa Sub-Kategori',
      total: Math.abs(reportTrx.filter(t => t.nominal < 0 && !t.subKategori).reduce((a, b) => a + b.nominal, 0)),
    }]).filter(s => s.total > 0);
  }, [reportTrx]);

  // Daftar transaksi periode dipilih, sorted by tanggal
  const reportTrxSorted = useMemo(() =>
    [...reportTrx].sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
    [reportTrx]
  );

  // Nama bulan untuk label
  const reportLabel = useMemo(() => fmtBulanTahun(reportPeriod), [reportPeriod]);

  // Build list bulan tersedia dari data (untuk dropdown)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    finance.forEach(t => set.add(t.tanggal.slice(0, 7)));
    // Pastikan periode current selalu ada di dropdown walau belum ada transaksi
    set.add(reportPeriod);
    return Array.from(set).sort().reverse();
  }, [finance, reportPeriod]);

  // Hover state untuk bar chart (index dari last6Months)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Search state untuk tabel rincian transaksi di tab Laporan
  const [reportSearch, setReportSearch] = useState('');
  const reportTrxFiltered = useMemo(() => {
    const q = reportSearch.toLowerCase().trim();
    if (!q) return reportTrxSorted;
    return reportTrxSorted.filter(t =>
      t.deskripsi.toLowerCase().includes(q) ||
      t.kategori.toLowerCase().includes(q) ||
      (t.subKategori ?? '').toLowerCase().includes(q) ||
      t.tanggal.includes(q) ||
      String(Math.abs(t.nominal)).includes(q)
    );
  }, [reportTrxSorted, reportSearch]);

  // Comparison vs bulan sebelumnya (untuk delta %)
  const prevPeriodStr = useMemo(() => {
    const [y, m] = reportPeriod.split('-').map(Number);
    const d = new Date(y, m - 2, 1); // m-1 bulan ini, m-2 bulan sebelumnya
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [reportPeriod]);

  const prevPeriodPemasukan = useMemo(() =>
    finance.filter(t => t.tanggal.startsWith(prevPeriodStr) && t.nominal > 0).reduce((a, b) => a + b.nominal, 0)
  , [finance, prevPeriodStr]);
  const prevPeriodPengeluaran = useMemo(() =>
    Math.abs(finance.filter(t => t.tanggal.startsWith(prevPeriodStr) && t.nominal < 0).reduce((a, b) => a + b.nominal, 0))
  , [finance, prevPeriodStr]);
  const prevPeriodLaba = prevPeriodPemasukan - prevPeriodPengeluaran;

  const pctDelta = (curr: number, prev: number): number | null => {
    if (prev === 0) return curr === 0 ? 0 : null; // null = N/A
    return ((curr - prev) / Math.abs(prev)) * 100;
  };
  const deltaPemasukan = pctDelta(reportPemasukan, prevPeriodPemasukan);
  const deltaPengeluaran = pctDelta(reportPengeluaran, prevPeriodPengeluaran);
  const deltaLaba = pctDelta(reportLaba, prevPeriodLaba);

  // Margin laba bersih (% terhadap pemasukan)
  const marginLaba = reportPemasukan > 0 ? (reportLaba / reportPemasukan) * 100 : 0;

  // Estimasi pajak periode dipilih — pakai computeLabaRugi (proper UMKM/Badan)
  const labaRugiPeriode = useMemo(
    () => computeLabaRugi(workOrders, finance, bengkelSettings, periodeBulan(reportPeriod)),
    [workOrders, finance, bengkelSettings, reportPeriod]
  );
  const labaRugiTahun = useMemo(
    () => computeLabaRugi(workOrders, finance, bengkelSettings, periodeTahun(Number(reportPeriod.slice(0, 4)))),
    [workOrders, finance, bengkelSettings, reportPeriod]
  );

  // Utang PPN periode — Σ PPN keluaran WO usePpn yg dibuat di periode ini
  const utangPpnPeriode = useMemo(() => {
    return workOrders
      .filter(wo => wo.usePpn && wo.estimatedCost > 0 && (wo.tanggalInvoice ?? wo.dateIn ?? '').startsWith(reportPeriod))
      .reduce((s, wo) => {
        const base = Math.max(wo.estimatedCost - (wo.diskon ?? 0), 0);
        return s + Math.round(base * ((wo.ppnPercent ?? 11) / 100));
      }, 0);
  }, [workOrders, reportPeriod]);

  // Preset periode handlers
  const setPeriodBulanIni = () => setReportPeriod(thisMonthStr);
  const setPeriodBulanLalu = () => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    setReportPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // --- PIUTANG (Outstanding Receivables) ---
  const piutangList = useMemo(() => {
    return workOrders
      .filter(wo => wo.estimatedCost > 0)
      .map(wo => ({ wo, info: computeStatusBayar(wo, finance) }))
      .filter(({ info }) => info.status !== 'Lunas');
  }, [workOrders, finance]);

  const totalPiutang = piutangList.reduce((sum, { info }) => sum + info.sisaTagihan, 0);
  const totalLunas = workOrders.filter(wo => wo.estimatedCost > 0)
    .filter(wo => computeStatusBayar(wo, finance).status === 'Lunas').length;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-12 flex items-center pl-14 pr-14 lg:px-6 justify-between shrink-0">
        <div className="flex items-center gap-6 overflow-hidden">
          <h2 className="text-base font-semibold text-slate-800 whitespace-nowrap">Manajemen Keuangan (Finance)</h2>
          <div role="tablist" aria-label="Tab Finance" className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto no-scrollbar relative">
            <button role="tab" aria-selected={activeTab === 'table'} onClick={() => setActiveTab('table')} className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${activeTab === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <FileText className="w-4 h-4" aria-hidden="true" /> Buku Kas
            </button>
            <button role="tab" aria-selected={activeTab === 'piutang'} onClick={() => setActiveTab('piutang')} className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${activeTab === 'piutang' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Wallet className="w-4 h-4" aria-hidden="true" /> Piutang
              {piutangList.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-2xs font-bold" aria-label={`${piutangList.length} piutang`}>{piutangList.length}</span>
              )}
            </button>
            <button role="tab" aria-selected={activeTab === 'report'} onClick={() => setActiveTab('report')} className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${activeTab === 'report' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <BarChart2 className="w-4 h-4" aria-hidden="true" /> Laporan Keuangan
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Export Excel — kontekstual per tab. Mobile: icon-only. */}
          {activeTab === 'table' && (
            <Button variant="success" title="Export Buku Kas ke Excel"
              onClick={() => { exportBukuKas(finance); toast.success('Buku Kas berhasil di-export!'); }}>
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Export Excel</span>
            </Button>
          )}
          {activeTab === 'report' && (
            <Button variant="success" title="Export laporan lengkap ke Excel"
              onClick={() => {
                exportLaporanLengkap(finance, workOrders, inventory, [], reportPeriod);
                toast.success(`Laporan ${reportLabel} berhasil di-export!`);
              }}>
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Export Excel</span>
            </Button>
          )}
          {activeTab === 'piutang' && (
            <Button variant="success" title="Export piutang ke Excel"
              onClick={() => { exportPiutang(workOrders, finance); toast.success('Data piutang berhasil di-export!'); }}>
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Export Excel</span>
            </Button>
          )}
          {/* Cetak Laporan — hanya di tab Laporan Laba Rugi (kontekstual) */}
          {activeTab === 'report' && (
            <ActionMenu
              ariaLabel="Pilih laporan untuk dicetak"
              trigger={
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap">
                  <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Cetak Laporan</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </span>
              }
              actions={[
                {
                  label: `Ringkasan Bulanan — ${fmtBulanTahun(reportPeriod)}`,
                  icon: FileText,
                  onClick: () => window.open(`/print/laporan-keuangan?period=${reportPeriod}`, '_blank'),
                },
                {
                  label: `Laporan Laba Rugi — ${fmtBulanTahun(reportPeriod)}`,
                  icon: BarChart2,
                  separator: true,
                  onClick: () => window.open(`/print/laba-rugi?period=${reportPeriod}`, '_blank'),
                },
                {
                  label: `Laporan Laba Rugi — Tahun ${reportPeriod.slice(0, 4)}`,
                  icon: BarChart2,
                  onClick: () => window.open(`/print/laba-rugi?period=${reportPeriod.slice(0, 4)}`, '_blank'),
                },
                {
                  label: `Neraca per Akhir ${fmtBulanTahun(reportPeriod)}`,
                  icon: Wallet,
                  separator: true,
                  onClick: () => window.open(`/print/neraca?period=${reportPeriod}`, '_blank'),
                },
                {
                  label: `Neraca per Akhir Tahun ${reportPeriod.slice(0, 4)}`,
                  icon: Wallet,
                  onClick: () => window.open(`/print/neraca?period=${reportPeriod.slice(0, 4)}`, '_blank'),
                },
              ]}
            />
          )}
          {activeTab === 'table' && (
            <Button variant="primary" onClick={handleAdd} title="Catat Transaksi">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Catat Transaksi</span>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden flex flex-col gap-4">
        {/* Alerts for Routine Expenses */}
        {routineItems.length > 0 && activeTab === 'table' && (
          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-3 shrink-0">
            <BellRing className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-amber-800 mb-1">Pengingat Tagihan Rutin Bulan Ini</h4>
              <p className="text-xs text-amber-700">Terdapat pengeluaran rutin yang belum dicatat untuk bulan ini:</p>
              <ul className="text-xs text-amber-700 list-disc list-inside mt-1 font-medium">
                {routineItems.map((r, i) => <li key={i}>{r.deskripsi} (Estimasi Rp {fmt(r.nominal)})</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* Tab Content: Buku Kas (Table) */}
        {activeTab === 'table' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
              <StatCard label="Pemasukan Bulan Ini" value={`Rp ${fmt(pemasukanBulanIni)}`} accent="emerald" />
              <StatCard label="Pengeluaran Bulan Ini" value={`Rp ${fmt(pengeluaranBulanIni)}`} accent="red" />
              <StatCard label="Total Pemasukan" value={`Rp ${fmt(totalPemasukan)}`} accent="emerald" />
              <StatCard
                label="Piutang Belum Lunas"
                value={`Rp ${fmt(totalPiutang)}`}
                hint={piutangList.length > 0 ? `${piutangList.length} WO belum lunas` : 'Semua lunas'}
                accent={piutangList.length > 0 ? 'amber' : 'slate'}
                onClick={() => setActiveTab('piutang')}
              />
              <StatCard
                label="Saldo Kas Keseluruhan"
                value={`Rp ${fmt(saldo)}${saldo < 0 ? ' (−)' : ''}`}
                accent={saldo >= 0 ? 'indigo' : 'red'}
              />
            </div>

            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
                <SearchInput
                  value={search} onChange={setSearch}
                  placeholder="Cari ID, deskripsi, sub-kategori..." ariaLabel="Cari transaksi"
                  className="flex-1 max-w-xs"
                />
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant={showFilter ? 'primary' : 'secondary'}
                    onClick={() => setShowFilter(v => !v)}
                    className="relative">
                    <FilterIcon className="w-4 h-4" />
                    Filter
                    {activeFilterCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-2xs rounded-full flex items-center justify-center font-bold">{activeFilterCount}</span>}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showFilter ? 'rotate-180' : ''}`} />
                  </Button>
                  <Button variant="secondary" onClick={handleExportCSV}>
                    <Download className="w-4 h-4" /> Export CSV
                  </Button>
                </div>
              </div>

              {/* Filter Panel */}
              {showFilter && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-end gap-4 flex-wrap shrink-0">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Kategori Utama</label>
                    <select title="Filter kategori" aria-label="Filter kategori" value={filterKategori} onChange={e => setFilterKategori(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
                      <option value="">Semua</option>
                      <option value="Pemasukan">Pemasukan</option>
                      <option value="Pengeluaran">Pengeluaran</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Dari Tanggal</label>
                    <input type="date" title="Dari tanggal" aria-label="Dari tanggal" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Sampai Tanggal</label>
                    <input type="date" title="Sampai tanggal" aria-label="Sampai tanggal" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300" />
                  </div>
                  {activeFilterCount > 0 && (
                    <Button variant="soft-danger" onClick={clearFilters}>
                      <X className="w-3 h-3" /> Reset Filter
                    </Button>
                  )}
                </div>
              )}

              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse min-w-[1100px]">
                  <thead className="bg-slate-50 sticky top-0" style={{ zIndex: 'var(--z-sticky)' }}>
                    <tr className="border-b border-slate-200">
                      <DataHeader label="Tanggal" field="tanggal" w="w-32" {...thProps} />
                      <DataHeader label="Kategori" field="kategori" w="w-24" {...thProps} />
                      <DataHeader label="Sub-Kategori" field="subKategori" w="w-40" {...thProps} />
                      <DataHeader label="Deskripsi Transaksi" field="deskripsi" {...thProps} />
                      <DataHeader label="Catatan" field="catatan" w="w-48" {...thProps} />
                      <DataHeader label="Nominal (Rp)" field="nominal" w="w-36" {...thProps} />
                      <DataHeader
                        label={search || activeFilterCount > 0 ? 'Saldo Berjalan*' : 'Saldo Berjalan'}
                        w="w-36" {...thProps}
                      />
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody ref={tableBodyRef}>
                    {filtered.length === 0 && (
                      <EmptyRow colSpan={8} message={
                        search || activeFilterCount > 0 ? (
                          <EmptyState
                            icon={Receipt}
                            title="Tidak ada transaksi yang cocok"
                            description={search ? `Tidak ditemukan untuk "${search}".` : 'Coba ubah filter aktif.'}
                            action={
                              <Button variant="secondary" size="md" onClick={() => { setSearch(''); clearFilters(); }}>
                                Reset filter
                              </Button>
                            }
                          />
                        ) : (
                          <EmptyState
                            icon={Receipt}
                            title="Belum ada transaksi"
                            description="Catat pemasukan atau pengeluaran pertama Anda."
                            action={
                              <Button variant="primary" size="md" onClick={handleAdd}>
                                <Plus className="w-4 h-4" /> Catat Transaksi
                              </Button>
                            }
                          />
                        )
                      } />
                    )}
                    {filtered.map((trx, i) => {
                      const runBal = runningBalanceMap[trx.id] ?? 0;
                      return (
                        <tr key={trx.id} data-id={trx.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                          <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                            <DataCell value={trx.tanggal} onSave={v => update(trx, 'tanggal', v)} type="date" ariaLabel="Edit tanggal" />
                          </td>
                          <td className="px-4 py-3"><KategoriCell value={trx.kategori} onSave={v => update(trx, 'kategori', v)} /></td>
                          <td className="px-4 py-3"><SubKategoriCell value={trx.subKategori || ''} onSave={v => update(trx, 'subKategori', v)} kategori={trx.kategori} /></td>
                          <td className="px-4 py-3 text-slate-700 min-w-[200px]">
                            <DeskripsiCell
                              value={trx.deskripsi}
                              onSave={v => update(trx, 'deskripsi', v)}
                              onFill={(label, nominal, woId) => updateFinance({
                                ...trx,
                                deskripsi: label,
                                nominal: trx.kategori === 'Pengeluaran' ? -Math.abs(nominal) : Math.abs(nominal),
                                woId: woId ?? trx.woId,    // Phase 5: link FK kalau dari WO
                              })}
                              kategori={trx.kategori}
                              subKategori={trx.subKategori}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs"><DataCell value={trx.catatan || ''} onSave={v => update(trx, 'catatan', v)} placeholder="Catatan opsional..." ariaLabel="Edit catatan" /></td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <NominalCell value={trx.nominal} onSave={v => update(trx, 'nominal', v)} />
                          </td>
                          <td className={`px-4 py-3 text-xs font-mono font-semibold whitespace-nowrap ${runBal >= 0 ? 'text-slate-600' : 'text-red-600'}`}>
                            {runBal >= 0 ? '' : '− '}Rp {fmt(runBal)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ActionMenu
                              ariaLabel={`Aksi untuk ${trx.id}`}
                              actions={[
                                trx.kategori === 'Pemasukan'
                                  ? {
                                      label: 'Cetak Kuitansi',
                                      icon: Receipt,
                                      onClick: () => window.open(`/print/kuitansi/${trx.id}`, '_blank'),
                                    }
                                  : {
                                      label: 'Cetak Bukti Pembayaran',
                                      icon: Printer,
                                      onClick: () => window.open(`/print/bukti-pembayaran/${trx.id}`, '_blank'),
                                    },
                                {
                                  label: 'Hapus transaksi',
                                  icon: Trash2,
                                  destructive: true,
                                  separator: true,
                                  onClick: async () => {
                                    const ok = await confirm({
                                      title: 'Hapus transaksi?',
                                      message: <>Transaksi <b>{trx.deskripsi}</b> ({trx.tanggal}, Rp {fmt(trx.nominal)}) akan dihapus permanen dari buku kas. Saldo berjalan akan dihitung ulang otomatis.</>,
                                      destructive: true,
                                      confirmLabel: 'Hapus transaksi',
                                    });
                                    if (ok) deleteFinance(trx.id);
                                  },
                                },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-between items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-400">Menampilkan {filtered.length} dari {finance.length} transaksi</span>
                {(search || activeFilterCount > 0) && (
                  <span className="text-xs text-slate-400 italic">* Saldo berjalan dihitung dari seluruh data, bukan filter aktif.</span>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab Content: Laporan & Grafik */}
        {activeTab === 'report' && (
          <div className="flex-1 overflow-auto flex flex-col gap-4 p-1">

            {/* ─── PERIOD SELECTOR — preset chips + dropdown ──────────────── */}
            <Section
              title="Periode Laporan"
              icon={CalendarRange}
              accent="indigo"
              rightSlot={
                <span className="text-tiny text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {reportTrx.length} transaksi
                </span>
              }
              bodyClassName="p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                {/* Preset chips */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={setPeriodBulanIni}
                    aria-pressed={reportPeriod === thisMonthStr}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                      reportPeriod === thisMonthStr
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                    }`}
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    onClick={setPeriodBulanLalu}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  >
                    Bulan Lalu
                  </button>
                </div>
                <div className="h-6 w-px bg-slate-200" aria-hidden="true" />
                <div className="flex items-center gap-2">
                  <label htmlFor="report-period" className="text-xs font-medium text-slate-500">Pilih bulan:</label>
                  <select
                    id="report-period"
                    value={reportPeriod}
                    onChange={e => setReportPeriod(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 font-medium text-slate-700 cursor-pointer"
                    aria-label="Pilih periode laporan"
                  >
                    {availableMonths.map(m => (
                      <option key={m} value={m}>{fmtBulanTahun(m)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            {/* ─── KPI ROW — 4 cards: Pemasukan / Pengeluaran / Laba / Margin ─ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              <StatCard
                label="Pemasukan"
                value={`Rp ${fmt(reportPemasukan)}`}
                hint={
                  deltaPemasukan == null
                    ? `${subPemasukan.length} sub-kategori`
                    : <span className={deltaPemasukan >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {deltaPemasukan >= 0 ? '▲' : '▼'} {Math.abs(deltaPemasukan).toFixed(1)}% vs bulan lalu
                      </span>
                }
                accent="emerald"
                variant="full"
                icon={TrendingUp}
                iconBg="bg-emerald-100 text-emerald-600"
              />
              <StatCard
                label="Pengeluaran"
                value={`Rp ${fmt(reportPengeluaran)}`}
                hint={
                  deltaPengeluaran == null
                    ? `${subPengeluaran.length} sub-kategori`
                    : <span className={deltaPengeluaran <= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {deltaPengeluaran >= 0 ? '▲' : '▼'} {Math.abs(deltaPengeluaran).toFixed(1)}% vs bulan lalu
                      </span>
                }
                accent="red"
                variant="full"
                icon={TrendingDown}
                iconBg="bg-red-100 text-red-600"
              />
              <StatCard
                label={reportLaba >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}
                value={`${reportLaba >= 0 ? '+' : '−'} Rp ${fmt(Math.abs(reportLaba))}`}
                hint={
                  deltaLaba == null
                    ? (reportLaba >= 0 ? 'Untung periode ini' : 'Rugi periode ini')
                    : <span className={deltaLaba >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {deltaLaba >= 0 ? '▲' : '▼'} {Math.abs(deltaLaba).toFixed(1)}% vs bulan lalu
                      </span>
                }
                accent={reportLaba >= 0 ? 'indigo' : 'amber'}
                variant="full"
                icon={Wallet}
                iconBg={reportLaba >= 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-700'}
              />
              <StatCard
                label="Margin Laba"
                value={`${marginLaba.toFixed(1)}%`}
                hint={
                  marginLaba >= 20 ? 'Sehat — di atas 20%' :
                  marginLaba >= 10 ? 'Cukup — 10–20%' :
                  marginLaba >= 0  ? 'Tipis — di bawah 10%' :
                                      'Negatif — periode rugi'
                }
                accent={marginLaba >= 20 ? 'emerald' : marginLaba >= 10 ? 'indigo' : marginLaba >= 0 ? 'amber' : 'red'}
                variant="full"
                icon={Percent}
                iconBg="bg-slate-100 text-slate-600"
              />
            </div>

            {/* ─── ESTIMASI PAJAK BANNER — kontekstual berdasarkan jenis usaha ─ */}
            <Section
              title="Estimasi Pajak Periode Ini"
              icon={Calculator}
              accent="amber"
              rightSlot={
                <span className="text-tiny text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {bengkelSettings.jenisUsaha === 'UMKM_PP55' ? 'UMKM · PPh Final 0,5%'
                    : bengkelSettings.jenisUsaha === 'Badan' ? 'Badan · PPh 22%'
                    : `Tarif Manual ${bengkelSettings.tarifPphManual ?? 0}%`}
                </span>
              }
              bodyClassName="p-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <p className="text-2xs font-semibold text-amber-700 uppercase tracking-wider">PPh Estimasi (Bulan)</p>
                  <p className="text-lg font-black text-amber-800 mt-0.5">Rp {fmt(labaRugiPeriode.pphTerutang)}</p>
                  <p className="text-tiny text-amber-700/70 mt-0.5 truncate" title={labaRugiPeriode.pphInfo}>
                    {labaRugiPeriode.pphInfo}
                  </p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
                  <p className="text-2xs font-semibold text-indigo-700 uppercase tracking-wider">PPh Estimasi (Tahun {reportPeriod.slice(0, 4)})</p>
                  <p className="text-lg font-black text-indigo-800 mt-0.5">Rp {fmt(labaRugiTahun.pphTerutang)}</p>
                  <p className="text-tiny text-indigo-700/70 mt-0.5">Akumulasi sejak Januari</p>
                </div>
                <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2.5">
                  <p className="text-2xs font-semibold text-sky-700 uppercase tracking-wider">Utang PPN Keluaran</p>
                  <p className="text-lg font-black text-sky-800 mt-0.5">Rp {fmt(utangPpnPeriode)}</p>
                  <p className="text-tiny text-sky-700/70 mt-0.5">Dari WO ber-PPN bulan ini</p>
                </div>
              </div>
              {bengkelSettings.modalAwal === 0 && bengkelSettings.saldoKasAwal === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded mt-3 px-3 py-2 flex items-start gap-2">
                  <span className="font-bold">ℹ️</span>
                  <span>Lengkapi <b>Modal Awal</b> &amp; <b>Saldo Kas Awal</b> di Pengaturan → Akuntansi &amp; Pajak agar Neraca yang dicetak <i>balance</i>.</span>
                </p>
              )}
            </Section>

            {/* ─── BREAKDOWN 2-KOLOM — Pemasukan vs Pengeluaran ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section
                title={`Rincian Pemasukan — ${reportLabel}`}
                icon={TrendingUp}
                accent="emerald"
                rightSlot={<span className="text-xs font-bold text-emerald-700">Rp {fmt(reportPemasukan)}</span>}
                bodyClassName="p-5"
              >
                {subPemasukan.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="Tidak ada pemasukan"
                    description={`Belum ada transaksi pemasukan di ${reportLabel}.`}
                  />
                ) : (
                  <div className="space-y-3">
                    {subPemasukan.map(({ sub, total }) => {
                      const pct = reportPemasukan > 0 ? (total / reportPemasukan) * 100 : 0;
                      return (
                        <div key={sub}>
                          <div className="flex justify-between text-xs mb-1 gap-2">
                            <span className="font-medium text-slate-600 truncate">{sub}</span>
                            <span className="font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                              Rp {fmt(total)} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span>
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              <Section
                title={`Rincian Pengeluaran — ${reportLabel}`}
                icon={TrendingDown}
                accent="red"
                rightSlot={<span className="text-xs font-bold text-red-700">Rp {fmt(reportPengeluaran)}</span>}
                bodyClassName="p-5"
              >
                {subPengeluaran.length === 0 ? (
                  <EmptyState
                    icon={TrendingDown}
                    title="Tidak ada pengeluaran"
                    description={`Belum ada transaksi pengeluaran di ${reportLabel}.`}
                  />
                ) : (
                  <div className="space-y-3">
                    {subPengeluaran.map(({ sub, total }) => {
                      const pct = reportPengeluaran > 0 ? (total / reportPengeluaran) * 100 : 0;
                      return (
                        <div key={sub}>
                          <div className="flex justify-between text-xs mb-1 gap-2">
                            <span className="font-medium text-slate-600 truncate">{sub}</span>
                            <span className="font-semibold text-slate-800 whitespace-nowrap tabular-nums">
                              Rp {fmt(total)} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span>
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>

            {/* ─── TREN 6 BULAN — bar chart dengan highlight bulan dipilih ──── */}
            <Section
              title="Tren Laba Rugi (6 Bulan Terakhir)"
              icon={BarChart2}
              accent="indigo"
              rightSlot={
                <div className="flex items-center gap-3 text-2xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-emerald-500 inline-block" /> Pemasukan</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-500 inline-block" /> Pengeluaran</span>
                </div>
              }
              bodyClassName="p-5"
            >
              {/* Info panel: tampil saat hover — tidak pakai absolute tooltip agar tidak ter-clip */}
              <div className={`mb-3 rounded-lg px-4 py-2 flex items-center justify-between gap-4 text-xs transition-all ${
                hoveredBar !== null
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-50 border border-slate-100 text-slate-400'
              }`}>
                {hoveredBar !== null ? (() => {
                  const m = last6Months[hoveredBar];
                  const net = m.pem - m.peng;
                  return (
                    <>
                      <span className="font-semibold text-slate-200 shrink-0">{m.label}</span>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-end">
                        <span className="text-emerald-300 font-semibold">+Rp {fmt(m.pem)}</span>
                        <span className="text-red-300 font-semibold">−Rp {fmt(m.peng)}</span>
                        <span className={`font-bold ${net >= 0 ? 'text-indigo-300' : 'text-orange-300'}`}>
                          Laba: {net < 0 ? '−' : '+'}Rp {fmt(Math.abs(net))}
                        </span>
                      </div>
                    </>
                  );
                })() : (
                  <span className="w-full text-center text-2xs">Arahkan kursor ke bar untuk melihat detail</span>
                )}
              </div>
              <div className="h-40 flex items-end gap-3">
                {last6Months.map((m, i) => {
                  const pemH = (m.pem / maxChartValue) * 100;
                  const pengH = (m.peng / maxChartValue) * 100;
                  const net = m.pem - m.peng;
                  const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
                  const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  const isSelected = monthStr === reportPeriod;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReportPeriod(monthStr)}
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                      title={`Pilih ${m.label}`}
                      className={`flex-1 flex flex-col items-center gap-1 h-full justify-end rounded-md px-1 py-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                        isSelected ? 'bg-indigo-50 ring-2 ring-indigo-300' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-end gap-0.5 w-full h-28">
                        <div className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-400 transition-colors" style={{ height: `${pemH}%`, minHeight: m.pem > 0 ? '3px' : '0' }} />
                        <div className="flex-1 bg-red-500 rounded-t hover:bg-red-400 transition-colors" style={{ height: `${pengH}%`, minHeight: m.peng > 0 ? '3px' : '0' }} />
                      </div>
                      <span className={`text-2xs font-medium ${isSelected ? 'text-indigo-700 font-bold' : 'text-slate-400'}`}>{m.label}</span>
                      <span className={`text-3xs font-bold px-1.5 py-0.5 rounded-full ${net >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {net >= 0 ? '+' : '−'}Rp {fmt(Math.abs(net))}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-tiny text-slate-400 mt-3 text-center">Klik bar untuk memilih periode laporan.</p>
            </Section>

            {/* ─── TABEL RINCIAN TRANSAKSI — dengan search ────────────────── */}
            <Section
              title={`Rincian Transaksi — ${reportLabel}`}
              icon={FileText}
              accent="indigo"
              rightSlot={
                <span className="text-tiny text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {reportTrxFiltered.length} dari {reportTrxSorted.length}
                </span>
              }
              bodyClassName="p-0"
            >
              {reportTrxSorted.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={FileText}
                    title="Tidak ada transaksi"
                    description={`Belum ada transaksi tercatat di ${reportLabel}.`}
                    action={
                      <Button variant="primary" size="md" onClick={() => { setActiveTab('table'); }}>
                        <Plus className="w-4 h-4" /> Catat Transaksi
                      </Button>
                    }
                  />
                </div>
              ) : (
                <>
                  {/* Search bar */}
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                      <input
                        type="search"
                        value={reportSearch}
                        onChange={e => setReportSearch(e.target.value)}
                        placeholder="Cari deskripsi, kategori, nominal..."
                        aria-label="Cari di rincian transaksi"
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                      />
                    </div>
                    {reportSearch && (
                      <button
                        type="button"
                        onClick={() => setReportSearch('')}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="overflow-auto max-h-[420px]">
                    <table className="w-full text-sm border-collapse min-w-[700px]">
                      <thead className="bg-slate-50 sticky top-0" style={{ zIndex: 'var(--z-sticky)' }}>
                        <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-2.5 text-left w-28">Tanggal</th>
                          <th className="px-4 py-2.5 text-left w-28">Kategori</th>
                          <th className="px-4 py-2.5 text-left w-40">Sub-Kategori</th>
                          <th className="px-4 py-2.5 text-left">Deskripsi</th>
                          <th className="px-4 py-2.5 text-right w-36">Nominal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportTrxFiltered.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                              Tidak ada hasil untuk "<b>{reportSearch}</b>".
                            </td>
                          </tr>
                        ) : reportTrxFiltered.map((t, i) => (
                          <tr key={t.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                            <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">{fmtTanggalPendekTahun(t.tanggal)}</td>
                            <td className="px-4 py-2">
                              <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${t.nominal > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {t.kategori}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-slate-500">{t.subKategori || <span className="text-slate-300 italic">—</span>}</td>
                            <td className="px-4 py-2 text-slate-700 text-xs">{t.deskripsi}</td>
                            <td className={`px-4 py-2 text-right font-semibold text-xs tabular-nums whitespace-nowrap ${t.nominal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {t.nominal >= 0 ? '+' : '−'} Rp {fmt(Math.abs(t.nominal))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                        <tr>
                          <td colSpan={4} className="px-4 py-2.5 text-right text-xs font-bold text-slate-600">
                            Total Laba Bersih ({reportLabel}):
                          </td>
                          <td className={`px-4 py-2.5 text-right font-black text-sm tabular-nums whitespace-nowrap ${reportLaba >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>
                            {reportLaba >= 0 ? '+' : '−'} Rp {fmt(Math.abs(reportLaba))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </Section>
          </div>
        )}

        {/* Tab Content: Piutang */}
        {activeTab === 'piutang' && (
          <div className="flex-1 overflow-auto flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Piutang</p>
                <h3 className="text-lg font-bold text-amber-700">Rp {fmt(totalPiutang)}</h3>
                <p className="text-2xs text-slate-500 mt-0.5">{piutangList.length} WO belum lunas</p>
              </div>
              <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">WO Sudah Lunas</p>
                <h3 className="text-lg font-bold text-emerald-700">{totalLunas} WO</h3>
                <p className="text-2xs text-slate-500 mt-0.5">Pembayaran lengkap</p>
              </div>
              <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-red-500">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Lewat Jatuh Tempo</p>
                <h3 className="text-lg font-bold text-red-700">{piutangList.filter(p => p.info.isOverdue).length} WO</h3>
                <p className="text-2xs text-slate-500 mt-0.5">Tagihan harus segera ditagih</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">Daftar Piutang per Work Order</h3>
                <span className="text-xs text-slate-400">Klik baris untuk catat pembayaran</span>
              </div>
              {piutangList.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Wallet className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
                  <p className="text-sm font-medium text-emerald-600">Tidak ada piutang. Semua WO sudah lunas.</p>
                </div>
              ) : (
                <>
                  {/* ─── MOBILE: Card list (<md) ─── Owner persona view utama.
                       Sisa tagihan & status overdue paling prominent. Tap "Catat Lunas"
                       langsung record pelunasan tanpa buka form. */}
                  <div className="md:hidden p-3 space-y-2">
                    {piutangList.map(({ wo, info }) => {
                      const bgClass = info.isOverdue
                        ? 'bg-red-50 border-red-200'
                        : info.isDueSoon
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-white border-slate-200';
                      return (
                        <div key={wo.id} className={`border rounded-xl p-3 shadow-sm ${bgClass}`}>
                          {/* Top: status badge + WO id */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase tracking-wider font-bold border ${
                              info.status === 'Belum Bayar' ? 'bg-red-100 text-red-700 border-red-300' :
                              info.status === 'DP' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                              'bg-emerald-100 text-emerald-700 border-emerald-300'
                            }`}>{info.status}</span>
                            <span className="font-mono text-2xs text-slate-500">{wo.id}</span>
                          </div>
                          {/* Customer + item */}
                          <p className="font-semibold text-sm text-slate-800 truncate">{wo.customer}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{wo.merk || '—'}</p>
                          {/* Sisa Tagihan — prominent */}
                          <div className="mt-3 pt-3 border-t border-slate-200/60">
                            <p className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Sisa Tagihan</p>
                            <p className="text-xl font-black text-amber-700 mt-0.5">Rp {fmt(info.sisaTagihan)}</p>
                            {info.totalBayar > 0 && (
                              <p className="text-2xs text-emerald-700 mt-0.5">
                                Sudah dibayar Rp {fmt(info.totalBayar)}
                              </p>
                            )}
                          </div>
                          {/* Jatuh tempo */}
                          <div className="mt-2 text-xs">
                            {info.jatuhTempo ? (
                              <div className={`font-medium ${
                                info.isOverdue ? 'text-red-700' :
                                info.isDueSoon ? 'text-amber-700' : 'text-slate-700'
                              }`}>
                                {info.isOverdue && info.hariKeJatuhTempo != null && (
                                  <>🔴 Lewat <b>{Math.abs(info.hariKeJatuhTempo)} hari</b> · </>
                                )}
                                {!info.isOverdue && info.isDueSoon && info.hariKeJatuhTempo != null && (
                                  <>⏰ {info.hariKeJatuhTempo === 0 ? 'Hari ini' : `${info.hariKeJatuhTempo} hari lagi`} · </>
                                )}
                                {!info.isOverdue && !info.isDueSoon && info.hariKeJatuhTempo != null && (
                                  <>{info.hariKeJatuhTempo} hari lagi · </>
                                )}
                                Jatuh tempo {fmtTanggalPendekTahun(info.jatuhTempo)}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">
                                {(wo.terminHari ?? 0) === 0 ? 'COD — bayar di tempat' : 'Invoice belum terbit'}
                              </span>
                            )}
                          </div>
                          {/* Action — touch target 44px high, full-width */}
                          <button
                            type="button"
                            title="Catat pelunasan piutang ini"
                            onClick={() => {
                              let max = 0;
                              finance.forEach(t => { const n = parseInt(t.id.split('-').at(-1)!, 10); if (!isNaN(n) && n > max) max = n; });
                              const newId = `TRX-${String(max + 1).padStart(3, '0')}`;
                              addFinance({
                                id: newId,
                                tanggal: new Date().toISOString().split('T')[0],
                                kategori: 'Pemasukan',
                                subKategori: 'Pelunasan',
                                deskripsi: `Pelunasan - ${wo.id} (${wo.customer})`,
                                nominal: info.sisaTagihan,
                                catatan: '',
                                woId: wo.id,
                              });
                              setActiveTab('table');
                            }}
                            className="mt-3 w-full min-h-[44px] px-3 py-2 text-sm font-semibold bg-emerald-600 text-white border border-emerald-700 rounded-lg hover:bg-emerald-700 active:bg-emerald-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                          >
                            ✓ Catat Lunas — Rp {fmt(info.sisaTagihan)}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* ─── DESKTOP: Table (md+) ─── */}
                  <div className="hidden md:block overflow-auto">
                    <table className="w-full text-sm border-collapse min-w-[1100px]">
                    <thead className="bg-slate-50 sticky top-0" style={{ zIndex: 'var(--z-sticky)' }}>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">No. WO</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pelanggan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Total Tagihan</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Sudah Dibayar</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Sisa Tagihan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Jatuh Tempo</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {piutangList.map(({ wo, info }, i) => (
                        <tr key={wo.id} className={`border-b border-slate-100 transition-colors ${
                          info.isOverdue ? 'bg-red-50/40 hover:bg-red-50/70' :
                          info.isDueSoon ? 'bg-amber-50/30 hover:bg-amber-50/60' :
                          i % 2 === 1 ? 'bg-slate-50/50 hover:bg-amber-50/40' : 'hover:bg-amber-50/40'
                        }`}>
                          <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{wo.id}</td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{wo.customer}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{wo.merk}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            Rp {fmt(Math.max((wo.estimatedCost || 0) - (wo.diskon || 0), 0))}
                            {(wo.diskon || 0) > 0 && (
                              <span className="block text-2xs text-amber-500 font-normal">diskon Rp {fmt(wo.diskon!)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-600">Rp {fmt(info.totalBayar)}</td>
                          <td className="px-4 py-3 text-right font-bold text-amber-700">Rp {fmt(info.sisaTagihan)}</td>
                          <td className="px-4 py-3 text-xs">
                            {info.jatuhTempo ? (
                              <div>
                                <div className={`font-medium ${info.isOverdue ? 'text-red-700' : info.isDueSoon ? 'text-amber-700' : 'text-slate-700'}`}>
                                  {fmtTanggalPendekTahun(info.jatuhTempo)}
                                </div>
                                <div className={`text-2xs ${info.isOverdue ? 'text-red-600' : info.isDueSoon ? 'text-amber-600' : 'text-slate-400'}`}>
                                  {info.isOverdue && info.hariKeJatuhTempo != null && `🔴 Lewat ${Math.abs(info.hariKeJatuhTempo)} hari`}
                                  {!info.isOverdue && info.isDueSoon && info.hariKeJatuhTempo != null && (info.hariKeJatuhTempo === 0 ? '⏰ Hari ini' : `⏰ ${info.hariKeJatuhTempo} hari lagi`)}
                                  {!info.isOverdue && !info.isDueSoon && info.hariKeJatuhTempo != null && `${info.hariKeJatuhTempo} hari lagi`}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300 italic text-xs">
                                {(wo.terminHari ?? 0) === 0 ? 'COD' : 'Invoice belum terbit'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-2xs uppercase tracking-wider font-bold border ${
                              info.status === 'Belum Bayar' ? 'bg-red-50 text-red-700 border-red-200' :
                              info.status === 'DP' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>{info.status}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              title="Catat pelunasan piutang ini"
                              onClick={() => {
                                let max = 0;
                                finance.forEach(t => { const n = parseInt(t.id.split('-').at(-1)!, 10); if (!isNaN(n) && n > max) max = n; });
                                const newId = `TRX-${String(max + 1).padStart(3, '0')}`;
                                addFinance({
                                  id: newId,
                                  tanggal: new Date().toISOString().split('T')[0],
                                  kategori: 'Pemasukan',
                                  subKategori: 'Pelunasan',
                                  deskripsi: `Pelunasan - ${wo.id} (${wo.customer})`,
                                  nominal: info.sisaTagihan,
                                  catatan: '',
                                  woId: wo.id,    // Phase 5: link FK eksplisit
                                });
                                setActiveTab('table');
                              }}
                              className="px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors">
                              Catat Lunas
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-300">
                        <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-700">Total Piutang Keseluruhan:</td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700 text-base">Rp {fmt(totalPiutang)}</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
