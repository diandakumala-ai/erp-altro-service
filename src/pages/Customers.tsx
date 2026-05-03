import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Search, Download, Filter, FileSpreadsheet } from 'lucide-react';
import { useStore, type Customer } from '../store/useStore';
import { Button, DataHeader, DataCell, EmptyRow, type SortDir } from '../components/ui';

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
          <Button variant="success" onClick={handleExport}>
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </Button>
          <Button variant="primary" onClick={handleAdd}>
            <Plus className="w-4 h-4" /> Pelanggan Baru
          </Button>
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
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 bg-slate-50 placeholder:text-slate-400" />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="secondary"><Filter className="w-4 h-4" /> Filter</Button>
              <Button variant="secondary" onClick={handleExport}><Download className="w-4 h-4" /> Export CSV</Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="border-b border-slate-200">
                  <DataHeader label="ID" field="id" w="w-24" {...thProps} />
                  <DataHeader label="Nama Pelanggan" field="nama" {...thProps} />
                  <DataHeader label="Perusahaan" field="perusahaan" {...thProps} />
                  <DataHeader label="No. Telepon" field="telepon" w="w-36" {...thProps} />
                  <DataHeader label="Alamat" field="alamat" {...thProps} />
                  <DataHeader label="Total WO" field="totalWo" w="w-24" {...thProps} />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Aksi</th>
                </tr>
              </thead>
              <tbody ref={tableBodyRef}>
                {filtered.length === 0 && (
                  <EmptyRow colSpan={7} message={
                    search ? 'Tidak ada pelanggan yang cocok dengan pencarian.' : (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm">Belum ada data pelanggan.</p>
                        <Button variant="primary" size="md" onClick={handleAdd}>
                          <Plus className="w-4 h-4" /> Tambah Pelanggan Pertama
                        </Button>
                      </div>
                    )
                  } />
                )}
                {filtered.map((c, i) => (
                  <tr key={c.id} data-id={c.id} className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-600">{c.id}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium min-w-[140px]"><DataCell value={c.nama} onSave={v => update(c, 'nama', v)} ariaLabel="Edit nama pelanggan" /></td>
                    <td className="px-4 py-3 text-slate-700 min-w-[130px]"><DataCell value={c.perusahaan} onSave={v => update(c, 'perusahaan', v)} ariaLabel="Edit perusahaan" /></td>
                    <td className="px-4 py-3 text-slate-600"><DataCell value={c.telepon} onSave={v => update(c, 'telepon', v)} ariaLabel="Edit telepon" /></td>
                    <td className="px-4 py-3 text-slate-600 min-w-[180px]"><DataCell value={c.alamat} onSave={v => update(c, 'alamat', v)} ariaLabel="Edit alamat" /></td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">{c.totalWo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="soft-danger" size="sm" onClick={() => { if (window.confirm(`Hapus pelanggan "${c.nama}"?`)) deleteCustomer(c.id); }}>
                        <Trash2 className="w-3 h-3" /> Hapus
                      </Button>
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
