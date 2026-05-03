/**
 * db.ts — Semua operasi CRUD ke Supabase
 * Dipanggil dari useStore.ts setelah update state lokal
 *
 * PENTING: Supabase JS v2 menggunakan lazy evaluation.
 * Query TIDAK terkirim kecuali promise di-consume (.then/await).
 * Gunakan fungsi exec() untuk semua operasi agar request terkirim.
 */
import { supabase } from './supabase';
import { toast } from './toast';
import type {
  WorkOrder, InventoryItem, FinanceTransaction,
  BomItem, ServiceItem, Customer, BengkelSettings
} from '../store/useStore';

// ─── MAP camelCase ke snake_case (untuk DB) ──────────────────

const toDbWo = (w: WorkOrder) => ({
  id: w.id,
  customer: w.customer,
  merk: w.merk,
  capacity: w.capacity,
  keluhan: w.keluhan,
  status: w.status,
  technician: w.technician,
  date_in: w.dateIn || null,
  estimasi_selesai: w.estimasiSelesai,
  estimated_cost: w.estimatedCost,
  diskon: w.diskon ?? 0,
});

const fromDbWo = (r: Record<string, unknown>): WorkOrder => ({
  id: r.id as string,
  customer: r.customer as string,
  merk: r.merk as string,
  capacity: r.capacity as string,
  keluhan: r.keluhan as string,
  status: r.status as string,
  technician: r.technician as string,
  dateIn: r.date_in as string,
  estimasiSelesai: r.estimasi_selesai as string,
  estimatedCost: r.estimated_cost as number,
  diskon: (r.diskon as number | null) ?? 0,
});

const toDbInv = (i: InventoryItem) => ({
  id: i.id,
  nama: i.nama,
  stok: i.stok,
  satuan: i.satuan,
  batas_minimum: i.batasMinimum,
  harga_beli: i.hargaBeli,
  harga_jual: i.hargaJual,
});

const fromDbInv = (r: Record<string, unknown>): InventoryItem => ({
  id: r.id as string,
  nama: r.nama as string,
  stok: r.stok as number,
  satuan: r.satuan as string,
  batasMinimum: r.batas_minimum as number,
  hargaBeli: r.harga_beli as number,
  hargaJual: r.harga_jual as number,
});

const toDbFin = (f: FinanceTransaction) => ({
  id: f.id,
  tanggal: f.tanggal,
  kategori: f.kategori,
  sub_kategori: f.subKategori || null,
  deskripsi: f.deskripsi,
  nominal: f.nominal,
  catatan: f.catatan || null,
  is_rutin: f.isRutin || false,
});

const fromDbFin = (r: Record<string, unknown>): FinanceTransaction => ({
  id: r.id as string,
  tanggal: r.tanggal as string,
  kategori: r.kategori as string,
  subKategori: r.sub_kategori as string | undefined,
  deskripsi: r.deskripsi as string,
  nominal: r.nominal as number,
  catatan: r.catatan as string | undefined,
  isRutin: r.is_rutin as boolean | undefined,
});

const toDbBom = (b: BomItem) => ({
  id: b.id,
  wo_id: b.woId,
  barang: b.barang,
  stok: b.stok,
  jumlah: b.jumlah,
  satuan: b.satuan,
  harga: b.harga,
});

const fromDbBom = (r: Record<string, unknown>): BomItem => ({
  id: r.id as string,
  woId: r.wo_id as string,
  barang: r.barang as string,
  stok: r.stok as number,
  jumlah: r.jumlah as number,
  satuan: r.satuan as string,
  harga: r.harga as number,
});

const toDbSvc = (s: ServiceItem) => ({
  id: s.id,
  wo_id: s.woId,
  deskripsi: s.deskripsi,
  biaya: s.biaya,
});

const fromDbSvc = (r: Record<string, unknown>): ServiceItem => ({
  id: r.id as string,
  woId: r.wo_id as string,
  deskripsi: r.deskripsi as string,
  biaya: r.biaya as number,
});

