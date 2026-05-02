import { useState, useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Plus, X, Trash2, Search, Download, Filter, FileSpreadsheet, Clock, Eye, Wrench as WrenchIcon, FlaskConical, CheckCircle, PackageCheck } from 'lucide-react';
import { useStore, computeStatusBayar, type WorkOrder, type BomItem, type ServiceItem, type StatusBayar } from '../store/useStore';
import type { ColDef, CellValueChangedEvent, ValueFormatterParams, ICellRendererParams } from 'ag-grid-community';
import { exportWorkOrders } from '../lib/exportExcel';
import { toast } from '../lib/toast';
import { StatusPill } from './Dashboard';

const STATUS_OPTIONS = ['Queue', 'Inspecting', 'Repairing', 'Testing', 'Finished', 'Picked Up'];
const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);

function StatusBayarBadge({ status, sisa }: { status: StatusBayar; sisa: number }) {
  const map: Record<StatusBayar, string> = {
    'Belum Bayar': 'bg-red-50 text-red-700 border-red-200',
    'DP': 'bg-amber-50 text-amber-700 border-amber-200',
    'Lunas': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  const label = status === 'DP' && sisa > 0
    ? `DP · sisa ${new Intl.NumberFormat('id-ID').format(sisa)}`
    : status;
  return (
    <span title={status === 'DP' ? `Sisa tagihan Rp ${new Intl.NumberFormat('id-ID').format(sisa)}` : status}
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold border ${map[status]}`}>
      {label}
    </span>
  );
}

function EditableCell({ value, onSave, type = 'text' }: { value: string; onSave: (v: string) => void; type?: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  return editing ? (
    <input aria-label="Edit nilai" title="Edit nilai" type={type}
      autoFocus className="w-full border border-indigo-400 rounded px-1.5 py-0.5 text-sm focus:outline-none"
      value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { onSave(val); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(val); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
  ) : (
    <span className="cursor-pointer hover:text-indigo-600" onDoubleClick={() => { setVal(value); setEditing(true); }}>
      {value || <span className="text-slate-300">—</span>}
    </span>
  );
}

function StatusCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <select title="Pilih status" aria-label="Pilih status"
      autoFocus className="text-xs border border-indigo-400 rounded px-1 py-0.5 focus:outline-none bg-white"
      value={value} onChange={e => { onSave(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}>
      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  ) : (
    <span className="cursor-pointer" onDoubleClick={() => setEditing(true)}><StatusPill status={value} /></span>
  );
}

type SortDir = 'asc' | 'desc';
function ThCell({ label, field, sortField, sortDir, onSort, w }: {
  label: string; field?: string; sortField: string | null; sortDir: SortDir; onSort: (f: string) => void; w?: string;
}) {
  const active = sortField === field;
  return (
    <th onClick={() => field && onSort(field)}
      className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap select-none ${field ? 'cursor-pointer hover:bg-slate-100' : ''} ${w ?? ''}`}>
      {label}
      {field && <span className={`ml-1 ${active ? 'text-indigo-500' : 'text-slate-300'}`}>{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>}
    </th>
  );
}

// ── BomRow: tabel material per-baris dengan inline editing + autocomplete ──────
function BomRow({ bom, inventory, onUpdate, onRemove }: {
  bom: BomItem;
  inventory: ReturnType<typeof useStore.getState>['inventory'];
  onUpdate: (b: BomItem) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState<BomItem>({ ...bom });
  const [showDrop, setShowDrop] = useState(false);
  const [barangInput, setBarangInput] = useState(bom.barang);
  const dropRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = barangInput.trim().toLowerCase();
    if (!q) return inventory.slice(0, 25);
    return inventory.filter(i => i.nama.toLowerCase().includes(q)).slice(0, 20);
  }, [barangInput, inventory]);

  const commit = (updated: BomItem) => { setDraft(updated); onUpdate(updated); };

  const selectItem = (inv: typeof inventory[0]) => {
    const updated = { ...draft, barang: inv.nama, stok: inv.stok, satuan: inv.satuan, harga: inv.hargaJual };
    setBarangInput(inv.nama);
    setShowDrop(false);
    commit(updated);
  };

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      {/* Nama Barang */}
      <td className="px-2 py-1 relative">
        <input
          type="text"
          value={barangInput}
          onChange={e => { setBarangInput(e.target.value); setShowDrop(true); }}
          onFocus={() => setShowDrop(true)}
          onBlur={() => {
            setTimeout(() => setShowDrop(false), 150);
            const updated = { ...draft, barang: barangInput };
            commit(updated);
          }}
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-400 min-w-[180px]"
          placeholder="Ketik nama barang..."
        />
        {showDrop && filtered.length > 0 && (
          <div ref={dropRef} className="absolute left-2 top-full mt-0.5 bg-white border border-indigo-300 rounded-lg shadow-xl z-[999] overflow-y-auto max-h-[180px] min-w-[280px]">
            {filtered.map(inv => (
              <div
                key={inv.id}
                onMouseDown={e => { e.preventDefault(); selectItem(inv); }}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 flex justify-between gap-4"
              >
                <span className="font-medium text-slate-700 truncate">{inv.nama}</span>
                <span className="text-xs text-slate-400 whitespace-nowrap">Rp {fmt(inv.hargaJual)}</span>
              </div>
            ))}
          </div>
        )}
      </td>
      {/* Stok (read-only) */}
      <td className="px-2 py-1 text-center text-sm text-slate-500 w-16">{draft.stok}</td>
      {/* Jumlah */}
      <td className="px-2 py-1 w-16">
        <input type="number" min={1} value={draft.jumlah} title="Jumlah" aria-label="Jumlah"
          onChange={e => setDraft(d => ({ ...d, jumlah: Number(e.target.value) }))}
          onBlur={() => commit(draft)}
          className="w-full border border-slate-200 rounded px-1 py-1 text-sm text-center focus:outline-none focus:border-indigo-400" />
      </td>
      {/* Satuan */}
      <td className="px-2 py-1 w-20">
        <input type="text" value={draft.satuan} title="Satuan" aria-label="Satuan"
          onChange={e => setDraft(d => ({ ...d, satuan: e.target.value }))}
          onBlur={() => commit(draft)}
          className="w-full border border-slate-200 rounded px-1 py-1 text-sm focus:outline-none focus:border-indigo-400" />
      </td>
      {/* Harga Satuan */}
      <td className="px-2 py-1 w-32">
        <input type="number" min={0} value={draft.harga} title="Harga Satuan" aria-label="Harga Satuan"
          onChange={e => setDraft(d => ({ ...d, harga: Number(e.target.value) }))}
          onBlur={() => commit(draft)}
          className="w-full border border-slate-200 rounded px-1 py-1 text-sm text-right focus:outline-none focus:border-indigo-400" />
      </td>
      {/* Subtotal */}
      <td className="px-2 py-1 text-right text-sm text-slate-700 w-32 whitespace-nowrap">{fmt(draft.jumlah * draft.harga)}</td>
      {/* Hapus */}
      <td className="px-2 py-1 w-10 text-center">
        <button title="Hapus" onClick={() => onRemove(bom.id)} className="flex items-center justify-center w-7 h-7 rounded bg-red-50 text-red-500 hover:bg-red-100 mx-auto">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function WorkOrders() {
  const workOrders = useStore(s => s.workOrders);
  const addWorkOrder = useStore(s => s.addWorkOrder);
  const updateWorkOrder = useStore(s => s.updateWorkOrder);
  const deleteWorkOrder = useStore(s => s.deleteWorkOrder);
  const boms = useStore(s => s.boms);
  const addBom = useStore(s => s.addBom);
  const updateBom = useStore(s => s.updateBom);
  const services = useStore(s => s.services);
  const addService = useStore(s => s.addService);
  const updateService = useStore(s => s.updateService);
  const finance = useStore(s => s.finance);

  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const newRowIdRef = useRef<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = workOrders.filter(wo =>
      wo.id.toLowerCase().includes(q) || wo.customer.toLowerCase().includes(q) ||
      wo.merk.toLowerCase().includes(q) || wo.status.toLowerCase().includes(q) || wo.technician.toLowerCase().includes(q)
    );
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sortField] ?? '');
        const bv = String((b as unknown as Record<string, unknown>)[sortField] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [workOrders, search, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const update = (wo: WorkOrder, field: keyof WorkOrder, value: string) =>
    updateWorkOrder({ ...wo, [field]: value });

  const handleAddWO = () => {
    const prefix = `WO-${new Date().toISOString().slice(2, 7).replace('-', '')}`;
    let max = 0;
    workOrders.forEach(wo => { const n = parseInt(wo.id.split('-').at(-1)!, 10); if (!isNaN(n) && n > max) max = n; });
    const newId = `${prefix}-${String(max + 1).padStart(3, '0')}`;
    newRowIdRef.current = newId;
    addWorkOrder({ id: newId, customer: 'Pelanggan Baru', merk: 'Barang Baru', capacity: '-', keluhan: '-', status: 'Queue', technician: '-', dateIn: new Date().toISOString().split('T')[0], estimasiSelesai: '-', estimatedCost: 0 });
    // Scroll after state update
    setTimeout(() => {
      const row = tableBodyRef.current?.querySelector(`[data-id="${newId}"]`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newRowIdRef.current = null;
    }, 80);
  };

  const handleExport = () => {
    const header = 'ID,Pelanggan,Merk,Kapasitas,Status,Teknisi,Tgl Masuk,Est. Selesai,Total Biaya';
    const rows = workOrders.map(w => `${w.id},${w.customer},${w.merk},${w.capacity},${w.status},${w.technician},${w.dateIn},${w.estimasiSelesai},${w.estimatedCost}`);
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'WorkOrders.csv'; a.click();
  };

  const defaultColDef = useMemo(() => ({ sortable: false, filter: false, resizable: true }), []);


  const [svcColDefs] = useState<ColDef<ServiceItem>[]>([
    { field: 'deskripsi', headerName: 'Deskripsi Jasa', flex: 1, editable: true },
    { field: 'biaya', headerName: 'Biaya', width: 150, editable: true, valueFormatter: (p: ValueFormatterParams<ServiceItem, number>) => fmt(p.value ?? 0) },
    { headerName: '', width: 50, sortable: false, filter: false, resizable: false, cellRenderer: (p: ICellRendererParams<ServiceItem>) => <button title="Hapus" onClick={() => p.data?.id && useStore.getState().removeService(p.data.id)} className="flex items-center justify-center w-7 h-7 rounded bg-red-50 text-red-500 hover:bg-red-100 mt-1"><Trash2 className="w-3.5 h-3.5" /></button> }
  ]);

  const handleBomUpdate = useCallback((updated: BomItem) => { updateBom(updated); }, [updateBom]);
  const handleBomRemove = useCallback((id: string) => { useStore.getState().removeBom(id); }, []);

  const handleSvcChanged = useCallback((e: CellValueChangedEvent<ServiceItem>) => { 
    if (e.data) {
      updateService(e.data);
      e.api.refreshCells({ rowNodes: [e.node], force: true });
    }
  }, [updateService]);

  const handleAddBom = () => {
    if (!selectedWO) return;
    let max = 0; boms.forEach(b => { const n = parseInt(b.id.split('-').at(-1)!, 10); if (!isNaN(n) && n > max) max = n; });
    addBom({ id: `BOM-${String(max + 1).padStart(4, '0')}`, woId: selectedWO.id, barang: '', stok: 0, jumlah: 1, satuan: 'Pcs', harga: 0 });
  };
  const handleAddService = () => {
    if (!selectedWO) return;
    let max = 0; services.forEach(s => { const n = parseInt(s.id.split('-').at(-1)!, 10); if (!isNaN(n) && n > max) max = n; });
    addService({ id: `SVC-${max + 1}`, woId: selectedWO.id, deskripsi: 'Jasa Servis Baru', biaya: 50000 });
  };
  const handleSave = () => {
    if (!selectedWO) return;
    const matCost = boms.filter(b => b.woId === selectedWO.id).reduce((a, b) => a + b.jumlah * b.harga, 0);
    const svcCost = services.filter(s => s.woId === selectedWO.id).reduce((a, s) => a + s.biaya, 0);
    updateWorkOrder({ ...selectedWO, estimatedCost: matCost + svcCost, diskon: selectedWO.diskon ?? 0 });
    setSelectedWO(null);
  };

  const today = new Date().toISOString().split('T')[0];
  const totalSpk = workOrders.length;
  const totalSelesai = workOrders.filter(w => w.status === 'Finished' || w.status === 'Picked Up').length;
  const overdueCount = workOrders.filter(w => w.status !== 'Finished' && w.status !== 'Picked Up' && w.estimasiSelesai !== '-' && w.estimasiSelesai < today).length;

  const thProps = { sortField, sortDir, onSort: handleSort };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-12 flex items-center px-6 justify-between shrink-0">
        <h2 className="text-base font-semibold text-slate-800">Manajemen Pekerjaan (Work Orders)</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { exportWorkOrders(workOrders, finance); toast.success('Data Work Orders berhasil di-export!'); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={handleAddWO} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> SPK Baru
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total SPK</p>
            <h3 className="text-lg font-bold text-slate-800">{totalSpk} <span className="text-xs font-normal text-slate-500">Pekerjaan</span></h3>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">SPK Selesai</p>
            <h3 className="text-lg font-bold text-emerald-600">{totalSelesai} <span className="text-xs font-normal text-slate-500">Pekerjaan</span></h3>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-red-400 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">SPK Jatuh Tempo</p>
            <h3 className={`text-lg font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{overdueCount} <span className="text-xs font-normal text-slate-500">Pekerjaan</span></h3>
          </div>
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cari work order..." aria-label="Cari work order" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 placeholder:text-slate-400" />
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><Filter className="w-4 h-4" /> Filter</button>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><Download className="w-4 h-4" /> Export CSV</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <ThCell label="ID" field="id" w="w-32" {...thProps} />
                  <ThCell label="Pelanggan" field="customer" {...thProps} />
                  <ThCell label="Item / Merk" field="merk" {...thProps} />
                  <ThCell label="Kapasitas" field="capacity" w="w-24" {...thProps} />
                  <ThCell label="Status" field="status" w="w-28" {...thProps} />
                  <ThCell label="Teknisi" field="technician" w="w-28" {...thProps} />
                  <ThCell label="Tgl Masuk" field="dateIn" w="w-28" {...thProps} />
                  <ThCell label="Est. Selesai" field="estimasiSelesai" w="w-28" {...thProps} />
                  <ThCell label="Total Biaya" field="estimatedCost" w="w-32" {...thProps} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Status Bayar</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-44">Aksi</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {filtered.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-12 text-slate-400">
                    {search ? 'Tidak ada data yang cocok dengan pencarian.' : (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm">Belum ada Work Order.</p>
                        <button onClick={handleAddWO} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                          <Plus className="w-4 h-4" /> Buat SPK Pertama
                        </button>
                      </div>
                    )}
                  </td></tr>
                )}
                {filtered.map((wo, i) => {
                  const piutang = computeStatusBayar(wo, finance);
                  return (
                  <tr key={wo.id} data-id={wo.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">{wo.id}</td>
                    <td className="px-4 py-3 text-slate-800 min-w-[140px]"><EditableCell value={wo.customer} onSave={v => update(wo, 'customer', v)} /></td>
                    <td className="px-4 py-3 text-slate-700 min-w-[120px]"><EditableCell value={wo.merk} onSave={v => update(wo, 'merk', v)} /></td>
                    <td className="px-4 py-3 text-slate-600"><EditableCell value={wo.capacity} onSave={v => update(wo, 'capacity', v)} /></td>
                    <td className="px-4 py-3"><StatusCell value={wo.status} onSave={v => update(wo, 'status', v)} /></td>
                    <td className="px-4 py-3 text-slate-700"><EditableCell value={wo.technician} onSave={v => update(wo, 'technician', v)} /></td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap"><EditableCell value={wo.dateIn} onSave={v => update(wo, 'dateIn', v)} type="date" /></td>
                    <td className="px-4 py-3 text-slate-600 text-xs"><EditableCell value={wo.estimasiSelesai} onSave={v => update(wo, 'estimasiSelesai', v)} type="date" /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        title="Klik untuk edit Jasa & Material"
                        onClick={() => setSelectedWO(wo)}
                        className="group flex items-center gap-2 text-left w-full hover:text-indigo-600 transition-colors"
                      >
                        <span className={`font-medium ${wo.estimatedCost ? 'text-slate-700' : 'text-slate-300'}`}>
                          {wo.estimatedCost ? `Rp ${fmt(wo.estimatedCost)}` : '—'}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                          <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {wo.estimatedCost > 0
                        ? <StatusBayarBadge status={piutang.status} sisa={piutang.sisaTagihan} />
                        : <span className="text-[10px] italic text-slate-300">— belum ada biaya —</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        title="Pilih Aksi" aria-label="Pilih Aksi"
                        className="text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-md px-2 py-1.5 w-36 cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-400 shadow-sm"
                        value=""
                        onChange={e => {
                          const val = e.target.value;
                          e.target.value = '';
                          if (val === 'spk') window.open(`/print/spk/${wo.id}`, '_blank');
                          else if (val === 'invoice') window.open(`/print/invoice/${wo.id}`, '_blank');
                          else if (val === 'sj') window.open(`/print/surat-jalan/${wo.id}`, '_blank');
                          else if (val === 'delete') { if (window.confirm(`Hapus WO "${wo.id}"?`)) deleteWorkOrder(wo.id); }
                        }}
                      >
                        <option value="" disabled hidden>Aksi...</option>
                        <option value="spk">📝 Cetak SPK</option>
                        <option value="invoice">🖨️ Cetak Invoice</option>
                        <option value="sj">📄 Cetak Surat Jalan</option>
                        <option value="delete">🗑️ Hapus WO</option>
                      </select>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 shrink-0">
            <span className="text-xs text-slate-400">Menampilkan {filtered.length} dari {workOrders.length} SPK</span>
          </div>
        </div>
      </main>

      {selectedWO && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Detail Pekerjaan & Material</h3>
                <p className="text-sm text-slate-500">WO: {selectedWO.id} — {selectedWO.merk}</p>
              </div>
              <button title="Tutup" onClick={() => setSelectedWO(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 flex-1 flex flex-col overflow-y-auto bg-slate-50 gap-5">
              <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg text-sm text-blue-800">
                Edit nilai di sel secara langsung. Klik <b>Simpan & Update Biaya WO</b> untuk memperbarui total biaya.
              </div>
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-slate-700">Tindakan Jasa</h4>
                  <button onClick={handleAddService} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-2 border border-indigo-200"><Plus className="w-4 h-4" /> Tambah Jasa</button>
                </div>
                <AgGridReact rowData={services.filter(s => s.woId === selectedWO.id)} columnDefs={svcColDefs} defaultColDef={defaultColDef} getRowId={p => p.data.id} className="ag-theme-alpine w-full" domLayout="autoHeight" rowHeight={40} headerHeight={40} onCellValueChanged={handleSvcChanged} />
              </div>
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-slate-700">Penggunaan Suku Cadang (Material)</h4>
                  <button onClick={handleAddBom} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-2 border border-emerald-200"><Plus className="w-4 h-4" /> Tambah Material</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">Nama Barang</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500 w-16">Stok</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500 w-16">Jml</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500 w-20">Satuan</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold text-slate-500 w-32">Harga Satuan</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold text-slate-500 w-32">Subtotal</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {boms.filter(b => b.woId === selectedWO.id).map(bom => (
                        <BomRow
                          key={bom.id}
                          bom={bom}
                          inventory={useStore.getState().inventory}
                          onUpdate={handleBomUpdate}
                          onRemove={handleBomRemove}
                        />
                      ))}
                      {boms.filter(b => b.woId === selectedWO.id).length === 0 && (
                        <tr><td colSpan={7} className="text-center py-6 text-slate-400 text-sm">Belum ada material. Klik + Tambah Material.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Diskon */}
              <div className="bg-white border border-amber-200 rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-700">Diskon</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Diskon akan mengurangi total tagihan di Invoice dan pencatatan piutang.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-slate-600 font-medium">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={selectedWO.diskon ?? 0}
                      onChange={e => setSelectedWO({ ...selectedWO, diskon: Math.max(0, Number(e.target.value)) })}
                      className="border border-slate-300 rounded-lg px-3 py-1.5 w-40 text-sm text-right focus:ring-2 focus:ring-amber-400 focus:outline-none"
                    />
                    {(selectedWO.diskon ?? 0) > 0 && selectedWO.estimatedCost > 0 && (
                      <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        {((selectedWO.diskon! / selectedWO.estimatedCost) * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setSelectedWO(null)} className="px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg font-medium hover:bg-slate-50 text-sm">Batal</button>
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 text-sm">Simpan & Update Biaya WO</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
