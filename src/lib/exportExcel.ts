/**
 * exportExcel.ts
 * Semua fungsi export ke format .xlsx menggunakan SheetJS (xlsx@0.18.x)
 *
 * SheetJS community edition TIDAK support cell styling (font/color).
 * Yang bisa dilakukan: column widths, merge cells, number format (z property).
 */
import * as XLSX from 'xlsx';
import type { WorkOrder, InventoryItem, FinanceTransaction, Customer } from '../store/useStore';
import { computeStatusBayar } from '../store/useStore';

// ─── HELPERS ──────────────────────────────────────────────────

/** Set lebar kolom otomatis berdasarkan konten */
function autoWidth(
  ws: XLSX.WorkSheet,
  rows: Record<string, unknown>[],
  headers: string[]
): void {
  const widths = headers.map((h, col) => {
    const dataMax = rows.reduce((max, r) => {
      const val = String(Object.values(r)[col] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return { wch: Math.max(h.length, dataMax) + 2 };
  });
  ws['!cols'] = widths;
}

/** Buat baris header tebal dengan background (via cell comment workaround) */
function addHeaderRow(ws: XLSX.WorkSheet, headers: string[], rowIdx = 0): void {
  headers.forEach((h, c) => {
    const ref = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!ws[ref]) ws[ref] = {};
    ws[ref].v = h;
    ws[ref].t = 's';
  });
}

/** Format tanggal untuk nama file */
function fileDate(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/** Label bulan Indonesia */
function monthLabel(period: string): string {
  const [y, m] = period.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

// ─── 1. BUKU KAS (Finance Transactions) ───────────────────────

export function exportBukuKas(
  finance: FinanceTransaction[],
  period?: string   // YYYY-MM, opsional — kalau diisi hanya export bulan itu
): void {
  const trxs = period
    ? finance.filter(t => t.tanggal.startsWith(period))
    : [...finance];

  trxs.sort((a, b) => a.tanggal.localeCompare(b.tanggal));

  // Hitung saldo berjalan
  let running = 0;
  const rows = trxs.map(t => {
    running += t.nominal;
    return {
      'ID Transaksi': t.id,
      'Tanggal': t.tanggal,
      'Kategori': t.kategori,
      'Sub-Kategori': t.subKategori || '-',
      'Deskripsi': t.deskripsi,
      'Catatan': t.catatan || '-',
      'Nominal (Rp)': t.nominal,
      'Saldo Berjalan (Rp)': running,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = ['ID Transaksi', 'Tanggal', 'Kategori', 'Sub-Kategori', 'Deskripsi', 'Catatan', 'Nominal (Rp)', 'Saldo Berjalan (Rp)'];
  autoWidth(ws, rows as Record<string, unknown>[], headers);

  // Format kolom nominal sebagai angka
  ['G', 'H'].forEach(col => {
    for (let r = 1; r <= rows.length; r++) {
      const ref = `${col}${r + 1}`;
      if (ws[ref]) ws[ref].z = '#,##0';
    }
  });

  const wb = XLSX.utils.book_new();
  const sheetName = period ? `Buku Kas ${monthLabel(period)}` : 'Buku Kas Lengkap';
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const filename = period
    ? `BukuKas_${period}_${fileDate()}.xlsx`
    : `BukuKas_Lengkap_${fileDate()}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── 2. LAPORAN BULANAN (Ringkasan per Bulan) ─────────────────

export function exportLaporanBulanan(finance: FinanceTransaction[]): void {
  // Kumpulkan semua bulan yang ada data
  const monthSet = new Set<string>();
  finance.forEach(t => monthSet.add(t.tanggal.slice(0, 7)));
  const months = Array.from(monthSet).sort();

  const rows = months.map(m => {
    const trxs = finance.filter(t => t.tanggal.startsWith(m));
    const pemasukan = trxs.filter(t => t.nominal > 0).reduce((a, b) => a + b.nominal, 0);
    const pengeluaran = Math.abs(trxs.filter(t => t.nominal < 0).reduce((a, b) => a + b.nominal, 0));
    const laba = pemasukan - pengeluaran;

    // Breakdown sub-kategori pemasukan
    const servis = trxs.filter(t => t.nominal > 0 && t.subKategori === 'Pembayaran Servis').reduce((a, b) => a + b.nominal, 0);
    const dp = trxs.filter(t => t.nominal > 0 && t.subKategori === 'DP').reduce((a, b) => a + b.nominal, 0);

    // Breakdown sub-kategori pengeluaran
    const material = Math.abs(trxs.filter(t => t.nominal < 0 && t.subKategori === 'Material/Suku Cadang').reduce((a, b) => a + b.nominal, 0));
    const listrik = Math.abs(trxs.filter(t => t.nominal < 0 && t.subKategori === 'Listrik & Operasional').reduce((a, b) => a + b.nominal, 0));
    const gaji = Math.abs(trxs.filter(t => t.nominal < 0 && t.subKategori === 'Gaji Teknisi').reduce((a, b) => a + b.nominal, 0));

    return {
      'Periode': monthLabel(m),
      'Kode Bulan': m,
      'Total Pemasukan (Rp)': pemasukan,
      'Servis (Rp)': servis,
      'DP (Rp)': dp,
      'Total Pengeluaran (Rp)': pengeluaran,
      'Material (Rp)': material,
      'Listrik & Ops (Rp)': listrik,
      'Gaji (Rp)': gaji,
      'Laba Bersih (Rp)': laba,
      'Status': laba >= 0 ? 'UNTUNG' : 'RUGI',
      'Jml Transaksi': trxs.length,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] || {});
  autoWidth(ws, rows as Record<string, unknown>[], headers);

  // Format kolom angka
  const numCols = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  numCols.forEach(col => {
    for (let r = 1; r <= rows.length; r++) {
      const ref = `${col}${r + 1}`;
      if (ws[ref]) ws[ref].z = '#,##0';
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Laporan Bulanan');
  XLSX.writeFile(wb, `LaporanBulanan_${fileDate()}.xlsx`);
}

// ─── 3. PIUTANG ───────────────────────────────────────────────

export function exportPiutang(
  workOrders: WorkOrder[],
  finance: FinanceTransaction[]
): void {
  const piutangList = workOrders
    .filter(wo => wo.estimatedCost > 0)
    .map(wo => ({ wo, info: computeStatusBayar(wo, finance) }))
    .filter(({ info }) => info.status !== 'Lunas')
    // Sort: yang lewat tempo paling atas, dalam group sort by sisa terbanyak
    .sort((a, b) => {
      if (a.info.isOverdue !== b.info.isOverdue) return a.info.isOverdue ? -1 : 1;
      if (a.info.isDueSoon !== b.info.isDueSoon) return a.info.isDueSoon ? -1 : 1;
      return b.info.sisaTagihan - a.info.sisaTagihan;
    });

  const rows = piutangList.map(({ wo, info }) => {
    const terminLabel = (wo.terminHari ?? 0) === 0 ? 'COD' : `NET ${wo.terminHari}`;
    const aging =
      info.isOverdue && info.hariKeJatuhTempo != null
        ? `Lewat ${Math.abs(info.hariKeJatuhTempo)} hari`
        : info.isDueSoon && info.hariKeJatuhTempo != null
        ? (info.hariKeJatuhTempo === 0 ? 'Hari ini' : `${info.hariKeJatuhTempo} hari lagi`)
        : info.hariKeJatuhTempo != null
        ? `${info.hariKeJatuhTempo} hari lagi`
        : '-';
    return {
      'No. WO': wo.id,
      'Pelanggan': wo.customer,
      'Item/Merk': wo.merk,
      'Tgl Masuk': wo.dateIn,
      'Status WO': wo.status,
      'Termin': terminLabel,
      'Tgl Invoice': wo.tanggalInvoice ?? '-',
      'Jatuh Tempo': info.jatuhTempo ?? '-',
      'Aging': aging,
      'Total Tagihan (Rp)': Math.max((wo.estimatedCost || 0) - (wo.diskon || 0), 0),
      'Sudah Dibayar (Rp)': info.totalBayar,
      'Sisa Tagihan (Rp)': info.sisaTagihan,
      'Status Bayar': info.status,
      'Lewat Tempo?': info.isOverdue ? 'YA' : '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] || {});
  autoWidth(ws, rows as Record<string, unknown>[], headers);

  // Format numerik untuk kolom Rp (J, K, L sekarang)
  ['J', 'K', 'L'].forEach(col => {
    for (let r = 1; r <= rows.length; r++) {
      const ref = `${col}${r + 1}`;
      if (ws[ref]) ws[ref].z = '#,##0';
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Piutang Belum Lunas');
  XLSX.writeFile(wb, `Piutang_${fileDate()}.xlsx`);
}

// ─── 4. WORK ORDERS ───────────────────────────────────────────

export function exportWorkOrders(
  workOrders: WorkOrder[],
  finance: FinanceTransaction[]
): void {
  const sorted = [...workOrders].sort((a, b) => b.dateIn.localeCompare(a.dateIn));

  const rows = sorted.map(wo => {
    const info = computeStatusBayar(wo, finance);
    const terminLabel = (wo.terminHari ?? 0) === 0 ? 'COD' : `NET ${wo.terminHari}`;
    return {
      'No. WO': wo.id,
      'Tgl Masuk': wo.dateIn,
      'Pelanggan': wo.customer,
      'Qty': wo.qty ?? 1,
      'Satuan': wo.qtySatuan || 'UNIT',
      'Merk/Jenis': wo.merk,
      'Deskripsi': wo.capacity,
      'Keluhan': wo.keluhan,
      'Status WO': wo.status,
      'Teknisi': wo.technician,
      'Est. Selesai': wo.estimasiSelesai,
      'Estimasi Biaya (Rp)': wo.estimatedCost,
      'Diskon (Rp)': wo.diskon ?? 0,
      'Termin': terminLabel,
      'Tgl Invoice': wo.tanggalInvoice ?? '-',
      'Jatuh Tempo': info.jatuhTempo ?? '-',
      'Status Bayar': info.status,
      'Sisa Tagihan (Rp)': info.sisaTagihan,
      'Lewat Tempo?': info.isOverdue ? 'YA' : '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] || {});
  autoWidth(ws, rows as Record<string, unknown>[], headers);

  // Format numerik: J (Estimasi), K (Diskon), P (Sisa Tagihan)
  ['J', 'K', 'P'].forEach(col => {
    for (let r = 1; r <= rows.length; r++) {
      const ref = `${col}${r + 1}`;
      if (ws[ref]) ws[ref].z = '#,##0';
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Work Orders');
  XLSX.writeFile(wb, `WorkOrders_${fileDate()}.xlsx`);
}

// ─── 5. INVENTORY / STOK ──────────────────────────────────────

export function exportInventory(inventory: InventoryItem[]): void {
  const sorted = [...inventory].sort((a, b) => a.nama.localeCompare(b.nama));

  const rows = sorted.map(item => ({
    'ID': item.id,
    'Nama Item': item.nama,
    'Stok': item.stok,
    'Satuan': item.satuan,
    'Batas Minimum': item.batasMinimum,
    'Status Stok': item.stok === 0 ? 'HABIS' : item.stok <= item.batasMinimum ? 'KRITIS' : 'AMAN',
    'Harga Beli (Rp)': item.hargaBeli,
    'Harga Jual (Rp)': item.hargaJual,
    'Nilai Stok Beli (Rp)': item.stok * item.hargaBeli,
    'Nilai Stok Jual (Rp)': item.stok * item.hargaJual,
    'Margin (Rp)': item.hargaJual - item.hargaBeli,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] || {});
  autoWidth(ws, rows as Record<string, unknown>[], headers);

  ['G', 'H', 'I', 'J', 'K'].forEach(col => {
    for (let r = 1; r <= rows.length; r++) {
      const ref = `${col}${r + 1}`;
      if (ws[ref]) ws[ref].z = '#,##0';
    }
  });

  // Tambah baris total di bawah
  const totalRow = rows.length + 2;
  const totalBeli = rows.reduce((a, r) => a + (r['Nilai Stok Beli (Rp)'] as number), 0);
  const totalJual = rows.reduce((a, r) => a + (r['Nilai Stok Jual (Rp)'] as number), 0);
  XLSX.utils.sheet_add_aoa(ws, [
    ['', 'TOTAL NILAI STOK', '', '', '', '', '', '', totalBeli, totalJual, totalJual - totalBeli]
  ], { origin: { r: totalRow, c: 0 } });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventori Stok');
  XLSX.writeFile(wb, `Inventori_${fileDate()}.xlsx`);
}

// ─── 6. EXPORT CUSTOMERS ──────────────────────────────────────

export function exportCustomers(
  customers: Customer[],
  workOrders: WorkOrder[]
): void {
  const sorted = [...customers].sort((a, b) => a.perusahaan.localeCompare(b.perusahaan));

  const rows = sorted.map(c => {
    const woCount = workOrders.filter(wo =>
      wo.customer.toLowerCase() === c.perusahaan.toLowerCase() ||
      wo.customer.toLowerCase() === c.nama.toLowerCase()
    ).length;
    return {
      'ID': c.id,
      'Nama': c.nama === '-' ? '' : c.nama,
      'Perusahaan/Nama Usaha': c.perusahaan,
      'Telepon': c.telepon === '-' ? '' : c.telepon,
      'Alamat': c.alamat === '-' ? '' : c.alamat,
      'Jumlah WO': woCount,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] || {});
  autoWidth(ws, rows as Record<string, unknown>[], headers);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data Pelanggan');
  XLSX.writeFile(wb, `Pelanggan_${fileDate()}.xlsx`);
}

// ─── 7. LAPORAN LENGKAP (Multi-Sheet Workbook) ────────────────

export function exportLaporanLengkap(
  finance: FinanceTransaction[],
  workOrders: WorkOrder[],
  inventory: InventoryItem[],
  customers: Customer[],
  period?: string
): void {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Ringkasan Eksekutif ──────────────
  const trxPeriod = period ? finance.filter(t => t.tanggal.startsWith(period)) : finance;
  const pemasukan = trxPeriod.filter(t => t.nominal > 0).reduce((a, b) => a + b.nominal, 0);
  const pengeluaran = Math.abs(trxPeriod.filter(t => t.nominal < 0).reduce((a, b) => a + b.nominal, 0));
  const laba = pemasukan - pengeluaran;
  const piutangInfos = workOrders
    .filter(wo => wo.estimatedCost > 0)
    .map(wo => computeStatusBayar(wo, finance))
    .filter(i => i.status !== 'Lunas');
  const piutangTotal = piutangInfos.reduce((a, i) => a + i.sisaTagihan, 0);
  const piutangOverdueCount = piutangInfos.filter(i => i.isOverdue).length;
  const piutangOverdueTotal = piutangInfos.filter(i => i.isOverdue).reduce((a, i) => a + i.sisaTagihan, 0);

  const periodeLabel = period ? monthLabel(period) : 'Semua Periode';
  const summaryData = [
    ['LAPORAN KEUANGAN CV ALTRO SERVICE'],
    ['Periode:', periodeLabel],
    ['Dicetak:', new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
    [],
    ['RINGKASAN KEUANGAN', ''],
    ['Total Pemasukan', pemasukan],
    ['Total Pengeluaran', pengeluaran],
    ['Laba Bersih', laba],
    ['Piutang Belum Lunas', piutangTotal],
    ['  ↳ WO Lewat Jatuh Tempo', piutangOverdueCount],
    ['  ↳ Nilai Lewat Tempo', piutangOverdueTotal],
    [],
    ['RINGKASAN OPERASIONAL', ''],
    ['Total Work Order', workOrders.length],
    ['WO Aktif', workOrders.filter(w => !['Finished', 'Picked Up'].includes(w.status)).length],
    ['WO Selesai', workOrders.filter(w => ['Finished', 'Picked Up'].includes(w.status)).length],
    ['Total Item Stok', inventory.length],
    ['Stok Kritis', inventory.filter(i => i.stok <= i.batasMinimum).length],
    ['Total Pelanggan', customers.length],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // ── Sheet 2: Buku Kas (periode) ───────────────
  const trxSorted = [...trxPeriod].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  let running = 0;
  const kasRows = trxSorted.map(t => {
    running += t.nominal;
    return {
      'ID': t.id, 'Tanggal': t.tanggal, 'Kategori': t.kategori,
      'Sub-Kategori': t.subKategori || '-', 'Deskripsi': t.deskripsi,
      'Nominal (Rp)': t.nominal, 'Saldo Berjalan (Rp)': running,
    };
  });
  const wsKas = XLSX.utils.json_to_sheet(kasRows);
  wsKas['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 40 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsKas, 'Buku Kas');

  // ── Sheet 3: Laporan Bulanan ──────────────────
  const monthSet = new Set<string>();
  finance.forEach(t => monthSet.add(t.tanggal.slice(0, 7)));
  const bulanRows = Array.from(monthSet).sort().map(m => {
    const mt = finance.filter(t => t.tanggal.startsWith(m));
    const p = mt.filter(t => t.nominal > 0).reduce((a, b) => a + b.nominal, 0);
    const pg = Math.abs(mt.filter(t => t.nominal < 0).reduce((a, b) => a + b.nominal, 0));
    return { 'Periode': monthLabel(m), 'Pemasukan (Rp)': p, 'Pengeluaran (Rp)': pg, 'Laba Bersih (Rp)': p - pg };
  });
  const wsBulan = XLSX.utils.json_to_sheet(bulanRows);
  wsBulan['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsBulan, 'Laporan Bulanan');

  // ── Sheet 4: Piutang ──────────────────────────
  const piRows = workOrders
    .filter(wo => wo.estimatedCost > 0)
    .map(wo => ({ wo, info: computeStatusBayar(wo, finance) }))
    .filter(({ info }) => info.status !== 'Lunas')
    .sort((a, b) => {
      if (a.info.isOverdue !== b.info.isOverdue) return a.info.isOverdue ? -1 : 1;
      return b.info.sisaTagihan - a.info.sisaTagihan;
    })
    .map(({ wo, info }) => {
      const terminLabel = (wo.terminHari ?? 0) === 0 ? 'COD' : `NET ${wo.terminHari}`;
      const aging =
        info.isOverdue && info.hariKeJatuhTempo != null
          ? `Lewat ${Math.abs(info.hariKeJatuhTempo)} hari`
          : info.hariKeJatuhTempo != null
          ? `${info.hariKeJatuhTempo} hari lagi`
          : '-';
      return {
        'No. WO': wo.id, 'Pelanggan': wo.customer, 'Merk': wo.merk,
        'Tgl Masuk': wo.dateIn,
        'Termin': terminLabel,
        'Tgl Invoice': wo.tanggalInvoice ?? '-',
        'Jatuh Tempo': info.jatuhTempo ?? '-',
        'Aging': aging,
        'Total Tagihan': Math.max((wo.estimatedCost || 0) - (wo.diskon || 0), 0),
        'Sudah Bayar': info.totalBayar, 'Sisa Tagihan': info.sisaTagihan,
        'Status': info.status,
        'Lewat Tempo?': info.isOverdue ? 'YA' : '',
      };
    });
  const wsPiutang = XLSX.utils.json_to_sheet(piRows.length ? piRows : [{ 'Info': 'Tidak ada piutang' }]);
  wsPiutang['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 24 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPiutang, 'Piutang');

  // ── Sheet 5: Work Orders ──────────────────────
  const woRows = [...workOrders].sort((a, b) => b.dateIn.localeCompare(a.dateIn)).map(wo => {
    const info = computeStatusBayar(wo, finance);
    const terminLabel = (wo.terminHari ?? 0) === 0 ? 'COD' : `NET ${wo.terminHari}`;
    return {
      'No. WO': wo.id, 'Tgl Masuk': wo.dateIn, 'Pelanggan': wo.customer,
      'Qty': wo.qty ?? 1, 'Satuan': wo.qtySatuan || 'UNIT',
      'Merk': wo.merk, 'Deskripsi': wo.capacity, 'Keluhan': wo.keluhan,
      'Status': wo.status, 'Teknisi': wo.technician, 'Est. Selesai': wo.estimasiSelesai,
      'Est. Biaya (Rp)': wo.estimatedCost,
      'Termin': terminLabel,
      'Tgl Invoice': wo.tanggalInvoice ?? '-',
      'Jatuh Tempo': info.jatuhTempo ?? '-',
      'Status Bayar': info.status,
      'Lewat Tempo?': info.isOverdue ? 'YA' : '',
    };
  });
  const wsWo = XLSX.utils.json_to_sheet(woRows);
  wsWo['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 16 }, { wch: 30 },
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsWo, 'Work Orders');

  // ── Sheet 6: Inventori ────────────────────────
  const invRows = [...inventory].sort((a, b) => a.nama.localeCompare(b.nama)).map(item => ({
    'Nama Item': item.nama, 'Stok': item.stok, 'Satuan': item.satuan,
    'Batas Min': item.batasMinimum,
    'Status': item.stok === 0 ? 'HABIS' : item.stok <= item.batasMinimum ? 'KRITIS' : 'AMAN',
    'Harga Beli (Rp)': item.hargaBeli, 'Harga Jual (Rp)': item.hargaJual,
    'Nilai Stok (Rp)': item.stok * item.hargaBeli,
  }));
  const wsInv = XLSX.utils.json_to_sheet(invRows);
  wsInv['!cols'] = [{ wch: 32 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsInv, 'Inventori');

  const filename = period
    ? `LaporanLengkap_${period}_${fileDate()}.xlsx`
    : `LaporanLengkap_${fileDate()}.xlsx`;
  XLSX.writeFile(wb, filename);
}
