import { useParams } from 'react-router-dom';
import { useStore, computeStatusBayar } from '../store/useStore';
import { cityShort } from '../lib/format';
import { terbilangRupiah } from '../lib/terbilang';

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);

const VALID_TYPES = ['invoice', 'invoice-dp', 'invoice-pelunasan', 'spk', 'surat-jalan', 'laporan-keuangan', 'kuitansi', 'bukti-pembayaran'] as const;
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

        <div className="bg-white mx-auto my-8 px-12 py-10 shadow-2xl print:shadow-none print:my-0 print:px-0 print:py-0 print:w-auto print:min-h-0 w-[210mm] min-h-[297mm] font-sans">
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
              <p className="text-xs mb-14">{cityShort(bs.kota) || 'Pekanbaru'}, {today}</p>
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

  // ─── KUITANSI (Pemasukan) & BUKTI PEMBAYARAN (Pengeluaran) ───────────────
  // Pakai ID dari tabel `finance`, bukan `work_orders`.
  if (type === 'kuitansi' || type === 'bukti-pembayaran') {
    const trx = finance.find(t => t.id === id);
    if (!trx) {
      return (
        <div className="p-10 text-center">
          <h2>Transaksi tidak ditemukan.</h2>
          <button onClick={() => window.close()} className="mt-4 text-indigo-600 underline">Tutup tab ini</button>
        </div>
      );
    }

    const isKuitansi = type === 'kuitansi';
    // Validasi: kuitansi hanya untuk Pemasukan, bukti pembayaran hanya Pengeluaran
    if (isKuitansi && trx.kategori !== 'Pemasukan') {
      return (
        <div className="p-10 text-center">
          <h2>Kuitansi hanya untuk transaksi Pemasukan.</h2>
          <p className="text-sm text-slate-500 mt-2">Untuk Pengeluaran, gunakan Bukti Pembayaran.</p>
          <button onClick={() => window.close()} className="mt-4 text-indigo-600 underline">Tutup tab ini</button>
        </div>
      );
    }
    if (!isKuitansi && trx.kategori !== 'Pengeluaran') {
      return (
        <div className="p-10 text-center">
          <h2>Bukti Pembayaran hanya untuk transaksi Pengeluaran.</h2>
          <p className="text-sm text-slate-500 mt-2">Untuk Pemasukan, gunakan Kuitansi.</p>
          <button onClick={() => window.close()} className="mt-4 text-indigo-600 underline">Tutup tab ini</button>
        </div>
      );
    }

    const nominalAbs = Math.abs(trx.nominal);
    const trxTanggal = trx.tanggal
      ? new Date(trx.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : today;

    // Ambil data WO terkait kalau trx ada woId — untuk konteks "untuk pembayaran apa"
    const trxWo = trx.woId ? workOrders.find(w => w.id === trx.woId) : undefined;

    // Header & label kontekstual
    const titleMap = {
      kuitansi: 'KUITANSI',
      'bukti-pembayaran': 'BUKTI PEMBAYARAN',
    } as const;
    const headerTitle = titleMap[type];
    const idPrefix = isKuitansi ? 'KW' : 'BP';
    const docNo = trx.id.replace(/^TRX-?0*/, `${idPrefix}-`);

    // Sub-kategori → label "untuk keperluan"
    const keperluanLabel = (() => {
      const sk = trx.subKategori;
      if (isKuitansi) {
        if (sk === 'DP') return `Pembayaran DP${trxWo ? ` Work Order ${trxWo.id}` : ''}`;
        if (sk === 'Pelunasan') return `Pelunasan${trxWo ? ` Work Order ${trxWo.id}` : ''}`;
        if (sk === 'Pembayaran Servis') return `Pembayaran Servis${trxWo ? ` Work Order ${trxWo.id}` : ''}`;
        return trx.deskripsi;
      } else {
        if (sk === 'Material/Suku Cadang') return `Pembelian ${trx.deskripsi}`;
        if (sk === 'Listrik & Operasional') return `Pembayaran Operasional: ${trx.deskripsi}`;
        if (sk === 'Gaji Teknisi') return `Pembayaran Gaji: ${trx.deskripsi}`;
        return trx.deskripsi;
      }
    })();

    // Untuk kuitansi: dari = pelanggan/pihak luar (bs); untuk bukti pembayaran: dari = bs, ke = trx pihak
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
            <h2 className="font-semibold text-base">Preview {headerTitle} · {docNo}</h2>
            <p className="text-xs text-slate-300">Kertas ½ A4 (A5 Landscape) · Horizontal · Margin 0.8 cm</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.close()} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium">Tutup</button>
            <button onClick={() => window.print()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium flex items-center gap-2">
              🖨️ Cetak / PDF
            </button>
          </div>
        </div>

        {/* Halaman A5 Landscape */}
        <div className="bg-white text-black px-7 py-5 font-sans max-w-[210mm] mx-auto min-h-[148mm] my-6 shadow-2xl print:shadow-none print:my-0 print:px-0 print:py-0 print:max-w-none print:min-h-0 print:w-full text-sm">

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
              <h2 className={`text-lg font-bold uppercase mb-1 tracking-widest ${isKuitansi ? 'text-emerald-700' : 'text-indigo-700'}`}>{headerTitle}</h2>
              <p className="text-xs">No.: <span className="font-semibold">{docNo}</span></p>
              <p className="text-xs">{cityShort(bs.kota) || 'Pekanbaru'}, {trxTanggal}</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-2 py-3 space-y-2.5 text-sm">
            {/* Telah terima dari / Telah dibayarkan kepada */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-baseline">
              <span className="text-slate-600">{isKuitansi ? 'Telah terima dari' : 'Telah dibayarkan kepada'}</span>
              <span className="font-bold border-b border-dotted border-slate-400 pb-0.5">
                : {isKuitansi ? (trxWo?.customer || trx.deskripsi.replace(/^(Pelunasan|Pembayaran DP) - [\w-]+ \(/, '').replace(/\)$/, '') || '─') : trx.deskripsi}
              </span>
            </div>

            {/* Banyaknya uang (terbilang) */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-baseline">
              <span className="text-slate-600">Banyaknya uang</span>
              <span className="italic font-semibold border-b border-dotted border-slate-400 pb-0.5">
                : {terbilangRupiah(nominalAbs)}
              </span>
            </div>

            {/* Untuk pembayaran / keperluan */}
            <div className="grid grid-cols-[140px_1fr] gap-2 items-baseline">
              <span className="text-slate-600">{isKuitansi ? 'Untuk pembayaran' : 'Untuk keperluan'}</span>
              <span className="font-medium border-b border-dotted border-slate-400 pb-0.5">
                : {keperluanLabel}
              </span>
            </div>

            {/* Cara bayar (kalau ada catatan) */}
            {trx.catatan && (
              <div className="grid grid-cols-[140px_1fr] gap-2 items-baseline">
                <span className="text-slate-600">Catatan</span>
                <span className="text-slate-700">: {trx.catatan}</span>
              </div>
            )}
          </div>

          {/* Nominal box + Tanda tangan */}
          <div className="flex justify-between items-end mt-6 px-2">
            {/* Nominal box besar — kiri */}
            <div className={`border-2 ${isKuitansi ? 'border-emerald-700' : 'border-indigo-700'} rounded-lg px-5 py-3 inline-block`}>
              <p className="text-2xs font-semibold uppercase tracking-wider text-slate-500">Jumlah</p>
              <p className={`text-2xl font-black font-mono ${isKuitansi ? 'text-emerald-700' : 'text-indigo-700'}`}>
                Rp {fmt(nominalAbs)},-
              </p>
            </div>

            {/* Tanda tangan kanan */}
            <div className="text-center w-52">
              <p className="text-xs">{cityShort(bs.kota) || 'Pekanbaru'}, {trxTanggal}</p>
              <p className="text-xs mt-0.5">{isKuitansi ? 'Yang menerima,' : 'Yang membayarkan,'}</p>
              <div className="h-16 mt-1"></div>
              <div className="border-t border-slate-700 pt-1">
                <p className="text-sm font-bold">{bs.namaPemilik || bs.namaBengkel}</p>
                <p className="text-2xs text-slate-500">{bs.jabatanPemilik || 'Bagian Keuangan'}</p>
              </div>
            </div>
          </div>

          {/* Footnote */}
          <div className="mt-6 pt-2 border-t border-dashed border-slate-300 text-2xs text-slate-400 italic text-center">
            {isKuitansi
              ? 'Kuitansi ini sah sebagai bukti penerimaan pembayaran.'
              : 'Bukti pembayaran ini diterbitkan sebagai dokumen pencatatan pengeluaran internal.'}
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
  // Tiga variant: 'invoice' (full), 'invoice-dp', 'invoice-pelunasan'
  if (type === 'invoice' || type === 'invoice-dp' || type === 'invoice-pelunasan') {
    const diskon = wo.diskon ?? 0;
    const grandTotal = Math.max(subtotal - diskon, 0);
    const dpAmount = wo.dpAmount ?? 0;
    const piutang = computeStatusBayar(wo, finance);
    const fmtTanggalLong = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';

    // Variant config — title, jumlah yang ditagih, label
    const variant = type === 'invoice-dp' ? 'dp' : type === 'invoice-pelunasan' ? 'pelunasan' : 'full';
    const sisaPelunasan = Math.max(grandTotal - dpAmount, 0);

    // Total yang ditagih invoice ini
    const tagihIni =
      variant === 'dp' ? dpAmount :
      variant === 'pelunasan' ? sisaPelunasan :
      grandTotal;

    const headerTitle =
      variant === 'dp' ? 'INVOICE DP' :
      variant === 'pelunasan' ? 'INVOICE PELUNASAN' :
      'INVOICE';

    const idPrefix =
      variant === 'dp' ? 'DP' :
      variant === 'pelunasan' ? 'LNS' :
      'INV';
    const invoiceNo = wo.id.replace('WO-', `${idPrefix}-`);

    // Guard: variant DP/Pelunasan butuh dpAmount > 0
    if (variant !== 'full' && dpAmount === 0) {
      return (
        <div className="p-10 text-center">
          <h2 className="text-lg font-bold mb-2">Invoice {variant === 'dp' ? 'DP' : 'Pelunasan'} tidak tersedia</h2>
          <p className="text-slate-500 mb-4">WO ini di-set <b>Bayar Penuh</b> (tanpa DP). Gunakan Invoice biasa.</p>
          <button onClick={() => window.close()} className="mt-2 text-indigo-600 underline">Tutup tab ini</button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-200 print:bg-white">
        <style>{`
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { background: white !important; margin: 0; padding: 0; }
            @page { size: A5 landscape; margin: 0.8cm; }
            .no-print { display: none !important; }
          }
          /* Watermark OVERDUE — diagonal merah saat dicetak ulang piutang lewat tempo */
          .overdue-watermark {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            z-index: 1;
          }
          .overdue-watermark span {
            transform: rotate(-30deg);
            font-size: 90px;
            font-weight: 900;
            color: rgba(220, 38, 38, 0.18);
            border: 6px solid rgba(220, 38, 38, 0.18);
            padding: 8px 36px;
            letter-spacing: 0.1em;
            white-space: nowrap;
          }
        `}</style>

        {/* Action Bar */}
        <div className="no-print sticky top-0 left-0 right-0 bg-slate-800 text-white p-3 flex justify-between items-center z-50 shadow-md">
          <div>
            <h2 className="font-semibold text-base">Preview {headerTitle} · {invoiceNo}</h2>
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
        <div className="relative bg-white text-black px-7 py-5 font-sans max-w-[210mm] mx-auto min-h-[148mm] my-6 shadow-2xl print:shadow-none print:my-0 print:px-0 print:py-0 print:max-w-none print:min-h-0 print:w-full text-xs">

          {/* Watermark OVERDUE — hanya muncul kalau piutang lewat tempo */}
          {piutang.isOverdue && (
            <div className="overdue-watermark" aria-hidden="true">
              <span>OVERDUE</span>
            </div>
          )}

          {/* Header */}
          <div className="flex justify-between items-start mb-4 relative" style={{ zIndex: 2 }}>
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
              <p className={`font-bold text-base uppercase tracking-wide border-b border-black pb-1 mb-2 ${variant === 'dp' ? 'text-emerald-700' : variant === 'pelunasan' ? 'text-amber-700' : ''}`}>{headerTitle}</p>
              <p>{cityShort(bs.kota) || 'Pekanbaru'}, {today}</p>
              <p className="mt-1">Kepada Yth,</p>
              <p className="font-bold text-sm">{wo.customer}</p>
              <p className="mt-1">No.: <span className="font-semibold">{invoiceNo}</span></p>
              {variant !== 'full' && (
                <p className="text-2xs text-slate-500 mt-0.5">Ref WO: {wo.id}</p>
              )}
              {/* Termin Pembayaran info — di bawah no invoice */}
              <div className="mt-1.5 inline-block bg-slate-100 border border-slate-300 rounded px-2 py-1 text-2xs leading-tight">
                <span className="font-semibold">Termin: </span>
                <span>{(wo.terminHari ?? 0) === 0 ? 'COD (Lunas di Tempat)' : `NET ${wo.terminHari} hari`}</span>
                {wo.tanggalInvoice && (wo.terminHari ?? 0) > 0 && (
                  <>
                    <br />
                    <span className="font-semibold">Tanggal Invoice: </span>
                    <span>{fmtTanggalLong(wo.tanggalInvoice)}</span>
                    {piutang.jatuhTempo && (
                      <>
                        <br />
                        <span className="font-semibold">Jatuh Tempo: </span>
                        <span className={piutang.isOverdue ? 'text-red-700 font-bold' : ''}>
                          {fmtTanggalLong(piutang.jatuhTempo)}
                          {piutang.isOverdue && piutang.hariKeJatuhTempo != null && ` (lewat ${Math.abs(piutang.hariKeJatuhTempo)} hari)`}
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full border border-black mb-4 text-xs relative" style={{ zIndex: 2 }}>
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
                <td className="py-1 px-2 border-r border-black text-center">{wo.qty ?? 1} {wo.qtySatuan || 'UNIT'}</td>
                <td className="py-1 px-2 border-r border-black font-semibold">{wo.merk}{wo.capacity && wo.capacity !== '-' ? ` (${wo.capacity})` : ''}</td>
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
              {(() => {
                // Hitung jumlah baris footer (untuk rowSpan info bank)
                const showDiskon = diskon > 0;
                const showDpRow = variant !== 'full' && dpAmount > 0;
                // Subtotal + (Diskon?) + (DP/Sisa?) + Total = 2 + n
                const footerRows = 2 + (showDiskon ? 1 : 0) + (showDpRow ? 1 : 0);
                return (
                  <>
                    {/* Pembayaran + Subtotal */}
                    <tr className="border-t border-black">
                      <td colSpan={3} className="py-1.5 px-2 border-r border-black align-top text-2xs" rowSpan={footerRows}>
                        <p className="font-semibold mb-0.5">Pembayaran dapat ditransfer ke:</p>
                        <p>BANK MANDIRI A/N SUWALDI</p>
                        <p>No.Rek 108-00-1007188-5</p>
                        <p className="mt-0.5">BANK BCA A/N AZWA ADITYA MAULANA</p>
                        <p>No.Rek 8230531308</p>
                        {variant === 'pelunasan' && (
                          <p className="mt-1.5 text-2xs italic text-slate-600">
                            * DP sebesar Rp {fmt(dpAmount)} sudah dibayarkan sebelumnya. Invoice ini hanya menagih sisa pelunasan.
                          </p>
                        )}
                        {variant === 'dp' && (
                          <p className="mt-1.5 text-2xs italic text-slate-600">
                            * Invoice DP. Sisa pelunasan Rp {fmt(sisaPelunasan)} akan ditagih dalam invoice terpisah.
                          </p>
                        )}
                      </td>
                      <td className="py-1 px-2 border-r border-black border-b border-black text-right font-semibold">Subtotal</td>
                      <td className="py-1 px-2 border-b border-black text-right font-semibold">{fmt(subtotal)}</td>
                    </tr>
                    {/* Diskon — tampil hanya jika ada */}
                    {showDiskon && (
                      <tr>
                        <td className="py-1 px-2 border-r border-black border-b border-black text-right font-semibold text-red-700">
                          Diskon{subtotal > 0 ? ` (${((diskon / subtotal) * 100).toFixed(1)}%)` : ''}
                        </td>
                        <td className="py-1 px-2 border-b border-black text-right font-semibold text-red-700">
                          - {fmt(diskon)}
                        </td>
                      </tr>
                    )}
                    {/* DP info row — hanya invoice-dp atau invoice-pelunasan */}
                    {showDpRow && variant === 'dp' && (
                      <tr>
                        <td className="py-1 px-2 border-r border-black border-b border-black text-right font-semibold text-emerald-700">
                          Total Tagihan WO
                        </td>
                        <td className="py-1 px-2 border-b border-black text-right text-slate-600">
                          {fmt(grandTotal)}
                        </td>
                      </tr>
                    )}
                    {showDpRow && variant === 'pelunasan' && (
                      <tr>
                        <td className="py-1 px-2 border-r border-black border-b border-black text-right font-semibold text-emerald-700">
                          DP Sudah Dibayar
                        </td>
                        <td className="py-1 px-2 border-b border-black text-right text-emerald-700">
                          - {fmt(dpAmount)}
                        </td>
                      </tr>
                    )}
                    {/* Total / Tagihan invoice ini */}
                    <tr>
                      <td className={`py-1.5 px-2 border-r border-black text-right font-bold text-sm ${variant !== 'full' ? 'bg-slate-50' : ''}`}>
                        {variant === 'dp' ? 'DP DITAGIH' : variant === 'pelunasan' ? 'SISA PELUNASAN' : 'Total'}
                      </td>
                      <td className={`py-1.5 px-2 text-right font-bold text-sm ${variant !== 'full' ? 'bg-slate-50' : ''}`}>{fmt(tagihIni)}</td>
                    </tr>
                  </>
                );
              })()}
            </tfoot>
          </table>

          {/* Tanda Tangan — 2 kolom: Penerima (kiri) + Direktur (kanan) */}
          <div className="grid grid-cols-2 gap-4 items-end mt-2 px-1 relative" style={{ zIndex: 2 }}>
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
              <p className="text-2xs text-gray-500">{cityShort(bs.kota) || 'Pekanbaru'}, {today}</p>
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
        <div className="spk-page bg-white text-black px-10 py-7 font-sans max-w-[210mm] mx-auto my-8 shadow-2xl print:shadow-none print:my-0 print:px-0 print:py-0 print:max-w-none print:w-full text-sm">

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
            <p className="text-sm"><strong>Qty:</strong> {wo.qty ?? 1} {wo.qtySatuan || 'UNIT'}</p>
            <p className="mt-1 text-sm"><strong>Merk / Jenis:</strong> {wo.merk}</p>
            <p className="mt-1 text-sm"><strong>Deskripsi:</strong> {wo.capacity}</p>
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
        <div className="bg-white text-black px-7 py-4 font-sans max-w-[210mm] mx-auto min-h-[148mm] my-6 shadow-2xl print:shadow-none print:my-0 print:px-0 print:py-0 print:max-w-none print:min-h-0 print:w-full text-xs">

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
              <p className="text-xs">{cityShort(bs.kota) || 'Pekanbaru'}, {today}</p>
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
                <td className="py-2 px-2 border-r border-black text-center">{wo.qty ?? 1} {wo.qtySatuan || 'UNIT'}</td>
                <td className="py-2 px-2 border-r border-black font-semibold">{wo.merk}{wo.capacity && wo.capacity !== '-' ? ` (${wo.capacity})` : ''}</td>
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
              <p className="text-2xs text-gray-500">{cityShort(bs.kota) || 'Pekanbaru'}, {today}</p>
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
