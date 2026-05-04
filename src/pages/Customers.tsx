import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, Download, Users, FileSpreadsheet } from 'lucide-react';
import { useStore, type Customer } from '../store/useStore';
import { Button, DataHeader, DataCell, EmptyRow, EmptyState, StatCard, SearchInput, type SortDir } from '../components/ui';
import { confirm } from '../lib/confirm';

type FilterMode = 'all' | 'active' | 'inactive';

export default function Customers() {
  const customers = useStore(s => s.customers);
  const addCustomer = useStore(s => s.addCustomer);
  const updateCustomer = useStore(s => s.updateCustomer);
  const deleteCustomer = useStore(s => s.deleteCustomer);

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let rows = customers.filter(c =>
      c.id.toLowerCase().includes(q) || c.nama.toLowerCase().includes(q) ||
      c.perusahaan.toLowerCase().includes(q) || c.telepon.includes(q) || c.alamat.toLowerCase().includes(q)
    );
    if (filterMode === 'active') rows = rows.filter(c => c.totalWo > 0);
    else if (filterMode === 'inactive') rows = rows.filter(c => c.totalWo === 0);
    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const av = String((a as unknown as Record<string, unknown>)[sortField] ?? '');
        const bv = String((b as unknown as Record<string, unknown>)[sortField] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv, undefined, { numeric: true }) : bv.localeCompare(av, undefined, { numeric: true });
      });
    }
    return rows;
  }, [customers, search, filterMode, sortField, sortDir]);

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
      <header className="bg-white border-b border-slate-200 h-12 flex items-center pl-14 pr-4 lg:px-6 justify-between shrink-0">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          <StatCard label="Total Pelanggan" value={totalPelanggan} hint="Orang/PT terdaftar" />
          <StatCard label="Pelanggan Aktif" value={pelangganAktif} hint="Pernah bertransaksi" accent="emerald" />
          <StatCard label="Total SPK Dipesan" value={totalSpk} hint="Akumulasi pekerjaan" accent="indigo" />
        </div>

        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0 gap-3 flex-wrap">
            <SearchInput
              value={search} onChange={setSearch}
              placeholder="Cari ID, nama, perusahaan, telepon..."
              ariaLabel="Cari pelanggan"
              className="flex-1 max-w-xs"
            />
            <div className="flex gap-2 shrink-0 items-center">
              <fieldset className="flex bg-slate-100 p-0.5 rounded-lg">
                <legend className="sr-only">Filter aktivitas pelanggan</legend>
                {([
                  { v: 'all', label: 'Semua' },
                  { v: 'active', label: 'Aktif' },
                  { v: 'inactive', label: 'Belum aktif' },
                ] as const).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setFilterMode(opt.v)}
                    aria-pressed={filterMode === opt.v}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                      filterMode === opt.v
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

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead className="bg-slate-50 sticky top-0" style={{ zIndex: 'var(--z-sticky)' }}>
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
                    search || filterMode !== 'all' ? (
                      <EmptyState
                        icon={Users}
                        title="Tidak ada pelanggan yang cocok"
                        description={search ? `Tidak ditemukan untuk pencarian "${search}".` : 'Coba ubah filter aktivitas.'}
                        action={
                          <Button variant="secondary" size="md" onClick={() => { setSearch(''); setFilterMode('all'); }}>
                            Reset filter
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={Users}
                        title="Belum ada pelanggan terdaftar"
                        description="Tambahkan pelanggan pertama untuk mulai mencatat Work Order."
                        action={
                          <Button variant="primary" size="md" onClick={handleAdd}>
                            <Plus className="w-4 h-4" /> Tambah Pelanggan Pertama
                          </Button>
                        }
                      />
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
                      <Button variant="soft-danger" size="sm" onClick={async () => {
                        const ok = await confirm({
                          title: 'Hapus pelanggan?',
                          message: <>Pelanggan <b>{c.nama}</b>{c.perusahaan && c.perusahaan !== '-' ? <> ({c.perusahaan})</> : null} akan dihapus permanen. {c.totalWo > 0 && <>Pelanggan ini memiliki <b>{c.totalWo} WO</b> tercatat.</>} Tindakan ini tidak bisa diurungkan.</>,
                          destructive: true,
                          confirmLabel: 'Hapus pelanggan',
                        });
                        if (ok) deleteCustomer(c.id);
                      }}>
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
