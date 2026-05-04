import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Search, Download, Filter, FileSpreadsheet } from 'lucide-react';
import { useStore, type InventoryItem } from '../store/useStore';
import { exportInventory } from '../lib/exportExcel';
import { toast } from '../lib/toast';
import { Button, DataHeader, DataCell, EmptyRow, type SortDir } from '../components/ui';
import { confirm } from '../lib/confirm';

export default function Inventory() {
  const inventory     = useStore(s => s.inventory);
  const addInventory  = useStore(s => s.addInventory);
  const updateInventory = useStore(s => s.updateInventory);
  const deleteInventory = useStore(s => s.deleteInventory);

  const [search, setSearch]     = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<SortDir>('asc');
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = inventory.filter(i =>
      i.id.toLowerCase().includes(q) || i.nama.toLowerCase().includes(q) || i.satuan.toLowerCase().includes(q)
    );
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sortField] ?? '');
        const bv = String((b as unknown as Record<string, unknown>)[sortField] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true });
      });
    }
    return rows;
  }, [inventory, search, sortField, sortDir]);

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

  const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
  const lowStockCount = inventory.filter(i => i.stok < i.batasMinimum).length;
  const totalNilaiAset = inventory.reduce((acc, i) => acc + i.stok * i.hargaBeli, 0);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-12 flex items-center px-6 justify-between shrink-0">
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
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Suku Cadang</p>
            <h3 className="text-lg font-bold text-slate-800">{inventory.length} <span className="text-xs font-normal text-slate-500">Jenis</span></h3>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-indigo-500 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Nilai Aset</p>
            <h3 className="text-lg font-bold text-indigo-600">Rp {fmt(totalNilaiAset)}</h3>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-red-400 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Stok Menipis</p>
            <h3 className={`text-lg font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{lowStockCount} <span className="text-xs font-normal text-slate-500">Item</span></h3>
          </div>
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cari barang..." aria-label="Cari barang" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 bg-slate-50 placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">Baris <b>merah</b> = stok di bawah minimum</span>
              <Button variant="secondary"><Filter className="w-4 h-4" /> Filter</Button>
              <Button variant="secondary" onClick={handleExport}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
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
                    search ? 'Tidak ada item yang cocok dengan pencarian.' : (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm">Belum ada data inventaris.</p>
                        <Button variant="primary" size="md" onClick={handleAdd}>
                          <Plus className="w-4 h-4" /> Tambah Barang Pertama
                        </Button>
                      </div>
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
