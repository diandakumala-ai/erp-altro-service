import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Download, Package, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { useStore, type InventoryItem } from '../store/useStore';
import { exportInventory } from '../lib/exportExcel';
import { toast } from '../lib/toast';
import { Button, DataHeader, DataCell, EmptyRow, EmptyState, StatCard, SearchInput, type SortDir } from '../components/ui';
import { confirm } from '../lib/confirm';
import { fmt } from '../lib/format';

type StockFilter = 'all' | 'low' | 'out';

export default function Inventory() {
  const inventory     = useStore(s => s.inventory);
  const addInventory  = useStore(s => s.addInventory);
  const updateInventory = useStore(s => s.updateInventory);
  const deleteInventory = useStore(s => s.deleteInventory);

  const [search, setSearch]     = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<SortDir>('asc');
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = inventory.filter(i =>
      i.id.toLowerCase().includes(q) || i.nama.toLowerCase().includes(q) || i.satuan.toLowerCase().includes(q)
    );
    if (stockFilter === 'low') rows = rows.filter(i => i.stok < i.batasMinimum);
    else if (stockFilter === 'out') rows = rows.filter(i => i.stok === 0);
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sortField] ?? '');
        const bv = String((b as unknown as Record<string, unknown>)[sortField] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true });
      });
    }
    return rows;
  }, [inventory, search, stockFilter, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const thProps = { sortField, sortDir, onSort: handleSort };

  const update = (item: InventoryItem, field: keyof InventoryItem, value: string) => {
    const numeric: (keyof InventoryItem)[] = ['stok', 'batasMinimum', 'hargaBeli', 'hargaJual'];
    updateInventory({ ...item, [field]: numeric.includes(field) ? Number(value) : value });
  };

  const handleAdd = () => {
    let max = 0;
    inventory.forEach(i => { const n = parseInt(i.id.split('-').at(-1)!, 10); if (!isNaN(n) && n > max) max = n; });
    const newId = `SKU-${String(max + 1).padStart(3, '0')}`;
    addInventory({ id: newId, nama: 'Barang Baru', stok: 0, satuan: 'Pcs', batasMinimum: 5, hargaBeli: 0, hargaJual: 0 });
    setTimeout(() => {
      tableBodyRef.current?.querySelector(`[data-id="${newId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleExport = () => {
    const header = 'ID,Nama,Stok,Satuan,Batas Min,Harga Beli,Harga Jual';
    const rows = inventory.map(i => `${i.id},${i.nama},${i.stok},${i.satuan},${i.batasMinimum},${i.hargaBeli},${i.hargaJual}`);
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Inventory.csv'; a.click();
  };

  const lowStockCount = inventory.filter(i => i.stok < i.batasMinimum).length;
  const totalNilaiAset = inventory.reduce((acc, i) => acc + i.stok * i.hargaBeli, 0);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-12 flex items-center pl-14 pr-4 lg:px-6 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-800">Manajemen Stok (Inventory)</h2>
          {lowStockCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">{lowStockCount} Stok Menipis</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="success" onClick={() => { exportInventory(inventory); toast.success('Data Inventory berhasil di-export!'); }}>
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            <Plus className="w-4 h-4" /> Barang Baru
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <StatCard label="Total Suku Cadang" value={inventory.length} hint="Jenis barang" />
          <StatCard label="Total Nilai Aset" value={`Rp ${fmt(totalNilaiAset)}`} hint="Stok × harga beli" accent="indigo" />
          <StatCard
            label="Stok Menipis" value={lowStockCount}
            hint={lowStockCount > 0 ? 'Klik untuk filter' : 'Semua aman'}
            accent={lowStockCount > 0 ? 'red' : 'slate'}
            onClick={lowStockCount > 0 ? () => setStockFilter('low') : undefined}
          />
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
            <SearchInput
              value={search} onChange={setSearch}
              placeholder="Cari ID, nama, satuan..." ariaLabel="Cari barang"
              className="flex-1 max-w-xs"
            />
            <div className="flex items-center gap-2 shrink-0">
              <fieldset className="flex bg-slate-100 p-0.5 rounded-lg">
                <legend className="sr-only">Filter stok</legend>
                {([
                  { v: 'all', label: 'Semua' },
                  { v: 'low', label: 'Stok menipis' },
                  { v: 'out', label: 'Habis' },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setStockFilter(opt.v)}
                    aria-pressed={stockFilter === opt.v}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                      stockFilter === opt.v
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </fieldset>
              <Button variant="secondary" onClick={handleExport}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead className="bg-slate-50 sticky top-0" style={{ zIndex: 'var(--z-sticky)' }}>
                <tr className="border-b border-slate-200">
                  <DataHeader label="ID Barang" field="id" w="w-28" {...thProps} />
                  <DataHeader label="Nama Barang" field="nama" {...thProps} />
                  <DataHeader label="Stok Saat Ini" field="stok" w="w-28" {...thProps} />
                  <DataHeader label="Satuan" field="satuan" w="w-24" {...thProps} />
                  <DataHeader label="Batas Min." field="batasMinimum" w="w-24" {...thProps} />
                  <DataHeader label="Harga Beli (Rp)" field="hargaBeli" w="w-36" {...thProps} />
                  <DataHeader label="Harga Jual (Rp)" field="hargaJual" w="w-36" {...thProps} />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Aksi</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {filtered.length === 0 && (
                  <EmptyRow colSpan={8} message={
                    search || stockFilter !== 'all' ? (
                      <EmptyState
                        icon={stockFilter === 'low' || stockFilter === 'out' ? AlertTriangle : Package}
                        title="Tidak ada item yang cocok"
                        description={search ? `Tidak ditemukan untuk "${search}".` : (stockFilter === 'low' ? 'Semua item di atas batas minimum.' : 'Tidak ada barang yang habis.')}
                        action={
                          <Button variant="secondary" size="md" onClick={() => { setSearch(''); setStockFilter('all'); }}>
                            Reset filter
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={Package}
                        title="Belum ada data inventaris"
                        description="Tambahkan suku cadang pertama untuk mulai mencatat stok."
                        action={
                          <Button variant="primary" size="md" onClick={handleAdd}>
                            <Plus className="w-4 h-4" /> Tambah Barang Pertama
                          </Button>
                        }
                      />
                    )
                  } />
                )}
                {filtered.map((item, i) => {
                  const lowStock = item.stok < item.batasMinimum;
                  return (
                    <tr key={item.id} data-id={item.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${i%2===1?'bg-slate-50/50':''}`}>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{item.id}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium min-w-[160px]">
                        <DataCell value={item.nama} onSave={v => update(item, 'nama', v)} ariaLabel="Edit nama barang" />
                      </td>
                      <td className={`px-4 py-3 font-semibold ${lowStock ? 'text-red-600' : 'text-slate-700'}`}>
                        <DataCell value={item.stok} onSave={v => update(item, 'stok', v)} type="number" numericFormat ariaLabel="Edit stok" />
                        {lowStock && <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">⚠ Menipis</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <DataCell value={item.satuan} onSave={v => update(item, 'satuan', v)} ariaLabel="Edit satuan" />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <DataCell value={item.batasMinimum} onSave={v => update(item, 'batasMinimum', v)} type="number" numericFormat ariaLabel="Edit batas minimum" />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <DataCell value={item.hargaBeli} onSave={v => update(item, 'hargaBeli', v)} type="number" numericFormat ariaLabel="Edit harga beli" />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <DataCell value={item.hargaJual} onSave={v => update(item, 'hargaJual', v)} type="number" numericFormat ariaLabel="Edit harga jual" />
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="soft-danger" size="sm" title="Hapus barang"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Hapus barang?',
                              message: <>Item <b>{item.nama}</b> ({item.id}) akan dihapus dari stok permanen. {item.stok > 0 && <>Sisa stok <b>{item.stok} {item.satuan}</b> akan hilang dari catatan.</>}</>,
                              destructive: true,
                              confirmLabel: 'Hapus barang',
                            });
                            if (ok) deleteInventory(item.id);
                          }}>
                          <Trash2 className="w-3 h-3" /> Hapus
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 shrink-0">
            <span className="text-xs text-slate-400">Menampilkan {filtered.length} dari {inventory.length} item</span>
          </div>
        </div>
      </main>
    </div>
  );
}
