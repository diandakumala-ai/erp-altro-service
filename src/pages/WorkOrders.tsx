import { useState, useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Plus, Trash2, Download, FileSpreadsheet, Wrench, FileText, Printer, Truck } from 'lucide-react';
import { useStore, computeStatusBayar, type WorkOrder, type BomItem, type ServiceItem, type StatusBayar } from '../store/useStore';
import type { ColDef, CellValueChangedEvent, ValueFormatterParams, ICellRendererParams } from 'ag-grid-community';
import { exportWorkOrders } from '../lib/exportExcel';
import { toast } from '../lib/toast';
import { confirm } from '../lib/confirm';
import { Button, Badge, Dialog, DataHeader, DataCell, EmptyRow, EmptyState, StatCard, SearchInput, StatusPill, WO_STATUS, isFinished, ActionMenu, TerminSelector, type SortDir, type WOStatus } from '../components/ui';
import { fmt, fmtTanggal } from '../lib/format';
import { getJatuhTempo } from '../store/useStore';

type StatusFilter = 'all' | 'active' | 'overdue' | WOStatus;


function StatusBayarBadge({
  status, sisa, isOverdue, isDueSoon, hariKeJatuhTempo,
}: {
  status: StatusBayar; sisa: number;
  isOverdue?: boolean; isDueSoon?: boolean; hariKeJatuhTempo?: number | null;
}) {
  const tone = status === 'Belum Bayar' ? 'red' : status === 'DP' ? 'amber' : 'emerald';
  const label = status === 'DP' && sisa > 0 ? `DP · sisa ${fmt(sisa)}` : status;
  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge tone={tone} bordered title={status === 'DP' ? `Sisa tagihan Rp ${fmt(sisa)}` : status}>
        {label}
      </Badge>
      {isOverdue && hariKeJatuhTempo != null && (
        <Badge tone="red" bordered title={`Sudah lewat ${Math.abs(hariKeJatuhTempo)} hari dari jatuh tempo`}>
          ⚠ Lewat {Math.abs(hariKeJatuhTempo)}h
        </Badge>
      )}
      {!isOverdue && isDueSoon && hariKeJatuhTempo != null && (
        <Badge tone="amber" bordered title={`Jatuh tempo dalam ${hariKeJatuhTempo} hari`}>
          ⏰ {hariKeJatuhTempo === 0 ? 'Hari ini' : `${hariKeJatuhTempo}h lagi`}
        </Badge>
      )}
    </div>
  );
}

function StatusCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <select title="Pilih status" aria-label="Pilih status"
      autoFocus className="text-xs border border-indigo-400 rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 bg-white"
      value={value} onChange={e => { onSave(e.target.value); setEditing(false); }} onBlur={() => setEditing(false)}>
      {WO_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  ) : (
    <span role="button" tabIndex={0} aria-label="Edit status. Tekan Enter untuk mengubah."
      className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded"
      onDoubleClick={() => setEditing(true)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(true); } }}>
      <StatusPill status={value} />
    </span>
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
          className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus:border-indigo-400 min-w-[180px]"
          placeholder="Ketik nama barang..."
        />
        {showDrop && filtered.length > 0 && (
          <div ref={dropRef} className="absolute left-2 top-full mt-0.5 bg-white border border-indigo-300 rounded-lg shadow-xl overflow-y-auto max-h-[180px] min-w-[280px]" style={{ zIndex: 'var(--z-dropdown)' }}>
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
          className="w-full border border-slate-200 rounded px-1 py-1 text-sm text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus:border-indigo-400" />
      </td>
      {/* Satuan */}
      <td className="px-2 py-1 w-20">
        <input type="text" value={draft.satuan} title="Satuan" aria-label="Satuan"
          onChange={e => setDraft(d => ({ ...d, satuan: e.target.value }))}
          onBlur={() => commit(draft)}
          className="w-full border border-slate-200 rounded px-1 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus:border-indigo-400" />
      </td>
      {/* Harga Satuan */}
      <td className="px-2 py-1 w-32">
        <input type="number" min={0} value={draft.harga} title="Harga Satuan" aria-label="Harga Satuan"
          onChange={e => setDraft(d => ({ ...d, harga: Number(e.target.value) }))}
          onBlur={() => commit(draft)}
          className="w-full border border-slate-200 rounded px-1 py-1 text-sm text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus:border-indigo-400" />
      </td>
      {/* Subtotal */}
      <td className="px-2 py-1 text-right text-sm text-slate-700 w-32 whitespace-nowrap">{fmt(draft.jumlah * draft.harga)}</td>
      {/* Hapus */}
      <td className="px-2 py-1 w-10 text-center">
        <button title="Hapus" aria-label="Hapus material" onClick={() => onRemove(bom.id)} className="flex items-center justify-center w-7 h-7 rounded bg-red-50 text-red-500 hover:bg-red-100 mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const newRowIdRef = useRef<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = workOrders.filter(wo =>
      wo.id.toLowerCase().includes(q) || wo.customer.toLowerCase().includes(q) ||
      wo.merk.toLowerCase().includes(q) || wo.status.toLowerCase().includes(q) || wo.technician.toLowerCase().includes(q)
    );
    if (statusFilter === 'active') rows = rows.filter(wo => !isFinished(wo.status));
    else if (statusFilter === 'overdue') rows = rows.filter(wo => !isFinished(wo.status) && wo.estimasiSelesai !== '-' && wo.estimasiSelesai < today);
    else if (statusFilter !== 'all') rows = rows.filter(wo => wo.status === statusFilter);
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sortField] ?? '');
        const bv = String((b as unknown as Record<string, unknown>)[sortField] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }, [workOrders, search, statusFilter, sortField, sortDir, today]);

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
    { headerName: '', width: 50, sortable: false, filter: false, resizable: false, cellRenderer: (p: ICellRendererParams<ServiceItem>) => <button title="Hapus" aria-label="Hapus jasa" onClick={() => p.data?.id && useStore.getState().removeService(p.data.id)} className="flex items-center justify-center w-7 h-7 rounded bg-red-50 text-red-500 hover:bg-red-100 mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"><Trash2 className="w-3.5 h-3.5" /></button> }
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
    updateWorkOrder({
      ...selectedWO,
      estimatedCost: matCost + svcCost,
      diskon: selectedWO.diskon ?? 0,
      terminHari: selectedWO.terminHari ?? 0,
      tanggalInvoice: selectedWO.tanggalInvoice,
    });
    setSelectedWO(null);
  };

  const totalSpk = workOrders.length;
  const totalSelesai = workOrders.filter(w => isFinished(w.status)).length;
  const overdueCount = workOrders.filter(w => !isFinished(w.status) && w.estimasiSelesai !== '-' && w.estimasiSelesai < today).length;

  const thProps = { sortField, sortDir, onSort: handleSort };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-12 flex items-center pl-14 pr-4 lg:px-6 justify-between shrink-0">
        <h2 className="text-base font-semibold text-slate-800">Manajemen Pekerjaan (Work Orders)</h2>
        <div className="flex items-center gap-2">
          <Button variant="success" onClick={() => { exportWorkOrders(workOrders, finance); toast.success('Data Work Orders berhasil di-export!'); }}>
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </Button>
          <Button variant="primary" size="md" onClick={handleAddWO}>
            <Plus className="w-4 h-4" /> SPK Baru
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <StatCard label="Total SPK" value={totalSpk} hint="Semua pekerjaan" />
          <StatCard label="SPK Selesai" value={totalSelesai} hint="Finished + Picked Up" accent="emerald" />
          <StatCard
            label="SPK Jatuh Tempo" value={overdueCount}
            hint={overdueCount > 0 ? 'Klik untuk filter' : 'Semua tepat waktu'}
            accent={overdueCount > 0 ? 'red' : 'slate'}
            onClick={overdueCount > 0 ? () => setStatusFilter('overdue') : undefined}
          />
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
            <SearchInput
              value={search} onChange={setSearch}
              placeholder="Cari ID, pelanggan, merk, teknisi..." ariaLabel="Cari work order"
              className="flex-1 max-w-xs"
            />
            <div className="flex gap-2 shrink-0 items-center">
              <label htmlFor="wo-status-filter" className="sr-only">Filter status</label>
              <select
                id="wo-status-filter"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="active">Hanya Aktif</option>
                <option value="overdue">Jatuh Tempo</option>
                <optgroup label="Per Status">
                  {WO_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              </select>
              <Button variant="secondary" onClick={handleExport}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[1100px]">
              <thead className="bg-slate-50 sticky top-0" style={{ zIndex: 'var(--z-sticky)' }}>
                <tr className="border-b border-slate-200">
                  <DataHeader label="ID" field="id" w="w-32" {...thProps} />
                  <DataHeader label="Pelanggan" field="customer" {...thProps} />
                  <DataHeader label="Item / Merk" field="merk" {...thProps} />
                  <DataHeader label="Kapasitas" field="capacity" w="w-24" {...thProps} />
                  <DataHeader label="Status" field="status" w="w-28" {...thProps} />
                  <DataHeader label="Teknisi" field="technician" w="w-28" {...thProps} />
                  <DataHeader label="Tgl Masuk" field="dateIn" w="w-28" {...thProps} />
                  <DataHeader label="Est. Selesai" field="estimasiSelesai" w="w-28" {...thProps} />
                  <DataHeader label="Total Biaya" field="estimatedCost" w="w-32" {...thProps} />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Status Bayar</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-44">Aksi</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {filtered.length === 0 && (
                  <EmptyRow colSpan={11} message={
                    search || statusFilter !== 'all' ? (
                      <EmptyState
                        icon={Wrench}
                        title="Tidak ada SPK yang cocok"
                        description={search ? `Tidak ditemukan untuk "${search}".` : 'Coba ubah filter status.'}
                        action={
                          <Button variant="secondary" size="md" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                            Reset filter
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={Wrench}
                        title="Belum ada Work Order"
                        description="Buat SPK pertama untuk mulai mengelola pekerjaan."
                        action={
                          <Button variant="primary" size="md" onClick={handleAddWO}>
                            <Plus className="w-4 h-4" /> Buat SPK Pertama
                          </Button>
                        }
                      />
                    )
                  } />
                )}
                {filtered.map((wo, i) => {
                  const piutang = computeStatusBayar(wo, finance);
                  return (
                  <tr key={wo.id} data-id={wo.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">{wo.id}</td>
                    <td className="px-4 py-3 text-slate-800 min-w-[140px]"><DataCell value={wo.customer} onSave={v => update(wo, 'customer', v)} ariaLabel="Edit pelanggan" /></td>
                    <td className="px-4 py-3 text-slate-700 min-w-[120px]"><DataCell value={wo.merk} onSave={v => update(wo, 'merk', v)} ariaLabel="Edit merk" /></td>
                    <td className="px-4 py-3 text-slate-600"><DataCell value={wo.capacity} onSave={v => update(wo, 'capacity', v)} ariaLabel="Edit kapasitas" /></td>
                    <td className="px-4 py-3"><StatusCell value={wo.status} onSave={v => update(wo, 'status', v)} /></td>
                    <td className="px-4 py-3 text-slate-700"><DataCell value={wo.technician} onSave={v => update(wo, 'technician', v)} ariaLabel="Edit teknisi" /></td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap"><DataCell value={wo.dateIn} onSave={v => update(wo, 'dateIn', v)} type="date" ariaLabel="Edit tanggal masuk" /></td>
                    <td className="px-4 py-3 text-slate-600 text-xs"><DataCell value={wo.estimasiSelesai} onSave={v => update(wo, 'estimasiSelesai', v)} type="date" ariaLabel="Edit estimasi selesai" /></td>
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
                        ? <StatusBayarBadge
                            status={piutang.status}
                            sisa={piutang.sisaTagihan}
                            isOverdue={piutang.isOverdue}
                            isDueSoon={piutang.isDueSoon}
                            hariKeJatuhTempo={piutang.hariKeJatuhTempo}
                          />
                        : <span className="text-2xs italic text-slate-300">— belum ada biaya —</span>}
                    </td>
                    <td className="px-4 py-3">
                      <ActionMenu
                        ariaLabel={`Aksi untuk ${wo.id}`}
                        actions={[
                          { label: 'Cetak SPK', icon: FileText, onClick: () => window.open(`/print/spk/${wo.id}`, '_blank') },
                          { label: 'Cetak Invoice', icon: Printer, onClick: () => window.open(`/print/invoice/${wo.id}`, '_blank') },
                          { label: 'Cetak Surat Jalan', icon: Truck, onClick: () => window.open(`/print/surat-jalan/${wo.id}`, '_blank') },
                          { label: 'Hapus WO', icon: Trash2, destructive: true, separator: true, onClick: async () => {
                            const ok = await confirm({
                              title: 'Hapus Work Order?',
                              message: <>Pekerjaan <b>{wo.id}</b> ({wo.customer} — {wo.merk}) akan dihapus permanen, beserta semua data BOM, jasa, dan transaksi terkait. Tindakan ini <b>tidak bisa diurungkan</b>.</>,
                              destructive: true,
                              confirmLabel: 'Hapus WO',
                            });
                            if (ok) deleteWorkOrder(wo.id);
                          } },
                        ]}
                      />
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
        <Dialog
          open
          onClose={() => setSelectedWO(null)}
          size="xl"
          title="Detail Pekerjaan & Material"
          description={`WO: ${selectedWO.id} — ${selectedWO.merk}`}
          footer={
            <>
              <Button variant="secondary" size="md" onClick={() => setSelectedWO(null)}>Batal</Button>
              <Button variant="primary" size="md" onClick={handleSave}>Simpan & Update Biaya WO</Button>
            </>
          }
        >
          <div className="p-6 flex flex-col gap-5">
              <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg text-sm text-blue-800">
                Edit nilai di sel secara langsung. Klik <b>Simpan & Update Biaya WO</b> untuk memperbarui total biaya.
              </div>
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-slate-700">Tindakan Jasa</h4>
                  <Button variant="soft-indigo" onClick={handleAddService}><Plus className="w-4 h-4" /> Tambah Jasa</Button>
                </div>
                <AgGridReact rowData={services.filter(s => s.woId === selectedWO.id)} columnDefs={svcColDefs} defaultColDef={defaultColDef} getRowId={p => p.data.id} className="ag-theme-alpine w-full" domLayout="autoHeight" rowHeight={40} headerHeight={40} onCellValueChanged={handleSvcChanged} />
              </div>
              <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-slate-700">Penggunaan Suku Cadang (Material)</h4>
                  <Button variant="soft-emerald" onClick={handleAddBom}><Plus className="w-4 h-4" /> Tambah Material</Button>
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

              {/* Termin Pembayaran & Tanggal Invoice */}
              <div className="bg-white border border-indigo-200 rounded-lg shadow-sm p-4">
                <div className="mb-3">
                  <h4 className="font-semibold text-slate-700">Termin Pembayaran</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pilih termin pembayaran. <b>COD</b> = lunas saat barang diserahkan (auto-record pelunasan saat status Finished).
                    <b>NET</b> = pelanggan punya N hari setelah tanggal invoice untuk bayar.
                  </p>
                </div>
                <TerminSelector
                  id="wo-termin"
                  value={selectedWO.terminHari ?? 0}
                  onChange={(v) => setSelectedWO({ ...selectedWO, terminHari: v })}
                />

                {/* Tanggal Invoice — hanya tampil bila NET (terminHari > 0) */}
                {(selectedWO.terminHari ?? 0) > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-end gap-3 flex-wrap">
                    <div>
                      <label htmlFor="wo-tanggal-invoice" className="text-xs text-slate-500 font-medium block mb-1">Tanggal Terbit Invoice</label>
                      <input
                        id="wo-tanggal-invoice"
                        type="date"
                        value={selectedWO.tanggalInvoice ?? ''}
                        onChange={e => setSelectedWO({ ...selectedWO, tanggalInvoice: e.target.value || undefined })}
                        className="px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 bg-white"
                      />
                      <p className="text-tiny text-slate-400 mt-1">
                        {selectedWO.tanggalInvoice
                          ? 'Bisa di-override manual.'
                          : 'Akan auto-set saat status pertama kali Finished.'}
                      </p>
                    </div>
                    {selectedWO.tanggalInvoice && (
                      <div className="flex-1 min-w-[200px] bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                        <p className="text-tiny text-indigo-600 font-semibold uppercase tracking-wider">Jatuh Tempo</p>
                        <p className="text-sm font-bold text-indigo-800">
                          {(() => {
                            const jt = getJatuhTempo(selectedWO);
                            return jt ? fmtTanggal(jt) : '—';
                          })()}
                        </p>
                        <p className="text-tiny text-indigo-600 mt-0.5">
                          NET {selectedWO.terminHari} hari dari tanggal invoice
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Diskon */}
              <div className="bg-white border border-amber-200 rounded-lg shadow-sm p-4">
                <div className="mb-3">
                  <h4 className="font-semibold text-slate-700">Diskon</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Edit nominal (Rp) <b>atau</b> persentase (%) — yang lain ikut otomatis.</p>
                </div>
                <div className="flex items-end gap-2">
                  {/* Input Nominal Rp */}
                  <div className="flex-1">
                    <label htmlFor="diskon-nominal" className="text-xs text-slate-500 font-medium block mb-1">Nominal (Rp)</label>
                    <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400">
                      <span className="px-2.5 py-1.5 bg-slate-50 text-xs text-slate-500 border-r border-slate-300 font-medium">Rp</span>
                      <input
                        id="diskon-nominal"
                        type="number"
                        min="0"
                        value={selectedWO.diskon ?? 0}
                        onChange={e => setSelectedWO({ ...selectedWO, diskon: Math.max(0, Number(e.target.value)) })}
                        className="flex-1 px-3 py-1.5 text-sm text-right focus:outline-none min-w-0"
                      />
                    </div>
                  </div>
                  <div className="text-amber-500 text-base font-bold pb-2 select-none" aria-hidden="true">⇄</div>
                  {/* Input Persentase */}
                  <div className="w-28">
                    <label htmlFor="diskon-pct" className="text-xs text-slate-500 font-medium block mb-1">Persentase (%)</label>
                    <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-amber-400">
                      <input
                        id="diskon-pct"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={
                          selectedWO.estimatedCost > 0
                            ? +((((selectedWO.diskon ?? 0) / selectedWO.estimatedCost) * 100).toFixed(2))
                            : 0
                        }
                        onChange={e => {
                          const pct = Math.min(100, Math.max(0, Number(e.target.value)));
                          setSelectedWO({ ...selectedWO, diskon: Math.round(selectedWO.estimatedCost * pct / 100) });
                        }}
                        className="flex-1 px-3 py-1.5 text-sm text-right focus:outline-none min-w-0 w-full"
                      />
                      <span className="px-2.5 py-1.5 bg-slate-50 text-xs text-slate-500 border-l border-slate-300 font-medium">%</span>
                    </div>
                  </div>
                </div>
                {/* Summary setelah diskon */}
                {(selectedWO.diskon ?? 0) > 0 && selectedWO.estimatedCost > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <span className="text-slate-500">Tagihan akhir:</span>
                    <span className="line-through text-slate-400">Rp {fmt(selectedWO.estimatedCost)}</span>
                    <span className="text-amber-500">→</span>
                    <span className="font-bold text-slate-800">Rp {fmt(Math.max(selectedWO.estimatedCost - (selectedWO.diskon ?? 0), 0))}</span>
                    <span className="ml-auto text-amber-700 font-semibold">
                      hemat {(((selectedWO.diskon ?? 0) / selectedWO.estimatedCost) * 100).toFixed(1)}% · Rp {fmt(selectedWO.diskon ?? 0)}
                    </span>
                  </div>
                )}
              </div>

          </div>
        </Dialog>
      )}

    </div>
  );
}
