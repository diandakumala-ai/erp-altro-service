import { useParams } from 'react-router-dom';
import { useStore, computeStatusBayar } from '../store/useStore';

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);

const VALID_TYPES = ['invoice', 'spk', 'surat-jalan', 'laporan-keuangan'] as const;
const VALID_ID = /^[A-Za-z0-9_-]{1,32}$/;
const VALID_PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export default function PrintTemplates() {
  const { type, id } = useParams();

  const workOrders = useStore(s => s.workOrders);
  const boms = useStore(s => s.boms);
  const services = useStore(s => s.services);
  const finance = useStore(s => s.finance);
  const bs = useStore(s => s.bengkelSettings);

  // Whitelist tipe & format ID — cegah path/query manipulation
  if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
    return (
      <div className="p-10 text-center">
        <h2>Tipe cetak tidak valid.</h2>
        <button onClick={() => window.close()} className="mt-4 text-indigo-600 underline">Tutup tab ini</button>
      </div>
    );
  }
  if (id && !VALID_ID.test(id)) {
    return (
      <div className="p-10 text-center">
        <h2>ID tidak valid.</h2>
        <button onClick={() => window.close()} className="mt-4 text-indigo-600 underline">Tutup tab ini</button>
      </div>
    );
  }

  const wo = workOrders.find(w => w.id === id);
  const woBoms = boms.filter(b => b.woId === id);
  const woServices = services.filter(s => s.woId === id);

  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const totalMaterial = woBoms.reduce((acc, curr) => acc + (curr.jumlah * curr.harga), 0);
  const totalJasa = woServices.reduce((acc, curr) => acc + curr.biaya, 0);
  const subtotal = totalMaterial + totalJasa;

  // ─── LAPORAN KEUANGAN ──────────────────────────────────────────────────────
  if (type === 'laporan-keuangan') {
    const params = new URLSearchParams(window.location.search);
    const periodRaw = params.get('period') || '';
    // Hanya terima format YYYY-MM (01..12). Selain itu fallback ke "semua periode".
    const period = VALID_PERIOD.test(periodRaw) ? periodRaw : '';

    const trxFiltered = period
      ? finance.filter(t => t.tanggal.startsWith(period))
      : finance;
    const trxSorted = [...trxFiltered].sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    const totalPemasukan = trxFiltered.filter(r => r.nominal > 0).reduce((a, r) => a + r.nominal, 0);
    const totalPengeluaran = Math.abs(trxFiltered.filter(r => r.nominal < 0).reduce((a, r) => a + r.nominal, 0));
    const labaBersih = totalPemasukan - totalPengeluaran;

    const periodLabel = period
      ? (() => {
          const [y, m] = period.split('-');
          return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        })()
      : 'Semua Periode';

    const subsPemasukan = ['Pembayaran Servis', 'DP', 'Lain-lain'].map(sub => ({
      sub, total: trxFiltered.filter(t => t.nominal > 0 && t.subKategori === sub).reduce((a, b) => a + b.nominal, 0),
    })).concat([{ sub: 'Lainnya (tanpa kategori)', total: trxFiltered.filter(t => t.nominal > 0 && !t.subKategori).reduce((a, b) => a + b.nominal, 0) }])
      .filter(s => s.total > 0);

    const subsPengeluaran = ['Material/Suku Cadang', 'Listrik & Operasional', 'Gaji Teknisi', 'Lain-lain'].map(sub => ({
      sub, total: Math.abs(trxFiltered.filter(t => t.nominal < 0 && t.subKategori === sub).reduce((a, b) => a + b.nominal, 0)),
    })).concat([{ sub: 'Lainnya (tanpa kategori)', total: Math.abs(trxFiltered.filter(t => t.nominal < 0 && !t.subKategori).reduce((a, b) => a + b.nominal, 0)) }])
      .filter(s => s.total > 0);

    const piutangList = workOrders
      .filter(wo => wo.estimatedCost > 0)
      .map(wo => ({ wo, info: computeStatusBayar(wo, finance) }))
      .filter(({ info }) => info.status !== 'Lunas');
    const totalPiutang = piutangList.reduce((a, { info }) => a + info.sisaTagihan, 0);

    return (
      <div className="min-h-screen bg-slate-200 print:bg-white text-slate-800">
        <style>{`
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { background: white !important; margin: 0; padding: 0; }
            @page { size: A4 portrait; margin: 1.5cm; }
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
          }
        `}</style>

        <div className="no-print sticky top-0 bg-slate-900 text-white px-6 py-3 flex justify-between items-center z-50 shadow-lg">
          <div>
            <h2 className="font-bold text-base">Preview Laporan Keuangan</h2>
            <p className="text-xs text-slate-400">Periode: {periodLabel} · Gunakan kertas A4, orientasi Potrait</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.close()} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium">Tutup</button>
            <button onClick={() => window.print()} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-bold flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              🖨️ Cetak / Simpan PDF
            </button>
          </div>
        </div>

        <div className="bg-white mx-auto my-8 px-12 py-10 shadow-2xl print:shadow-none print:my-0 print:px-0 print:py-0 w-[210mm] min-h-[297mm] font-sans">
          <div className="flex justify-between items-center border-b-2 border-slate-800 pb-5 mb-6">
            <div className="flex items-center gap-4">
              <img src={bs.logoUrl || '/primary-logo.png'} alt="Logo" className="w-14 h-14 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <div>
                <h1 className="text-xl font-black text-slate-900 leading-tight">{bs.namaBengkel}</h1>
                <p className="text-xs text-slate-500 mt-0.5">{bs.alamat}{bs.kota ? `, ${bs.kota}` : ''}</p>
                <p className="text-xs text-slate-500">{bs.telepon && `Telp: ${bs.telepon}`}{bs.telepon && bs.hp && ' | '}{bs.hp && `HP: ${bs.hp}`}</p>
                {bs.npwp && <p className="text-xs text-slate-500">NPWP: {bs.npwp}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Laporan Laba Rugi</h2>
              <p className="text-sm font-semibold text-indigo-700">{periodLabel}</p>
              <p className="text-xs text-slate-400 mt-1">Dicetak: {today}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-7">
            <div className="border-2 border-emerald-200 bg-emerald-50 rounded-lg p-4 text-center">
              <p className="text-2xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Pemasukan</p>
              <p className="text-xl font-black text-emerald-800">Rp {fmt(totalPemasukan)}</p>
            </div>
            <div className="border-2 border-red-200 bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xs font-bold text-red-600 uppercase tracking-widest mb-1">Total Pengeluaran</p>
              <p className="text-xl font-black text-red-800">Rp {fmt(totalPengeluaran)}</p>
            </div>
            <div className={`border-2 rounded-lg p-4 text-center ${labaBersih >= 0 ? 'border-indigo-200 bg-indigo-50' : 'border-orange-200 bg-orange-50'}`}>
              <p className={`text-2xs font-bold uppercase tracking-widest mb-1 ${labaBersih >= 0 ? 'text-indigo-600' : 'text-orange-600'}`}>{labaBersih >= 0 ? 'Laba Bersih' : 'Rugi Bersih'}</p>
              <p className={`text-xl font-black ${labaBersih >= 0 ? 'text-indigo-900' : 'text-orange-800'}`}>Rp {fmt(Math.abs(labaBersih))}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-7">
            <div>
              <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Rincian Pemasukan
              </h3>
              <table className="w-full text-xs"><tbody>
                {subsPemasukan.map(({ sub, total }) => (
                  <tr key={sub} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">{sub}</td>
                    <td className="py-1.5 text-right font-semibold text-slate-800">Rp {fmt(total)}</td>
                  </tr>
                ))}
              </tbody><tfoot><tr className="border-t-2 border-emerald-300">
                <td className="py-2 font-bold text-emerald-800">Total</td>
                <td className="py-2 text-right font-black text-emerald-800">Rp {fmt(totalPemasukan)}</td>
              </tr></tfoot></table>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Rincian Pengeluaran
              </h3>
              <table className="w-full text-xs"><tbody>
                {subsPengeluaran.map(({ sub, total }) => (
                  <tr key={sub} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">{sub}</td>
                    <td className="py-1.5 text-right font-semibold text-slate-800">Rp {fmt(total)}</td>
                  </tr>
                ))}
              </tbody><tfoot><tr className="border-t-2 border-red-300">
                <td className="py-2 font-bold text-red-800">Total</td>
                <td className="py-2 text-right font-black text-red-800">Rp {fmt(totalPengeluaran)}</td>
              </tr></tfoot></table>
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-1.5 mb-3">Rincian Transaksi ({trxSorted.length} transaksi)</h3>
          <table className="w-full text-xs border-collapse mb-8">
            <thead><tr className="bg-slate-100 border-y border-slate-300">
              <th className="py-2 px-3 text-left w-20">Tanggal</th>
              <th className="py-2 px-3 text-left w-24">Kategori</th>
              <th className="py-2 px-3 text-left w-32">Sub-Kategori</th>
              <th className="py-2 px-3 text-left">Deskripsi</th>
              <th className="py-2 px-3 text-right w-32">Nominal (Rp)</th>
            </tr></thead>
            <tbody>
              {trxSorted.map((t, i) => (
                <tr key={i} className={`border-b border-slate-200 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
                  <td className="py-1.5 px-3">{t.tanggal}</td>
                  <td className="py-1.5 px-3">{t.kategori}</td>
                  <td className="py-1.5 px-3 text-slate-500">{t.subKategori || '-'}</td>
                  <td className="py-1.5 px-3">{t.deskripsi}</td>
                  <td className={`py-1.5 px-3 text-right font-semibold ${t.nominal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {t.nominal >= 0 ? '+' : '-'} {fmt(Math.abs(t.nominal))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300"><tr>
              <td colSpan={4} className="py-2 px-3 text-right font-bold text-slate-700">Laba / (Rugi) Bersih Periode Ini:</td>
              <td className={`py-2 px-3 text-right font-black ${labaBersih >= 0 ? 'text-indigo-800' : 'text-orange-700'}`}>
                {labaBersih >= 0 ? '+' : '-'} {fmt(Math.abs(labaBersih))}
              </td>
            </tr></tfoot>
          </table>

          {piutangList.length > 0 && (
            <>
              <h3 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-1.5 mb-3">
                Piutang Belum Lunas ({piutangList.length} WO) — Total Rp {fmt(totalPiutang)}
              </h3>
              <table className="w-full text-xs border-collapse mb-8">
                <thead><tr className="bg-amber-50 border-y border-amber-200">
                  <th className="py-1.5 px-3 text-left w-28">No. WO</th>
                  <th className="py-1.5 px-3 text-left">Pelanggan</th>
                  <th className="py-1.5 px-3 text-left w-32">Item</th>
                  <th className="py-1.5 px-3 text-right w-28">Total Tagihan</th>
                  <th className="py-1.5 px-3 text-right w-28">Sudah Bayar</th>
                  <th className="py-1.5 px-3 text-right w-28">Sisa</th>
                  <th className="py-1.5 px-3 text-center w-20">Status</th>
                </tr></thead>
                <tbody>
                  {piutangList.map(({ wo, info }, i) => (
                    <tr key={wo.id} className={`border-b border-slate-200 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
                      <td className="py-1.5 px-3 font-mono">{wo.id}</td>
                      <td className="py-1.5 px-3">{wo.customer}</td>
                      <td className="py-1.5 px-3 text-slate-500">{wo.merk}</td>
                      <td className="py-1.5 px-3 text-right">{fmt(Math.max((wo.estimatedCost || 0) - (wo.diskon || 0), 0))}</td>
                      <td className="py-1.5 px-3 text-right text-emerald-700">{fmt(info.totalBayar)}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-amber-700">{fmt(info.sisaTagihan)}</td>
                      <td className="py-1.5 px-3 text-center font-semibold">{info.status}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-amber-300"><tr>
                  <td colSpan={5} className="py-2 px-3 text-right font-bold text-slate-700">Total Piutang:</td>
                  <td className="py-2 px-3 text-right font-black text-amber-700">{fmt(totalPiutang)}</td>
                  <td />
                </tr></tfoot>
              </table>
            </>
          )}

          <div className="mt-10 flex justify-end">
            <div className="text-center w-52">
              <p className="text-xs mb-14">{bs.kota || 'Pekanbaru'}, {today}</p>
              <div className="border-t border-slate-700 pt-1">
                <p className="text-xs font-bold">{bs.namaPemilik || 'Bagian Keuangan'}</p>
                <p className="text-xs text-slate-500">{bs.jabatanPemilik || bs.namaBengkel}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Untuk semua tipe lainnya (invoice, spk, surat-jalan), butuh `wo`.
  if (!wo) {
    return (
      <div className="p-10 text-center">
        <h2>Data tidak ditemukan.</h2>
        <button onClick={() => window.close()} className="mt-4 text-indigo-600 underline">Tutup tab ini</button>
      </div>
    );
  }

  // ─── INVOICE (½ A4 landscape / A5 landscape) ────────────────────────────
  if (type === 'invoice') {
    const diskon = wo.diskon ?? 0;
    const grandTotal = Math.max(subtotal - diskon, 0);

    return (
      <div className="min-h-screen bg-slate-200 print:bg-white">
        <style>{`
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { background: white !important; margin: 0; padding: 0; }
            @page { size: A5 landscape; margin: 0.8cm; }
            .no-print { display: none !important; }
          }
        `}</style>

        {/* Action Bar */}
        <div className="no-print sticky top-0 left-0 right-0 bg-slate-800 text-white p-3 flex justify-between items-center z-50 shadow-md">
          <div>
            <h2 className="font-semibold text-base">Preview Invoice · {wo.id.replace('WO-', 'INV-')}</h2>
            <p className="text-xs text-slate-300">Kertas ½ A4 (A5 Landscape) · Horizontal · Margin 0.8 cm</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.close()} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium">Tutup</button>
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              🖨️ Cetak / PDF
            </button>
          </div>
        </div>

        {/* Halaman A5 Landscape */}
        <div className="bg-white text-black px-7 py-5 font-sans max-w-[210mm] mx-auto min-h-[148mm] my-6 shadow-2xl print:shadow-none print:my-0 print:px-0 print:py-0 print:max-w-none text-xs">

          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-start gap-3">
              <img
                src={bs.logoUrl || '/primary-logo.png'}
                alt="Logo"
                className="h-14 w-auto object-contain object-left"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h1 className="text-base font-bold font-serif text-blue-900 tracking-wide leading-tight">{bs.namaBengkel}</h1>
                <p className="text-2xs mt-0.5 font-semibold">{bs.alamat}{bs.kota ? `, ${bs.kota}` : ''}</p>
                <p className="text-2xs">
                  {bs.telepon && `Telp: ${bs.telepon}`}
                  {bs.telepon && bs.hp && ' | '}
                  {bs.hp && `HP: ${bs.hp}`}
                </p>
                {bs.email && <p className="text-2xs">Email: {bs.email}</p>}
                {bs.npwp && <p className="text-2xs">NPWP: {bs.npwp}</p>}
              </div>
            </div>
            <div className="text-right text-xs">
              <p className="font-bold text-base uppercase tracking-wide border-b border-black pb-1 mb-2">INVOICE</p>
              <p>{bs.kota || 'Pekanbaru'}, {today}</p>
              <p className="mt-1">Kepada Yth,</p>
              <p className="font-bold text-sm">{wo.customer}</p>
              <p className="mt-1">No.: <span className="font-semibold">{wo.id.replace('WO-', 'INV-')}</span></p>
            </div>
          </div>

          {/* Table */}
          <table className="w-full border border-black mb-4 text-xs">
            <thead>
              <tr className="border-b border-black bg-slate-50">
                <th className="py-1.5 px-2 border-r border-black text-center w-7">No.</th>
                <th className="py-1.5 px-2 border-r border-black text-center w-16">Qty</th>
                <th className="py-1.5 px-2 border-r border-black text-left">KETERANGAN</th>
                <th className="py-1.5 px-2 border-r border-black text-right w-24">Harga @</th>
                <th className="py-1.5 px-2 text-right w-28">JUMLAH</th>
              </tr>
            </thead>
            <tbody>
              {/* Main Item */}
              <tr>
                <td className="py-1 px-2 border-r border-black text-center">1.</td>
                <td className="py-1 px-2 border-r border-black text-center">1 UNIT</td>
                <td className="py-1 px-2 border-r border-black font-semibold">{wo.merk}</td>
                <td className="py-1 px-2 border-r border-black text-right"></td>
                <td className="py-1 px-2 text-right"></td>
              </tr>
              {/* Jasa */}
              {woServices.map((svc) => (
                <tr key={svc.id}>
                  <td className="py-1 px-2 border-r border-black"></td>
                  <td className="py-1 px-2 border-r border-black text-center">1 JOB</td>
                  <td className="py-1 px-2 border-r border-black pl-4">- {svc.deskripsi}</td>
                  <td className="py-1 px-2 border-r border-black text-right">{fmt(svc.biaya)}</td>
                  <td className="py-1 px-2 text-right">{fmt(svc.biaya)}</td>
                </tr>
              ))}
              {/* Material */}
              {woBoms.map((bom) => (
                <tr key={bom.id}>
                  <td className="py-1 px-2 border-r border-black"></td>
                  <td className="py-1 px-2 border-r border-black text-center">{bom.jumlah} {bom.satuan}</td>
                  <td className="py-1 px-2 border-r border-black pl-4">- {bom.barang}</td>
                  <td className="py-1 px-2 border-r border-black text-right">{fmt(bom.harga)}</td>
                  <td className="py-1 px-2 text-right">{fmt(bom.jumlah * bom.harga)}</td>
                </tr>
              ))}
              {/* Filler */}
              <tr>
                <td className="py-5 border-r border-black"></td>
                <td className="py-5 border-r border-black"></td>
                <td className="py-5 border-r border-black"></td>
                <td className="py-5 border-r border-black"></td>
                <td className="py-5"></td>
              </tr>
            </tbody>
            <tfoot>
              {/* Pembayaran + Jumlah */}
              <tr className="border-t border-black">
                <td colSpan={3} className="py-1.5 px-2 border-r border-black align-top text-2xs" rowSpan={diskon > 0 ? 3 : 2}>
                  <p className="font-semibold mb-0.5">Pembayaran dapat ditransfer ke:</p>
                  <p>BANK MANDIRI A/N SUWALDI</p>
                  <p>No.Rek 108-00-1007188-5</p>
                  <p className="mt-0.5">BANK BCA A/N AZWA ADITYA MAULANA</p>
                  <p>No.Rek 8230531308</p>
                </td>
                <td className="py-1 px-2 border-r border-black border-b border-black text-right font-semibold">Subtotal</td>
                <td className="py-1 px-2 border-b border-black text-right font-semibold">{fmt(subtotal)}</td>
              </tr>
              {/* Diskon — tampil hanya jika ada */}
              {diskon > 0 && (
                <tr>
                  <td className="py-1 px-2 border-r border-black border-b border-black text-right font-semibold text-red-700">
                    Diskon{subtotal > 0 ? ` (${((diskon / subtotal) * 100).toFixed(1)}%)` : ''}
                  </td>
                  <td className="py-1 px-2 border-b border-black text-right font-semibold text-red-700">
                    - {fmt(diskon)}
                  </td>
                </tr>
              )}
              {/* Total */}
              <tr>
                <td className="py-1.5 px-2 border-r border-black text-right font-bold text-sm">Total</td>
                <td className="py-1.5 px-2 text-right font-bold text-sm">{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Tanda Tangan — 2 kolom: Penerima (kiri) + Direktur (kanan) */}
          <div className="grid grid-cols-2 gap-4 items-end mt-2 px-1">
            {/* Penerima */}
            <div className="text-center">
              <p className="text-xs font-medium">Penerima,</p>
              <div className="h-14 mt-1"></div>
              <div className="pt-1.5">
                <p className="text-xs">(................................)</p>
                <p className="text-2xs text-gray-500 mt-0.5">{wo.customer}</p>
              </div>
            </div>
            {/* Direktur */}
            <div className="text-center">
              <p className="text-2xs text-gray-500">{bs.kota || 'Pekanbaru'}, {today}</p>
              <p className="text-xs font-medium mt-0.5">Hormat Kami,</p>
              <div className="h-14 mt-1"></div>
              <div className="pt-1.5">
                <p className="font-bold text-xs">{bs.namaPemilik || bs.namaBengkel}</p>
                <p className="text-2xs text-gray-500">{bs.jabatanPemilik || 'Direktur'}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ─── SPK (A4) ──────────────────────────────────────────────────────────────
  if (type === 'spk') {
    return (
      <div className="min-h-screen bg-slate-200 print:bg-white">
        <style>{`
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { background: white !important; margin: 0; padding: 0; }
            @page { size: A4 portrait; margin: 1.5cm; }
            .no-print { display: none !important; }
            .spk-page {
              page-break-inside: avoid;
              page-break-after: avoid;
              page-break-before: avoid;
              max-height: calc(297mm - 3cm);
              overflow: hidden;
            }
          }
        `}</style>

        {/* Action Bar */}
        <div className="no-print sticky top-0 left-0 right-0 bg-slate-800 text-white p-4 flex justify-between items-center z-50 shadow-md">
          <div>
            <h2 className="font-semibold text-lg">Preview SPK · {wo.id}</h2>
            <p className="text-xs text-slate-300">Kertas A4 · Orientasi Potrait · Margin 1.5 cm · 1 Halaman</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.close()} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium">Tutup</button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              🖨️ Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* Konten A4 */}
        <div className="spk-page bg-white text-black px-10 py-7 font-sans max-w-[210mm] mx-auto my-8 shadow-2xl print:shadow-none print:my-0 print:max-w-none text-sm">

          {/* Header */}
          <div className="flex items-center justify-center gap-4 border-b-2 border-black pb-3 mb-4">
            <img
              src={bs.logoUrl || '/primary-logo.png'}
              alt="Logo"
              className="h-14 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="text-center">
              <h1 className="text-xl font-bold uppercase tracking-wide">Surat Perintah Kerja (SPK)</h1>
              <p className="text-sm font-bold mt-0.5">{bs.namaBengkel}</p>
              <p className="text-xs">{bs.alamat}{bs.kota ? `, ${bs.kota}` : ''}</p>
              <p className="text-xs">
                {bs.telepon && `Telp: ${bs.telepon}`}
                {bs.telepon && bs.hp && ' | '}
                {bs.hp && `HP: ${bs.hp}`}
              </p>
            </div>
          </div>

          {/* Info WO */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-0.5 w-36 font-semibold">No. SPK</td><td className="py-0.5">: {wo.id}</td></tr>
                <tr><td className="py-0.5 font-semibold">Tanggal Masuk</td><td className="py-0.5">: {wo.dateIn}</td></tr>
                <tr><td className="py-0.5 font-semibold">Pelanggan</td><td className="py-0.5">: {wo.customer}</td></tr>
              </tbody>
            </table>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-0.5 w-36 font-semibold">Teknisi</td><td className="py-0.5">: {wo.technician}</td></tr>
                <tr><td className="py-0.5 font-semibold">Estimasi Selesai</td><td className="py-0.5">: {wo.estimasiSelesai}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Detail Barang */}
          <div className="mb-4 border border-black p-3">
            <h2 className="font-bold mb-1.5 text-sm">Detail Barang:</h2>
            <p className="text-sm"><strong>Merk / Jenis:</strong> {wo.merk}</p>
            <p className="mt-1 text-sm"><strong>Kapasitas:</strong> {wo.capacity}</p>
            <p className="mt-1 text-sm"><strong>Keluhan / Kondisi:</strong> {wo.keluhan}</p>
          </div>

          {/* Catatan Teknisi */}
          <div className="mb-4 border border-black p-3" style={{ minHeight: '130px' }}>
            <h2 className="font-bold mb-1.5 text-sm">Catatan Teknisi / Tindakan Perbaikan:</h2>
          </div>

          {/* Kebutuhan Material */}
          <div className="mb-5 border border-black p-3" style={{ minHeight: '100px' }}>
            <h2 className="font-bold mb-1.5 text-sm">Kebutuhan Material:</h2>
          </div>

          {/* Tanda Tangan — 3 kolom: Admin · Teknisi · Penerima/Pelanggan */}
          <div className="grid grid-cols-3 gap-6 items-end mt-2 px-4">
            <div className="text-center">
              <p className="text-sm font-medium">Admin,</p>
              <div className="h-20 mt-1"></div>
              <div className="pt-1.5">
                <p className="text-sm">(................................)</p>
                <p className="text-xs text-gray-500 mt-0.5">Admin</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Teknisi,</p>
              <div className="h-20 mt-1"></div>
              <div className="pt-1.5">
                <p className="text-sm">
                  ({wo.technician && wo.technician !== '-' ? wo.technician : '................................'})
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Teknisi</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Pelanggan,</p>
              <div className="h-20 mt-1"></div>
              <div className="pt-1.5">
                <p className="text-sm">(................................)</p>
                <p className="text-xs text-gray-500 mt-0.5">{wo.customer}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ─── SURAT JALAN (½ A4 / A5) ─────────────────────────────────────────────
  if (type === 'surat-jalan') {
    return (
      <div className="min-h-screen bg-slate-200 print:bg-white">
        <style>{`
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { background: white !important; margin: 0; padding: 0; }
            @page { size: A5 landscape; margin: 0.8cm; }
            .no-print { display: none !important; }
          }
        `}</style>

        {/* Action Bar */}
        <div className="no-print sticky top-0 left-0 right-0 bg-slate-800 text-white p-3 flex justify-between items-center z-50 shadow-md">
          <div>
            <h2 className="font-semibold text-base">Preview Surat Jalan · {wo.id}</h2>
            <p className="text-xs text-slate-300">Kertas ½ A4 (A5 Landscape) · Horizontal · Margin 0.8 cm</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.close()} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium">Tutup</button>
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              🖨️ Cetak / PDF
            </button>
          </div>
        </div>

        {/* Halaman A5 Landscape */}
        <div className="bg-white text-black px-7 py-4 font-sans max-w-[210mm] mx-auto min-h-[148mm] my-6 shadow-2xl print:shadow-none print:my-0 print:px-0 print:py-0 print:max-w-none text-xs">

          {/* Header */}
          <div className="flex justify-between items-start mb-4 border-b-2 border-black pb-3">
            <div className="flex items-start gap-3">
              <img
                src={bs.logoUrl || '/primary-logo.png'}
                alt="Logo"
                className="h-14 w-auto object-contain object-left"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div>
                <h1 className="text-base font-bold font-serif tracking-wide leading-tight">{bs.namaBengkel}</h1>
                <p className="text-2xs mt-0.5 font-semibold">{bs.alamat}{bs.kota ? `, ${bs.kota}` : ''}</p>
                <p className="text-2xs">
                  {bs.telepon && `Telp: ${bs.telepon}`}
                  {bs.telepon && bs.hp && ' | '}
                  {bs.hp && `HP: ${bs.hp}`}
                </p>
                {bs.email && <p className="text-2xs">Email: {bs.email}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-base font-bold uppercase mb-1">Surat Jalan</h2>
              <p className="text-xs">No.: <span className="font-semibold">{wo.id}</span></p>
              <p className="text-xs">{bs.kota || 'Pekanbaru'}, {today}</p>
            </div>
          </div>

          {/* Kepada */}
          <div className="mb-3">
            <p className="text-xs">Kepada Yth,</p>
            <p className="font-bold text-sm">{wo.customer}</p>
            <p className="mt-1 text-xs">Bersama ini kami kirimkan barang dengan rincian sebagai berikut:</p>
          </div>

          {/* Table */}
          <table className="w-full border border-black mb-4 text-xs">
            <thead>
              <tr className="border-b border-black bg-slate-50">
                <th className="py-1.5 px-2 border-r border-black text-center w-7">No.</th>
                <th className="py-1.5 px-2 border-r border-black text-center w-16">Qty</th>
                <th className="py-1.5 px-2 border-r border-black text-left">Nama / Deskripsi Barang</th>
                <th className="py-1.5 px-2 text-left w-36">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 px-2 border-r border-black text-center">1</td>
                <td className="py-2 px-2 border-r border-black text-center">1 UNIT</td>
                <td className="py-2 px-2 border-r border-black font-semibold">{wo.merk} (Kap: {wo.capacity})</td>
                <td className="py-2 px-2 text-xs">Selesai Servis (Ref: {wo.id})</td>
              </tr>
              {/* Filler */}
              <tr>
                <td className="py-8 border-r border-black"></td>
                <td className="py-8 border-r border-black"></td>
                <td className="py-8 border-r border-black"></td>
                <td className="py-8"></td>
              </tr>
            </tbody>
          </table>

          <p className="mb-4 text-xs italic">Barang diterima dalam keadaan baik dan cukup.</p>

          {/* Tanda Tangan — 3 kolom: Penerima · Pengirim · Direktur */}
          <div className="grid grid-cols-3 gap-3 items-end mt-1">

            {/* Penerima */}
            <div className="text-center">
              <p className="text-xs font-medium">Penerima,</p>
              <div className="h-14 mt-1"></div>
              <div className="pt-1.5">
                <p className="text-xs">(................................)</p>
                <p className="text-2xs text-gray-500 mt-0.5">{wo.customer}</p>
              </div>
            </div>

            {/* Pengirim */}
            <div className="text-center">
              <p className="text-xs font-medium">Pengirim / Supir,</p>
              <div className="h-14 mt-1"></div>
              <div className="pt-1.5">
                <p className="text-xs">(................................)</p>
                <p className="text-2xs text-gray-500 mt-0.5">&nbsp;</p>
              </div>
            </div>

            {/* Direktur */}
            <div className="text-center">
              <p className="text-2xs text-gray-500">{bs.kota || 'Pekanbaru'}, {today}</p>
              <p className="text-xs font-medium mt-0.5">Hormat Kami,</p>
              <div className="h-14 mt-1"></div>
              <div className="pt-1.5">
                <p className="font-bold text-xs">{bs.namaPemilik || bs.namaBengkel}</p>
                <p className="text-2xs text-gray-500">{bs.jabatanPemilik || 'Direktur'}</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  return <div>Tipe cetak tidak valid.</div>;
}
