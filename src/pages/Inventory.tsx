import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Search, Download, Filter, FileSpreadsheet } from 'lucide-react';
import { useStore, type InventoryItem } from '../store/useStore';
import { exportInventory } from '../lib/exportExcel';
import { toast } from '../lib/toast';

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

function EditableCell({ value, onSave, numeric }: { value: string | number; onSave: (v: string) => void; numeric?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  const display = numeric ? new Intl.NumberFormat('id-ID').format(Number(value)) : String(value);
  return editing ? (
    <input
      autoFocus type={numeric ? 'number' : 'text'}
      title="Edit nilai" aria-label="Edit nilai"
      className="w-full border border-indigo-400 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onSave(val); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(val); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
    />
  ) : (
    <span className="cursor-pointer hover:text-indigo-600 transition-colors" onDoubleClick={() => { setVal(String(value)); setEditing(true); }}>
      {display || <span className="text-slate-300">—</span>}
    </span>
  );
}

export default function Inventory() {
  const inventory     = useStore(s => s.inventory);
  const addInventory  = useStore(s => s.addInventory);
  const updateInventory = useStore(s => s.updateInventory);
  const deleteInventory = useStore(s => s.deleteInventory);

  const [search, setSearch]     = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc');
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
          <button
            onClick={() => { exportInventory(inventory); toast.success('Data Inventory berhasil di-export!'); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Barang Baru
          </button>
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
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-slate-50 placeholder:text-slate-400" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-lg">Baris <b>merah</b> = stok di bawah minimum</span>
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                <Filter className="w-4 h-4" /> Filter
              </button>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[900px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <ThCell label="ID Barang" field="id" w="w-28" {...thProps} />
                  <ThCell label="Nama Barang" field="nama" {...thProps} />
                  <ThCell label="Stok Saat Ini" field="stok" w="w-28" {...thProps} />
                  <ThCell label="Satuan" field="satuan" w="w-24" {...thProps} />
                  <ThCell label="Batas Min." field="batasMinimum" w="w-24" {...thProps} />
                  <ThCell label="Harga Beli (Rp)" field="hargaBeli" w="w-36" {...thProps} />
                  <ThCell label="Harga Jual (Rp)" field="hargaJual" w="w-36" {...thProps} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Aksi</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400">
                    {search ? 'Tidak ada item yang cocok dengan pencarian.' : (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm">Belum ada data inventaris.</p>
                        <button onClick={handleAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                          <Plus className="w-4 h-4" /> Tambah Barang Pertama
                        </button>
                      </div>
                    )}
                  </td></tr>
                )}
                {filtered.map((item, i) => {
                  const lowStock = item.stok < item.batasMinimum;
                  return (
                    <tr key={item.id} data-id={item.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${i%2===1?'bg-slate-50/50':''}`}>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">{item.id}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium min-w-[160px]">
                        <EditableCell value={item.nama} onSave={v => update(item, 'nama', v)} />
                      </td>
                      <td className={`px-4 py-3 font-semibold ${lowStock ? 'text-red-600' : 'text-slate-700'}`}>
                        <EditableCell value={item.stok} onSave={v => update(item, 'stok', v)} numeric />
                        {lowStock && <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">⚠ Menipis</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <EditableCell value={item.satuan} onSave={v => update(item, 'satuan', v)} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <EditableCell value={item.batasMinimum} onSave={v => update(item, 'batasMinimum', v)} numeric />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <EditableCell value={item.hargaBeli} onSave={v => update(item, 'hargaBeli', v)} numeric />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <EditableCell value={item.hargaJual} onSave={v => update(item, 'hargaJual', v)} numeric />
                      </td>
                      <td className="px-4 py-3">
                        <button title="Hapus barang"
                          onClick={() => { if (window.confirm(`Hapus "${item.nama}" dari stok?`)) deleteInventory(item.id); }}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-100 transition-colors">
                          <Trash2 className="w-3 h-3" /> Hapus
                        </button>
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