const toDbSettings = (s: BengkelSettings) => ({
  id: 'bengkel',
  nama_bengkel: s.namaBengkel,
  alamat: s.alamat,
  kota: s.kota,
  telepon: s.telepon,
  hp: s.hp,
  email: s.email,
  npwp: s.npwp,
  nama_pemilik: s.namaPemilik,
  jabatan_pemilik: s.jabatanPemilik,
});

const fromDbSettings = (r: Record<string, unknown>): BengkelSettings => ({
  namaBengkel: (r.nama_bengkel as string) ?? '',
  alamat: (r.alamat as string) ?? '',
  kota: (r.kota as string) ?? '',
  telepon: (r.telepon as string) ?? '',
  hp: (r.hp as string) ?? '',
  email: (r.email as string) ?? '',
  npwp: (r.npwp as string) ?? '',
  namaPemilik: (r.nama_pemilik as string) ?? '',
  jabatanPemilik: (r.jabatan_pemilik as string) ?? '',
});

const toDbCus = (c: Customer) => ({
  id: c.id,
  nama: c.nama,
  perusahaan: c.perusahaan,
  telepon: c.telepon,
  alamat: c.alamat,
  total_wo: c.totalWo,
});

const fromDbCus = (r: Record<string, unknown>): Customer => ({
  id: r.id as string,
  nama: r.nama as string,
  perusahaan: r.perusahaan as string,
  telepon: r.telepon as string,
  alamat: r.alamat as string,
  totalWo: r.total_wo as number,
});

// ─── CEK & SEED DATABASE ─────────────────────────────────────

/**
 * Cek apakah tabel work_orders masih kosong (pertama kali pakai).
 */
export async function isDatabaseEmpty(): Promise<boolean> {
  const { count, error } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('[DB] isDatabaseEmpty error:', error);
    return false; // Anggap tidak kosong kalau ada error
  }
  return (count ?? 0) === 0;
}

/**
 * Bulk upsert semua data ke Supabase dalam batch 100 baris per request.
 * Dipanggil sekali saja saat DB kosong (migrasi data awal).
 */
async function chunkUpsert<T>(
  table: string,
  rows: T[],
  mapper: (r: T) => object
): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK = 100;
  const mapped = rows.map(mapper);
  for (let i = 0; i < mapped.length; i += CHUNK) {
    const batch = mapped.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(batch);
    if (error) console.error(`[DB] seed ${table} batch ${i} error:`, error);
  }
}

export interface SeedData {
  workOrders: WorkOrder[];
  inventory: InventoryItem[];
  finance: FinanceTransaction[];
  boms: BomItem[];
  services: ServiceItem[];
  customers: Customer[];
}

/**
 * Seed semua tabel dari data lokal ke Supabase.
 * Urutan penting: customers & work_orders dulu (FK),
 * baru boms & services (referensi wo_id).
 */
export async function seedDatabase(data: SeedData): Promise<void> {
  console.log('[DB] Mulai seeding database ke Supabase...');

  // Tahap 1: tabel tanpa foreign key
  await Promise.all([
    chunkUpsert('customers', data.customers, toDbCus),
    chunkUpsert('inventory', data.inventory, toDbInv),
    chunkUpsert('finance', data.finance, toDbFin),
  ]);

  // Tahap 2: work_orders (butuh customers sudah ada untuk konsistensi)
  await chunkUpsert('work_orders', data.workOrders, toDbWo);

  // Tahap 3: tabel yang referensi work_orders (boms & services)
  await Promise.all([
    chunkUpsert('boms', data.boms, toDbBom),
    chunkUpsert('services', data.services, toDbSvc),
  ]);

  console.log('[DB] Seeding selesai ✓');
}

// ─── LOAD SEMUA DATA ─────────────────────────────────────────

