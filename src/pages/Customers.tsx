import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Search, Download, Filter, FileSpreadsheet } from 'lucide-react';
import { useStore, type Customer } from '../store/useStore';

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

function EditableCell({ value, onSave }: { value: string | number; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));
  return editing ? (
    <input aria-label="Edit" title="Edit" autoFocus
      className="w-full border border-indigo-400 rounded px-1.5 py-0.5 text-sm focus:outline-none"
      value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { onSave(val); setEditing(false); }}
      onKeyDown={e => { if (e.key === 'Enter') { onSave(val); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
  ) : (
    <span className="cursor-pointer hover:text-indigo-600" onDoubleClick={() => { setVal(String(value)); setEditing(true); }}>
      {value || <span className="text-slate-300">—</span>}
    </span>
  );
}

export default function Customers() {
  const customers = useStore(s => s.customers);
  const addCustomer = useStore(s => s.addCustomer);
  const updateCustomer = useStore(s => s.updateCustomer);
  const deleteCustomer = useStore(s => s.deleteCustomer);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = customers.filter(c =>
      c.id.toLowerCase().includes(q) || c.nama.toLowerCase().includes(q) ||
      c.perusahaan.toLowerCase().includes(q) || c.telepon.includes(q) || c.alamat.toLowerCase().includes(q)
    );
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sortField] ?? '');
        const bv = String((b as unknown as Record<string, unknown>)[sortField] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true });
      });
    }
    return rows;
  }, [customers, search, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const update = (c: Customer, field: keyof Customer, value: string) =>
    updateCustomer({ ...c, [field]: field === 'totalWo' ? Number(value) : value });

  const handleAdd = () => {
    let max = 0;
    customers.forEach(c => { const n = parseInt(c.id.split('-').at(-1)!, 10); if (!isNaN(n) && n > max) max = n; });
    const newId = `CUS-${String(max + 1).padStart(3, '0')}`;
    addCustomer({ id: newId, nama: 'Pelanggan Baru', perusahaan: '-', telepon: '-', alamat: '-', totalWo: 0 });
    setTimeout(() => {
      tableBodyRef.current?.querySelector(`[data-id="${newId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleExport = () => {
    const header = 'ID,Nama,Perusahaan,Telepon,Alamat,Total WO';
    const rows = customers.map(c => `${c.id},${c.nama},${c.perusahaan},${c.telepon},${c.alamat},${c.totalWo}`);
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Pelanggan.csv'; a.click();
  };

  const totalPelanggan = customers.length;
  const pelangganAktif = customers.filter(c => c.totalWo > 0).length;
  const totalSpk = customers.reduce((acc, c) => acc + c.totalWo, 0);

  const thProps = { sortField, sortDir, onSort: handleSort };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white border-b border-slate-200 h-12 flex items-center px-6 justify-between shrink-0">
        <h2 className="text-base font-semibold text-slate-800">Data Pelanggan (Customers)</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
          <button onClick={handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium text-sm shadow-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Pelanggan Baru
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Pelanggan</p>
            <h3 className="text-lg font-bold text-slate-800">{totalPelanggan} <span className="text-xs font-normal text-slate-500">Orang/PT</span></h3>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-emerald-500 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pelanggan Aktif</p>
            <h3 className="text-lg font-bold text-emerald-600">{pelangganAktif} <span className="text-xs font-normal text-slate-500">Bertransaksi</span></h3>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm border-l-4 border-l-indigo-500 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total SPK Dipesan</p>
            <h3 className="text-lg font-bold text-indigo-600">{totalSpk} <span className="text-xs font-normal text-slate-500">Pekerjaan</span></h3>
          </div>
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Cari pelanggan..." aria-label="Cari pelanggan" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 placeholder:text-slate-400" />
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><Filter className="w-4 h-4" /> Filter</button>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><Download className="w-4 h-4" /> Export CSV</button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <ThCell label="ID" field="id" w="w-24" {...thProps} />
                  <ThCell label="Nama Pelanggan" field="nama" {...thProps} />
                  <ThCell label="Perusahaan" field="perusahaan" {...thProps} />
                  <ThCell label="No. Telepon" field="telepon" w="w-36" {...thProps} />
                  <ThCell label="Alamat" field="alamat" {...thProps} />
                  <ThCell label="Total WO" field="totalWo" w="w-24" {...thProps} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Aksi</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                    {search ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm">Belum ada data pelanggan.</p>
                        <button onClick={handleAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                          <Plus className="w-4 h-4" /> Tambah Pelanggan Pertama
                        </button>
                      </div>
                    )}
                  </td></tr>
                )}
                {filtered.map((c, i) => (
                  <tr key={c.id} data-id={c.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-600">{c.id}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium min-w-[140px]"><EditableCell value={c.nama} onSave={v => update(c, 'nama', v)} /></td>
                    <td className="px-4 py-3 text-slate-700 min-w-[130px]"><EditableCell value={c.perusahaan} onSave={v => update(c, 'perusahaan', v)} /></td>
                    <td className="px-4 py-3 text-slate-600"><EditableCell value={c.telepon} onSave={v => update(c, 'telepon', v)} /></td>
                    <td className="px-4 py-3 text-slate-600 min-w-[180px]"><EditableCell value={c.alamat} onSave={v => update(c, 'alamat', v)} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">{c.totalWo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => { if (window.confirm(`Hapus pelanggan "${c.nama}"?`)) deleteCustomer(c.id); }}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-100">
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 shrink-0">
            <span className="text-xs text-slate-400">Menampilkan {filtered.length} dari {customers.length} pelanggan</span>
          </div>
        </div>
      </main>
    </div>
  );
}
