import { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Search, Download, X, ChevronDown, FileText, BarChart2, BellRing, Printer, Wallet, FileSpreadsheet, Filter as FilterIcon } from 'lucide-react';
import { useStore, computeStatusBayar, type FinanceTransaction } from '../store/useStore';
import { exportBukuKas, exportLaporanBulanan, exportPiutang, exportLaporanLengkap } from '../lib/exportExcel';
import { toast } from '../lib/toast';
import { Button, DataHeader, DataCell, EmptyRow, type SortDir } from '../components/ui';
import { confirm } from '../lib/confirm';

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(Math.abs(n));

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
      className={`cursor-pointer font-semibold transition-colors ${value >= 0 ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'}`}
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
    <span onDoubleClick={() => setEditing(true)} className={`cursor-pointer inline-block px-2.5 py-0.5 rounded-full text-2xs uppercase tracking-wider font-bold ${value === 'Pemasukan' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {value}
    </span>
  );
}

function SubKategoriCell({ value, onSave, kategori }: { value: string; onSave: (v: string) => void; kategori: string }) {
  const [editing, setEditing] = useState(false);
  
  const options = kategori === 'Pemasukan' 
    ? ['Pembayaran Servis', 'DP', 'Lain-lain']
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

function DeskripsiCell({ value, onSave, onFill, kategori }: {
  value: string; onSave: (v: string) => void;
  onFill: (label: string, nominal: number) => void;
  kategori: string;
}) {
  const workOrders = useStore(s => s.workOrders);
  const finance = useStore(s => s.finance);
  const inventory = useStore(s => s.inventory);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const suggestionsPemasukan = kategori === 'Pemasukan'
    ? workOrders.flatMap(wo => {
        // Tagihan efektif = estimatedCost dikurangi diskon
        const effectiveTotal = Math.max((wo.estimatedCost || 0) - (wo.diskon || 0), 0);
        const dpPaid = finance
          .filter(f => f.deskripsi.includes(`Pembayaran DP`) && f.deskripsi.includes(wo.id) && f.nominal > 0)
          .reduce((sum, f) => sum + f.nominal, 0);
        const remaining = Math.max(effectiveTotal - dpPaid, 0);
        return [
          { label: `Pembayaran DP - ${wo.id} (${wo.customer})`, nominal: Math.round(effectiveTotal * 0.5), type: 'dp' as const },
          { label: `Pelunasan - ${wo.id} (${wo.customer})`, nominal: remaining, type: 'lunas' as const },
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
          <div className="absolute left-0 top-6 z-30 bg-white border border-slate-200 rounded-lg shadow-xl w-80 max-h-64 overflow-y-auto">
            <p className="px-3 py-1.5 text-2xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              {kategori === 'Pemasukan' ? 'Pilih dari Work Order' : 'Pilih dari Inventory'}
            </p>
            
            {kategori === 'Pemasukan' && suggestionsPemasukan.length === 0 && <p className="px-3 py-3 text-xs text-slate-400">Tidak ada data.</p>}
            {kategori === 'Pemasukan' && suggestionsPemasukan.map((s, idx) => (
              <button key={idx}
                className="w-full text-left px-3 py-2.5 text-xs hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onFill(s.label, s.nominal); setShowDropdown(false); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-bold ${s.type === 'dp' ? 'text-amber-600' : 'text-green-600'}`}>
                      {s.type === 'dp' ? '⬡ DP' : '✓ Lunas'}
                    </span>
                    <span className="ml-2 text-slate-600">{s.label.replace(/^(Pembayaran DP|Pelunasan) - /, '')}</span>
                  </div>
                  <span className={`ml-2 shrink-0 font-semibold ${s.type === 'lunas' ? 'text-green-700' : 'text-amber-700'}`}>
                    Rp {new Intl.NumberFormat('id-ID').format(s.nominal)}
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
                    Rp {new Intl.NumberFormat('id-ID').format(s.nominal)} / satuan
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
      const label = d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
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
    const subs = ['Pembayaran Servis', 'DP', 'Lain-lain'];
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
  const reportLabel = useMemo(() => {
    const [y, m] = reportPeriod.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [reportPeriod]);

  // Build list bulan tersedia dari data (untuk dropdown)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    finance.forEach(t => set.add(t.tanggal.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [finance]);

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
      <header className="bg-white border-b border-slate-200 h-12 flex items-center px-6 justify-between shrink-0">
        <div className="flex items-center gap-6 overflow-hidden">
          <h2 className="text-base font-semibold text-slate-800 whitespace-nowrap">Manajemen Keuangan (Finance)</h2>
          <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('table')} className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <FileText className="w-4 h-4" /> Buku Kas
            </button>
            <button onClick={() => setActiveTab('report')} className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'report' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <BarChart2 className="w-4 h-4" /> Laporan Laba Rugi
            </button>
            <button onClick={() => setActiveTab('piutang')} className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${activeTab === 'piutang' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Wallet className="w-4 h-4" /> Piutang
              {piutangList.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-2xs font-bold">{piutangList.length}</span>
              )}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Export Excel — kontekstual per tab */}
          {activeTab === 'table' && (
            <Button variant="success" title="Export Buku Kas ke Excel"
              onClick={() => { exportBukuKas(finance); toast.success('Buku Kas berhasil di-export!'); }}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
          )}
          {activeTab === 'report' && (
            <Button variant="success" title="Export laporan lengkap ke Excel"
              onClick={() => {
                exportLaporanLengkap(finance, workOrders, inventory, [], reportPeriod);
                toast.success(`Laporan ${reportLabel} berhasil di-export!`);
              }}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
          )}
          {activeTab === 'piutang' && (
            <Button variant="success" title="Export piutang ke Excel"
              onClick={() => { exportPiutang(workOrders, finance); toast.success('Data piutang berhasil di-export!'); }}>
              <FileSpreadsheet className="w-4 h-4" /> Export Excel
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.open(`/erp/print/laporan-keuangan?period=${reportPeriod}`, '_blank')}>
            <Printer className="w-4 h-4" /> Cetak PDF
          </Button>
          {activeTab === 'table' && (
            <Button variant="primary" onClick={handleAdd}>
              <Plus className="w-4 h-4" /> Catat Transaksi
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
            <div className="grid grid-cols-5 gap-3 shrink-0">
              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pemasukan Bulan Ini</p>
                <h3 className="text-base font-bold text-green-600">Rp {fmt(pemasukanBulanIni)}</h3>
              </div>
              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pengeluaran Bulan Ini</p>
                <h3 className="text-base font-bold text-red-600">Rp {fmt(pengeluaranBulanIni)}</h3>
              </div>
              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Pemasukan</p>
                <h3 className="text-base font-bold text-green-700">Rp {fmt(totalPemasukan)}</h3>
              </div>
              <button onClick={() => setActiveTab('piutang')}
                title="Lihat detail piutang"
                className={`text-left bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between hover:bg-amber-50 transition-colors ${piutangList.length > 0 ? 'border-l-4 border-l-amber-500' : ''}`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                  Piutang Belum Lunas
                  {piutangList.length > 0 && <span className="text-3xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{piutangList.length} WO</span>}
                </p>
                <h3 className={`text-base font-bold ${piutangList.length > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                  Rp {fmt(totalPiutang)}
                </h3>
              </button>
              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-indigo-500 flex flex-col justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Saldo Kas Keseluruhan</p>
                <h3 className={`text-base font-bold ${saldo >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                  Rp {fmt(saldo)}{saldo < 0 && ' (Minus)'}
                </h3>
              </div>
            </div>

            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Cari transaksi..." aria-label="Cari transaksi" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 bg-slate-50 placeholder:text-slate-400" />
                </div>
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
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr className="border-b border-slate-200">
                      <DataHeader label="Tanggal" field="tanggal" w="w-32" {...thProps} />
                      <DataHeader label="Kategori" field="kategori" w="w-24" {...thProps} />
                      <DataHeader label="Sub-Kategori" field="subKategori" w="w-40" {...thProps} />
                      <DataHeader label="Deskripsi Transaksi" field="deskripsi" {...thProps} />
                      <DataHeader label="Catatan" field="catatan" w="w-48" {...thProps} />
                      <DataHeader label="Nominal (Rp)" field="nominal" w="w-36" {...thProps} />
                      <DataHeader label="Saldo Berjalan" w="w-36" {...thProps} />
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody ref={tableBodyRef}>
                    {filtered.length === 0 && <EmptyRow colSpan={8} message="Tidak ada data ditemukan." />}
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
                              onFill={(label, nominal) => updateFinance({ ...trx, deskripsi: label, nominal: trx.kategori === 'Pengeluaran' ? -Math.abs(nominal) : Math.abs(nominal) })}
                              kategori={trx.kategori}
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
                            <button title="Hapus transaksi" aria-label="Hapus transaksi"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Hapus transaksi?',
                                  message: <>Transaksi <b>{trx.deskripsi}</b> ({trx.tanggal}, Rp {fmt(trx.nominal)}) akan dihapus permanen dari buku kas. Saldo berjalan akan dihitung ulang otomatis.</>,
                                  destructive: true,
                                  confirmLabel: 'Hapus transaksi',
                                });
                                if (ok) deleteFinance(trx.id);
                              }}
                              className="inline-flex items-center justify-center w-7 h-7 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 shrink-0">
                <span className="text-xs text-slate-400">Menampilkan {filtered.length} dari {finance.length} transaksi</span>
              </div>
            </div>
          </>
        )}

        {/* Tab Content: Laporan & Grafik */}
        {activeTab === 'report' && (
          <div className="flex-1 overflow-auto flex flex-col gap-4 p-1">

            {/* Period Selector */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-5 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-600">Periode Laporan:</span>
                <select
                  value={reportPeriod}
                  onChange={e => setReportPeriod(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 font-medium text-slate-700"
                  aria-label="Pilih periode laporan"
                >
                  {availableMonths.map(m => {
                    const [y, mo] = m.split('-');
                    const label = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m}>{label}</option>;
                  })}
                </select>
                <span className="text-xs text-slate-400">({reportTrx.length} transaksi)</span>
              </div>
            </div>

            {/* KPI Bulan Dipilih */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 border-l-4 border-l-green-500">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Pemasukan</p>
                <p className="text-2xl font-black text-green-600">Rp {fmt(reportPemasukan)}</p>
                <p className="text-xs text-slate-400 mt-1">{subPemasukan.length} sub-kategori</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 border-l-4 border-l-red-500">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total Pengeluaran</p>
                <p className="text-2xl font-black text-red-600">Rp {fmt(reportPengeluaran)}</p>
                <p className="text-xs text-slate-400 mt-1">{subPengeluaran.length} sub-kategori</p>
              </div>
              <div className={`bg-white border border-slate-200 rounded-xl shadow-sm p-4 border-l-4 ${reportLaba >= 0 ? 'border-l-indigo-500' : 'border-l-orange-500'}`}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Laba Bersih</p>
                <p className={`text-2xl font-black ${reportLaba >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>
                  {reportLaba >= 0 ? '+' : '-'} Rp {fmt(Math.abs(reportLaba))}
                </p>
                <p className="text-xs text-slate-400 mt-1">{reportLaba >= 0 ? 'Laba periode ini' : 'Rugi periode ini'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Breakdown Pemasukan */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
                  Rincian Pemasukan — {reportLabel}
                </h3>
                {subPemasukan.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Tidak ada pemasukan bulan ini.</p>
                ) : (
                  <div className="space-y-3">
                    {subPemasukan.map(({ sub, total }) => {
                      const pct = reportPemasukan > 0 ? (total / reportPemasukan) * 100 : 0;
                      return (
                        <div key={sub}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-600">{sub}</span>
                            <span className="font-semibold text-slate-800">Rp {fmt(total)} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-bold">
                      <span className="text-slate-600">Total</span>
                      <span className="text-green-700">Rp {fmt(reportPemasukan)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Breakdown Pengeluaran */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                  Rincian Pengeluaran — {reportLabel}
                </h3>
                {subPengeluaran.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Tidak ada pengeluaran bulan ini.</p>
                ) : (
                  <div className="space-y-3">
                    {subPengeluaran.map(({ sub, total }) => {
                      const pct = reportPengeluaran > 0 ? (total / reportPengeluaran) * 100 : 0;
                      return (
                        <div key={sub}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-600">{sub}</span>
                            <span className="font-semibold text-slate-800">Rp {fmt(total)} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span></span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-slate-100 flex justify-between text-sm font-bold">
                      <span className="text-slate-600">Total</span>
                      <span className="text-red-700">Rp {fmt(reportPengeluaran)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tren 6 Bulan */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Tren Laba Rugi (6 Bulan Terakhir)</span>
                <div className="flex items-center gap-3 text-xs font-normal text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-green-500 inline-block" /> Pemasukan</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-red-500 inline-block" /> Pengeluaran</span>
                </div>
              </h3>
              <div className="h-48 flex items-end gap-4">
                {last6Months.map((m, i) => {
                  const pemH = (m.pem / maxChartValue) * 100;
                  const pengH = (m.peng / maxChartValue) * 100;
                  const net = m.pem - m.peng;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-2xs py-1.5 px-2.5 rounded whitespace-nowrap pointer-events-none z-10 shadow-lg">
                        <p className="text-green-300 font-bold">+Rp {fmt(m.pem)}</p>
                        <p className="text-red-300 font-bold">-Rp {fmt(m.peng)}</p>
                        <p className={`font-bold border-t border-slate-600 mt-1 pt-1 ${net >= 0 ? 'text-indigo-300' : 'text-orange-300'}`}>Laba: Rp {fmt(net)}</p>
                      </div>
                      <div className="flex items-end gap-0.5 w-full h-36">
                        <div className="flex-1 bg-green-500 rounded-t hover:bg-green-400 transition-colors" style={{ height: `${pemH}%`, minHeight: m.pem > 0 ? '3px' : '0' }} />
                        <div className="flex-1 bg-red-500 rounded-t hover:bg-red-400 transition-colors" style={{ height: `${pengH}%`, minHeight: m.peng > 0 ? '3px' : '0' }} />
                      </div>
                      <span className="text-2xs font-medium text-slate-400">{m.label}</span>
                      <span className={`text-3xs font-bold px-1.5 py-0.5 rounded-full ${net >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {net >= 0 ? '+' : ''}Rp {fmt(net)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabel Rincian Transaksi Periode */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">Rincian Transaksi — {reportLabel}</h3>
                <span className="text-xs text-slate-400">{reportTrxSorted.length} transaksi</span>
              </div>
              {reportTrxSorted.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">Tidak ada transaksi pada periode ini.</div>
              ) : (
                <div className="overflow-auto max-h-64">
                  <table className="w-full text-sm border-collapse min-w-[700px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="px-4 py-2 text-left w-28">Tanggal</th>
                        <th className="px-4 py-2 text-left w-28">Kategori</th>
                        <th className="px-4 py-2 text-left w-40">Sub-Kategori</th>
                        <th className="px-4 py-2 text-left">Deskripsi</th>
                        <th className="px-4 py-2 text-right w-36">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportTrxSorted.map((t, i) => (
                        <tr key={t.id} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                          <td className="px-4 py-2 text-slate-500 text-xs">{t.tanggal}</td>
                          <td className="px-4 py-2">
                            <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${t.nominal > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {t.kategori}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500">{t.subKategori || '-'}</td>
                          <td className="px-4 py-2 text-slate-700 text-xs">{t.deskripsi}</td>
                          <td className={`px-4 py-2 text-right font-semibold text-xs ${t.nominal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {t.nominal >= 0 ? '+' : '-'} Rp {fmt(Math.abs(t.nominal))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-right text-xs font-bold text-slate-600">Total Laba Bersih:</td>
                        <td className={`px-4 py-2 text-right font-black text-sm ${reportLaba >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>
                          {reportLaba >= 0 ? '+' : '-'} Rp {fmt(Math.abs(reportLaba))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Piutang */}
        {activeTab === 'piutang' && (
          <div className="flex-1 overflow-auto flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 shrink-0">
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
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Belum Bayar Sama Sekali</p>
                <h3 className="text-lg font-bold text-red-700">{piutangList.filter(p => p.info.status === 'Belum Bayar').length} WO</h3>
                <p className="text-2xs text-slate-500 mt-0.5">Belum ada pembayaran tercatat</p>
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
                <div className="overflow-auto">
                  <table className="w-full text-sm border-collapse min-w-[900px]">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">No. WO</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pelanggan</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Item</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Total Tagihan</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Sudah Dibayar</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Sisa Tagihan</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Status</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {piutangList.map(({ wo, info }, i) => (
                        <tr key={wo.id} className={`border-b border-slate-100 hover:bg-amber-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                          <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{wo.id}</td>
                          <td className="px-4 py-3 text-slate-800 font-medium">{wo.customer}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{wo.merk}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            Rp {fmt(Math.max((wo.estimatedCost || 0) - (wo.diskon || 0), 0))}
                            {(wo.diskon || 0) > 0 && (
                              <span className="block text-2xs text-amber-500 font-normal">diskon Rp {fmt(wo.diskon!)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-green-600">Rp {fmt(info.totalBayar)}</td>
                          <td className="px-4 py-3 text-right font-bold text-amber-700">Rp {fmt(info.sisaTagihan)}</td>
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
                                  subKategori: 'Pembayaran Servis',
                                  deskripsi: `Pelunasan - ${wo.id} (${wo.customer})`,
                                  nominal: info.sisaTagihan,
                                  catatan: '',
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
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