export async function loadAllData() {
  const [wos, inv, fin, boms, svcs, cus] = await Promise.all([
    supabase.from('work_orders').select('*').order('date_in', { ascending: false }),
    supabase.from('inventory').select('*').order('nama'),
    supabase.from('finance').select('*').order('tanggal', { ascending: false }),
    supabase.from('boms').select('*'),
    supabase.from('services').select('*'),
    supabase.from('customers').select('*').order('perusahaan'),
  ]);

  return {
    workOrders: (wos.data || []).map(r => fromDbWo(r as Record<string, unknown>)),
    inventory: (inv.data || []).map(r => fromDbInv(r as Record<string, unknown>)),
    finance: (fin.data || []).map(r => fromDbFin(r as Record<string, unknown>)),
    boms: (boms.data || []).map(r => fromDbBom(r as Record<string, unknown>)),
    services: (svcs.data || []).map(r => fromDbSvc(r as Record<string, unknown>)),
    customers: (cus.data || []).map(r => fromDbCus(r as Record<string, unknown>)),
  };
}

/**
 * Load BengkelSettings dari tabel `settings` (satu baris id='bengkel').
 * Returns null jika baris belum ada (misal: Supabase baru, settings belum pernah disimpan).
 */
export async function loadSettings(): Promise<BengkelSettings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'bengkel')
    .maybeSingle();
  if (error) {
    console.error('[DB] loadSettings error:', error);
    return null;
  }
  if (!data) return null;
  return fromDbSettings(data as Record<string, unknown>);
}

// ─── HELPER: execute & log errors ────────────────────────────
// Menerima PromiseLike agar kompatibel dengan PostgrestFilterBuilder
// Versi baru: async + notifikasi toast jika gagal (tidak lagi silent)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function exec(label: string, query: PromiseLike<{ error: any }>) {
  try {
    const { error } = await Promise.resolve(query);
    if (error) {
      console.error('[DB] ' + label + ' error:', error);
      toast.error(`Gagal menyimpan data (${label}). Periksa koneksi internet.`);
    }
  } catch (err) {
    console.error('[DB] ' + label + ' exception:', err);
    toast.error('Koneksi ke database terputus. Data mungkin belum tersimpan.');
  }
}

// ─── CRUD OPERATIONS ─────────────────────────────────────────

export const db = {
  workOrders: {
    upsert: (wo: WorkOrder) =>
      exec('workOrders.upsert', supabase.from('work_orders').upsert(toDbWo(wo))),
    delete: (id: string) =>
      exec('workOrders.delete', supabase.from('work_orders').delete().eq('id', id)),
  },
  inventory: {
    upsert: (item: InventoryItem) =>
      exec('inventory.upsert', supabase.from('inventory').upsert(toDbInv(item))),
    delete: (id: string) =>
      exec('inventory.delete', supabase.from('inventory').delete().eq('id', id)),
  },
  finance: {
    upsert: (trx: FinanceTransaction) =>
      exec('finance.upsert', supabase.from('finance').upsert(toDbFin(trx))),
    delete: (id: string) =>
      exec('finance.delete', supabase.from('finance').delete().eq('id', id)),
  },
  boms: {
    upsert: (bom: BomItem) =>
      exec('boms.upsert', supabase.from('boms').upsert(toDbBom(bom))),
    delete: (id: string) =>
      exec('boms.delete', supabase.from('boms').delete().eq('id', id)),
  },
  services: {
    upsert: (svc: ServiceItem) =>
      exec('services.upsert', supabase.from('services').upsert(toDbSvc(svc))),
    delete: (id: string) =>
      exec('services.delete', supabase.from('services').delete().eq('id', id)),
  },
  customers: {
    upsert: (c: Customer) =>
      exec('customers.upsert', supabase.from('customers').upsert(toDbCus(c))),
    delete: (id: string) =>
      exec('customers.delete', supabase.from('customers').delete().eq('id', id)),
  },
  settings: {
    upsert: (s: BengkelSettings) =>
      exec('settings.upsert', supabase.from('settings').upsert(toDbSettings(s))),
  },
};
