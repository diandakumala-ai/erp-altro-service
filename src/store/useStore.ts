import { create } from 'zustand';
import { db } from '../lib/db';
import { toast } from '../lib/toast';

export interface WorkOrder {
  id: string;
  customer: string;
  merk: string;
  capacity: string;
  keluhan: string;
  status: string;
  technician: string;
  dateIn: string;
  estimasiSelesai: string;
  estimatedCost: number;
}

export interface InventoryItem {
  id: string;
  nama: string;
  stok: number;
  satuan: string;
  batasMinimum: number;
  hargaBeli: number;
  hargaJual: number;
}

export interface FinanceTransaction {
  id: string;
  tanggal: string;
  kategori: string;
  subKategori?: string;
  deskripsi: string;
  nominal: number;
  catatan?: string;
  isRutin?: boolean;
}

export type StatusBayar = 'Belum Bayar' | 'DP' | 'Lunas';

export interface PiutangInfo {
  status: StatusBayar;
  totalBayar: number;   // jumlah uang masuk yang merujuk ke WO ini
  sisaTagihan: number;  // estimatedCost - totalBayar (>= 0)
}

/**
 * Hitung status pembayaran sebuah Work Order berdasarkan transaksi finance
 * yang menyebut ID WO di deskripsinya. Tidak butuh kolom database baru —
 * cukup baca dari transaksi yang sudah ada.
 */
export const computeStatusBayar = (wo: WorkOrder, finance: FinanceTransaction[]): PiutangInfo => {
  const totalBayar = finance
    .filter(f => f.kategori === 'Pemasukan' && f.deskripsi.includes(wo.id) && f.nominal > 0)
    .reduce((sum, f) => sum + f.nominal, 0);
  const sisaTagihan = Math.max((wo.estimatedCost || 0) - totalBayar, 0);
  let status: StatusBayar;
  if (totalBayar <= 0) status = 'Belum Bayar';
  else if (totalBayar >= (wo.estimatedCost || 0)) status = 'Lunas';
  else status = 'DP';
  return { status, totalBayar, sisaTagihan };
};

export interface BomItem {
  id: string;
  woId: string;
  barang: string;
  stok: number;
  jumlah: number;
  satuan: string;
  harga: number;
}

export interface ServiceItem {
  id: string;
  woId: string;
  deskripsi: string;
  biaya: number;
}

export interface Customer {
  id: string;
  nama: string;
  perusahaan: string;
  telepon: string;
  alamat: string;
  totalWo: number;
}

export interface BengkelSettings {
  namaBengkel: string;
  alamat: string;
  kota: string;
  telepon: string;
  hp: string;
  email: string;
  npwp: string;
  namaPemilik: string;
  jabatanPemilik: string;
  logoUrl?: string;
}

const SETTINGS_KEY = 'altro_bengkel_settings';

const defaultSettings: BengkelSettings = {
  namaBengkel: 'CV ALTRO SERVICE',
  alamat: 'Jl. Pemudi No. 8A, Payung Sekaki',
  kota: 'Pekanbaru, Riau',
  telepon: '0761-8405083',
  hp: '0812668188',
  email: 'altroservice1@gmail.com',
  npwp: '',
  namaPemilik: '',
  jabatanPemilik: 'Pimpinan',
};

export function loadBengkelSettings(): BengkelSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return defaultSettings;
}

export function saveBengkelSettings(s: BengkelSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

interface AppState {
  workOrders: WorkOrder[];
  inventory: InventoryItem[];
  finance: FinanceTransaction[];
  boms: BomItem[];
  services: ServiceItem[];
  customers: Customer[];
  bengkelSettings: BengkelSettings;

  isLoading: boolean;
  // Hydrate seluruh store dari Supabase
  setAllData: (d: Partial<AppState>) => void;
  // Update settings (persisted to localStorage)
  updateBengkelSettings: (s: BengkelSettings) => void;

  // Actions
  updateWorkOrder: (wo: WorkOrder) => void;
  addWorkOrder: (wo: WorkOrder) => void;
  deleteWorkOrder: (id: string) => void;
  updateInventory: (item: InventoryItem) => void;
  addInventory: (item: InventoryItem) => void;
  deleteInventory: (id: string) => void;
  updateFinance: (trx: FinanceTransaction) => void;
  addFinance: (trx: FinanceTransaction) => void;
  deleteFinance: (id: string) => void;
  updateBom: (bom: BomItem) => void;
  addBom: (bom: BomItem) => void;
  removeBom: (id: string) => void;
  updateService: (svc: ServiceItem) => void;
  addService: (svc: ServiceItem) => void;
  removeService: (id: string) => void;
  updateCustomer: (c: Customer) => void;
  addCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
}


// ─── SEED DATA ─────────────────────────────────────────────────────────────
// Data historis sudah ada di Supabase. Array di bawah dikosongkan agar tidak
// membengkakkan bundle JS. Data di-load dari Supabase saat app init (loadAllData).
// Jika perlu deploy ulang ke Supabase baru, gunakan SQL di AUDIT & DEPLOY PLAN.md
const initialWorkOrders: WorkOrder[] = [];
const _legacyWorkOrders: WorkOrder[] = [
  { id: 'WO-2601-036', customer: 'ASIN PEMUDA', merk: 'DINAMO GERBOX', capacity: '0,4 KW / 0,5 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 625000 },
  { id: 'WO-2601-037', customer: 'ASIN PEMUDA', merk: 'DINAMO GERBOX', capacity: '0,4 KW / 0,5 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 475000 },
  { id: 'WO-2601-038', customer: 'ASIN PEMUDA', merk: 'ELEKTROMOTOR', capacity: '0,75 KW / 1 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 550000 },
  { id: 'WO-2601-039', customer: 'ASIN PEMUDA', merk: 'ELEKTROMOTOR', capacity: '0,75 KW / 1 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 550000 },
  { id: 'WO-2601-040', customer: 'ASIN PEMUDA', merk: 'ELEKTROMOTOR', capacity: '15 KW / 20 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 2900000 },
  { id: 'WO-2601-041', customer: 'ASIN PEMUDA', merk: 'ELEKTROMOTOR', capacity: '55 KW / 60 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 8700000 },
  { id: 'WO-2601-042', customer: 'ASIN PEMUDA', merk: 'HOUSKREAN', capacity: '0,4 KW / 0,5 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 475000 },
  { id: 'WO-2601-043', customer: 'ASIN PEMUDA', merk: 'ELEKTROMOTOR', capacity: '15 KW / 20 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 2900000 },
  { id: 'WO-2601-045', customer: 'BAPAK ADI SEI PAKNING', merk: 'POMPA AIR SHIMIZU', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 275000 },
  { id: 'WO-2601-048', customer: 'BAPAK RIO', merk: 'ELEKTROMOTOR', capacity: '1,5 KW / 2 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-07', estimasiSelesai: '2025-01-07', estimatedCost: 1050000 },
  { id: 'WO-2601-049', customer: 'BAPAK RIO', merk: 'ELEKTROMOTOR', capacity: '15 KW / 20 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-07', estimasiSelesai: '2025-01-07', estimatedCost: 3780000 },
  { id: 'WO-2601-063', customer: 'BAPAK ERWIN PALAS', merk: 'TRAFO LAS REDBO 400', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-21', estimasiSelesai: '2025-01-21', estimatedCost: 700000 },
  { id: 'WO-2601-082', customer: 'BAPAK ERWIN PALAS', merk: 'TRAF LAS REDBO 400', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-27', estimasiSelesai: '2025-01-27', estimatedCost: 800000 },
  { id: 'WO-2601-083', customer: 'BAPAK ERWIN PALAS', merk: '-', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-28', estimasiSelesai: '2025-01-28', estimatedCost: 7010000 },
  { id: 'WO-2601-084', customer: 'BAPAK ERWIN PALAS', merk: '-', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-28', estimasiSelesai: '2025-01-28', estimatedCost: 200000 },
  { id: 'WO-2601-035', customer: 'BAPAK HANIF', merk: 'LAS MAGNET 400 A', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-27', estimasiSelesai: '2025-01-27', estimatedCost: 1825000 },
  { id: 'WO-2601-087', customer: 'BAPAK HASAN', merk: 'TRAFO LAS REDBO CUT 60', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-29', estimasiSelesai: '2025-01-29', estimatedCost: 700000 },
  { id: 'WO-2601-056', customer: 'BAPAK JON LASIMA', merk: 'ELEKTROMOTOR', capacity: '1,5 KW / 2 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 950000 },
  { id: 'WO-2601-060', customer: 'BAPAK RIO', merk: 'ELEKTROMOTOR', capacity: '7,5 KW / 10 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 2250000 },
  { id: 'WO-2601-092', customer: 'BAPAK RIO', merk: 'ELEKTROMOTOR', capacity: '1,1KW/1,5HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-30', estimasiSelesai: '2026-01-30', estimatedCost: 1200000 },
  { id: 'WO-2601-076', customer: 'BAPAK TARMIZI', merk: 'TRAFO CAS', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-26', estimasiSelesai: '2025-01-26', estimatedCost: 250000 },
  { id: 'WO-2601-033', customer: 'PT. FAJAR', merk: 'ELEKTROMOTOR', capacity: '7,5 KW / 10 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 3200000 },
  { id: 'WO-2601-072', customer: 'SINAR JAYA', merk: 'TRAFO LAS RHINO 160', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-23', estimasiSelesai: '2025-01-23', estimatedCost: 375000 },
  { id: 'WO-2601-090', customer: 'BAPAK TONY', merk: 'ELEKTROMOTOR 1', capacity: '4HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-30', estimasiSelesai: '2025-01-30', estimatedCost: 2302000 },
  { id: 'WO-2601-050', customer: 'BBJ', merk: 'TRAFO LAS', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-12', estimasiSelesai: '2025-01-12', estimatedCost: 347500 },
  { id: 'WO-2601-077', customer: 'BBJ', merk: 'MESIN BOR TANGAN', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-26', estimasiSelesai: '2025-01-26', estimatedCost: 35000 },
  { id: 'WO-2601-078', customer: 'BBJ', merk: '-', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-26', estimasiSelesai: '2025-01-26', estimatedCost: 70000 },
  { id: 'WO-2601-016', customer: 'BBJ', merk: 'MESIN BOR DUDUK', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-09', estimasiSelesai: '2026-01-09', estimatedCost: 362500 },
  { id: 'WO-2601-085', customer: 'BBJ', merk: 'MESIN VIBRATOR', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-19', estimasiSelesai: '2026-01-19', estimatedCost: 206700 },
  { id: 'WO-2601-007', customer: 'SETIA BANGUN', merk: 'DINAMO LAS MAGNET 250A', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-02', estimasiSelesai: '2025-01-02', estimatedCost: 600000 },
  { id: 'WO-2601-031', customer: 'SETIA BANGUN', merk: 'KIPAS', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 950000 },
  { id: 'WO-2601-054', customer: 'CV. BAKTI INDAH JAYA', merk: 'POMPA BUBUTAN', capacity: '0,5 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-17', estimasiSelesai: '2025-01-17', estimatedCost: 550000 },
  { id: 'WO-2601-053', customer: 'SETIA BANGUN', merk: '-', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-17', estimasiSelesai: '2025-01-17', estimatedCost: 100000 },
  { id: 'WO-2601-012', customer: 'CV.CENTRAL PRATAMA KARYA', merk: 'DINAMO STATER DOSER', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 850000 },
  { id: 'WO-2601-030', customer: 'CV.CENTRAL PRATAMA KARYA', merk: 'DINAMO STATER L300', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-09', estimasiSelesai: '2026-01-09', estimatedCost: 700000 },
  { id: 'WO-2601-052', customer: 'CV.CENTRAL PRATAMA KARYA', merk: 'LAS MAGNER 250 A', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-17', estimasiSelesai: '2026-01-17', estimatedCost: 1450000 },
  { id: 'WO-2601-081', customer: 'CV.CENTRAL PRATAMA KARYA', merk: 'POMPA AIR PEDROLLO', capacity: '1HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-26', estimasiSelesai: '2026-01-26', estimatedCost: 1322000 },
  { id: 'WO-2601-051', customer: 'KARYA PEMUDA TEKNIK', merk: '-', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 1090000 },
  { id: 'WO-2601-064', customer: 'PAM SIAK', merk: 'POMPA', capacity: '55 KW / 75 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-21', estimasiSelesai: '2025-01-21', estimatedCost: 8610000 },
  { id: 'WO-2601-065', customer: 'PAM SIAK', merk: 'PANEL POMPA', capacity: '100 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-21', estimasiSelesai: '2025-01-21', estimatedCost: 6400000 },
  { id: 'WO-2601-067', customer: 'PAM SIAK', merk: 'ELEKTROMOTOR', capacity: '0,75 KW / 1 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-22', estimasiSelesai: '2025-01-22', estimatedCost: 3568000 },
  { id: 'WO-2601-089', customer: 'PAM SIAK', merk: 'POMPA EBARA 20LTR/DTK', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-31', estimasiSelesai: '2025-01-31', estimatedCost: 6410000 },
  { id: 'WO-2601-010', customer: 'BAPAK ELVIN', merk: 'ELEKTROMOTOR', capacity: '0,75KW/1HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 9882000 },
  { id: 'WO-2601-008', customer: 'PT.INTI INDOKOMP', merk: 'ELEKTROMOTOR', capacity: '18,5KW/25HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 5660000 },
  { id: 'WO-2601-009', customer: 'PT.INTI INDOKOMP', merk: 'MESIN BOR', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 100000 },
  { id: 'WO-2601-004', customer: 'PT.MAKMUR ANDALAN SAWIT', merk: 'TRAFO LAS ZX7 200', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 450000 },
  { id: 'WO-2601-005', customer: 'PT.PALMA MAS SEJATI', merk: 'DINAMO STATER PORKLIP', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 1100000 },
  { id: 'WO-2601-006', customer: 'PT.MAKMUR ANDALAN SAWIT', merk: 'TRAFO LAS WELDTEX500A', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 5000000 },
  { id: 'WO-2601-059', customer: 'RS. PRIMA', merk: 'POMPA CELUP', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-15', estimasiSelesai: '2025-01-15', estimatedCost: 1075000 },
  { id: 'WO-2601-046', customer: 'SETIA BANGUN', merk: 'LAS MAGNET 250 A', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-12', estimasiSelesai: '2025-01-12', estimatedCost: 450000 },
  { id: 'WO-2601-073', customer: 'SETIA BANGUN', merk: 'TRAFO LAS REDBO MMA 400', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-01-23', estimasiSelesai: '2025-01-23', estimatedCost: 800000 },
  { id: 'WO-2601-027', customer: 'SUPERTON', merk: 'POMPA AIR JETPUMP', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 1639000 },
  { id: 'WO-2511-014', customer: 'SINAR JAYA', merk: 'TRAFO LAS MEGATECH MMA 400', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-11-06', estimasiSelesai: '2025-11-06', estimatedCost: 850000 },
  { id: 'WO-2511-020', customer: 'SINAR JAYA', merk: 'TRAFO LAS CALDWELL CUT 130', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-11-07', estimasiSelesai: '2025-11-07', estimatedCost: 1300000 },
  { id: 'WO-2511-164', customer: 'PT.ADHI KARYA', merk: 'VIBRO', capacity: '0,5HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-11-29', estimasiSelesai: '2025-11-29', estimatedCost: 650000 },
  { id: 'WO-2512-048', customer: 'UD.DAYA MANDIRI SEJATI', merk: 'GENERATOR', capacity: '20KW', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2025-12-30', estimasiSelesai: '2025-12-30', estimatedCost: 5500000 },
  { id: 'WO-2501-003', customer: 'UD.DAYA MANDIRI SEJATI', merk: '-', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-02', estimasiSelesai: '2026-01-02', estimatedCost: 1000000 },
  { id: 'WO-2601-001', customer: 'PT.UKM', merk: 'POMPA CELUP', capacity: '15HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 6340000 },
  { id: 'WO-2601-002', customer: 'PT.UKM', merk: 'POMPA CELUP', capacity: '15HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 5990000 },
  { id: 'WO-2601-020', customer: 'PT.UKM', merk: 'POMPA EBARA LEESONMECH', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 2838000 },
  { id: 'WO-2601-021', customer: 'PT.UKM', merk: 'TRAFO LAS ZX6-500 WELDTECO', capacity: '-', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 3450000 },
  { id: 'WO-2601-022', customer: 'PT.UKM', merk: 'POMPA CELUP', capacity: '2 HP', keluhan: 'Servis Berkala', status: 'Finished', technician: '-', dateIn: '2026-01-15', estimasiSelesai: '2026-01-15', estimatedCost: 2095000 },
];

const initialInventory: InventoryItem[] = [];
const _legacyInventory: InventoryItem[] = [
  { id: 'SKU-001', nama: 'ARANG - ARANG', stok: 0, satuan: 'SET', batasMinimum: 5, hargaBeli: 26250, hargaJual: 35000 },
  { id: 'SKU-002', nama: 'BAUT STAINLESS', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 37500, hargaJual: 50000 },
  { id: 'SKU-003', nama: 'BAUT-BAUT', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 12000, hargaJual: 16000 },
  { id: 'SKU-004', nama: 'BEARING 6005', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-005', nama: 'BEARING 608', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 37500, hargaJual: 50000 },
  { id: 'SKU-006', nama: 'BEARING 6201', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 37500, hargaJual: 50000 },
  { id: 'SKU-007', nama: 'BEARING 6202', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 42750, hargaJual: 57000 },
  { id: 'SKU-008', nama: 'BEARING 6203', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 45750, hargaJual: 61000 },
  { id: 'SKU-009', nama: 'BEARING 6204', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 52500, hargaJual: 70000 },
  { id: 'SKU-010', nama: 'BEARING 6204 (SKF)', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 63000, hargaJual: 84000 },
  { id: 'SKU-011', nama: 'BEARING 6205', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 57000, hargaJual: 76000 },
  { id: 'SKU-012', nama: 'BEARING 6305', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 112500, hargaJual: 150000 },
  { id: 'SKU-013', nama: 'BEARING 6306 SKF', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 161250, hargaJual: 215000 },
  { id: 'SKU-014', nama: 'BEARING 6307', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 141000, hargaJual: 188000 },
  { id: 'SKU-015', nama: 'BEARING 6308', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 172500, hargaJual: 230000 },
  { id: 'SKU-016', nama: 'BEARING 6309', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 210000, hargaJual: 280000 },
  { id: 'SKU-017', nama: 'BEARING 6310', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 216000, hargaJual: 288000 },
  { id: 'SKU-018', nama: 'BEARING 6310 ( SKF )', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 513750, hargaJual: 685000 },
  { id: 'SKU-019', nama: 'BEARING UFC205', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 63750, hargaJual: 85000 },
  { id: 'SKU-020', nama: 'BENDIT', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 487500, hargaJual: 650000 },
  { id: 'SKU-021', nama: 'BENSIN', stok: 0, satuan: 'LTR', batasMinimum: 5, hargaBeli: 9000, hargaJual: 12000 },
  { id: 'SKU-022', nama: 'BLOK KEDUDUKAN BEARING', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 360000, hargaJual: 480000 },
  { id: 'SKU-023', nama: 'BOX TERMINAL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-024', nama: 'BUBUT AS BEARING', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 150000, hargaJual: 200000 },
  { id: 'SKU-025', nama: 'BUBUT AS IMPELER', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 262500, hargaJual: 350000 },
  { id: 'SKU-026', nama: 'BUBUT IMPELER', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 112500, hargaJual: 150000 },
  { id: 'SKU-027', nama: 'BUBUT KEDUDUKAN SEAL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 150000, hargaJual: 200000 },
  { id: 'SKU-028', nama: 'BUSHING', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 56250, hargaJual: 75000 },
  { id: 'SKU-029', nama: 'CAPASITOR', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 60000, hargaJual: 80000 },
  { id: 'SKU-030', nama: 'CAPASITOR 10UF', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 37500, hargaJual: 50000 },
  { id: 'SKU-031', nama: 'CAPASITOR 8 UF', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 56250, hargaJual: 75000 },
  { id: 'SKU-032', nama: 'COK', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 11250, hargaJual: 15000 },
  { id: 'SKU-033', nama: 'CONTACTOR LC109', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 270000, hargaJual: 360000 },
  { id: 'SKU-034', nama: 'CONTACTOR LC1D80', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 2362500, hargaJual: 3150000 },
  { id: 'SKU-035', nama: 'CONTECTOR NXC 12 220V CHNT', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 157500, hargaJual: 210000 },
  { id: 'SKU-036', nama: 'DIODA 4 KAKI BESAR', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-037', nama: 'DIODA OUTPUT', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 300000, hargaJual: 400000 },
  { id: 'SKU-038', nama: 'DIODA P. ATAS', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 56250, hargaJual: 75000 },
  { id: 'SKU-039', nama: 'DIODA PANAH ATAS', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 56250, hargaJual: 75000 },
  { id: 'SKU-040', nama: 'DIODA PANAH BAWAH', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 56250, hargaJual: 75000 },
  { id: 'SKU-041', nama: 'DOUBLE MECHANICAL SEAL AS 45 MM', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 1282500, hargaJual: 1710000 },
  { id: 'SKU-042', nama: 'EROPLUG', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 525000, hargaJual: 700000 },
  { id: 'SKU-043', nama: 'IC CONTROL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 1012500, hargaJual: 1350000 },
  { id: 'SKU-044', nama: 'KABEL', stok: 0, satuan: 'MTR', batasMinimum: 5, hargaBeli: 15000, hargaJual: 20000 },
  { id: 'SKU-045', nama: 'KABEL -  KABEL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 112500, hargaJual: 150000 },
  { id: 'SKU-046', nama: 'KABEL NYMHY 2X2,5MM', stok: 0, satuan: 'MTR', batasMinimum: 5, hargaBeli: 22500, hargaJual: 30000 },
  { id: 'SKU-047', nama: 'KARET KABEL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 187500, hargaJual: 250000 },
  { id: 'SKU-048', nama: 'KEPALA BOR', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 48750, hargaJual: 65000 },
  { id: 'SKU-049', nama: 'KIPAS', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-050', nama: 'KIPAS AS 15', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-051', nama: 'KIPAS AS 24', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-052', nama: 'KIPAS AS 43', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 187500, hargaJual: 250000 },
  { id: 'SKU-053', nama: 'KIPAS KECIL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 90000, hargaJual: 120000 },
  { id: 'SKU-054', nama: 'KIPAS SEDANG', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 262500, hargaJual: 350000 },
  { id: 'SKU-055', nama: 'KLEM KABEL NO.10', stok: 0, satuan: 'BKS', batasMinimum: 5, hargaBeli: 30000, hargaJual: 40000 },
  { id: 'SKU-056', nama: 'LAMPU SOROT 100 WATT (OPPLE)', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 712500, hargaJual: 950000 },
  { id: 'SKU-057', nama: 'LAS BUBUT AS', stok: 0, satuan: 'TITIK', batasMinimum: 5, hargaBeli: 112500, hargaJual: 150000 },
  { id: 'SKU-058', nama: 'LAS BUBUT AS SEAL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 412500, hargaJual: 550000 },
  { id: 'SKU-059', nama: 'MECANICAL SEAL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 900000, hargaJual: 1200000 },
  { id: 'SKU-060', nama: 'MECHANICAL SEAL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 600000, hargaJual: 800000 },
  { id: 'SKU-061', nama: 'MOSFET', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 337500, hargaJual: 450000 },
  { id: 'SKU-062', nama: 'OLI', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 37500, hargaJual: 50000 },
  { id: 'SKU-063', nama: 'ORING SEAL', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 37500, hargaJual: 50000 },
  { id: 'SKU-064', nama: 'OTOMATIS', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 337500, hargaJual: 450000 },
  { id: 'SKU-065', nama: 'OVERLOAD LRD3365', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 1425000, hargaJual: 1900000 },
  { id: 'SKU-066', nama: 'PAKING', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 18750, hargaJual: 25000 },
  { id: 'SKU-067', nama: 'PERBAIKAN RADIATOR', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 637500, hargaJual: 850000 },
  { id: 'SKU-068', nama: 'PERBOSH', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-069', nama: 'PERBOSH 608', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-070', nama: 'PERBOSH 6201', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 112500, hargaJual: 150000 },
  { id: 'SKU-071', nama: 'PERBOSH 6205', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 112500, hargaJual: 150000 },
  { id: 'SKU-072', nama: 'PERBOSH 6305', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 127500, hargaJual: 170000 },
  { id: 'SKU-073', nama: 'PERBOSH 6309', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 225000, hargaJual: 300000 },
  { id: 'SKU-074', nama: 'PERBOSH 6310', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 225000, hargaJual: 300000 },
  { id: 'SKU-075', nama: 'PERBOSH KEDUDUKAN LAHAR LUAR DALAM', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 997500, hargaJual: 1330000 },
  { id: 'SKU-076', nama: 'PHOTO CELL 10 A', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 60000, hargaJual: 80000 },
  { id: 'SKU-077', nama: 'POMPA DIAMETER AS 40MM X 45CM', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 1275000, hargaJual: 1700000 },
  { id: 'SKU-078', nama: 'RC SNUBER', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 600000, hargaJual: 800000 },
  { id: 'SKU-079', nama: 'REKONDISI AS POMPA 65 MM X 60 CM', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 487500, hargaJual: 650000 },
  { id: 'SKU-080', nama: 'SEAL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 187500, hargaJual: 250000 },
  { id: 'SKU-081', nama: 'SEAL DEBU', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-082', nama: 'SEAL(DOUBLE SEAL)', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 637500, hargaJual: 850000 },
  { id: 'SKU-083', nama: 'TERMINAL', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 75000, hargaJual: 100000 },
  { id: 'SKU-084', nama: 'TERMINAL LRD14', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 341250, hargaJual: 455000 },
  { id: 'SKU-085', nama: 'TIMER H3CR A8 220 V', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 262500, hargaJual: 350000 },
  { id: 'SKU-086', nama: 'TUTUP DINAMO', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 487500, hargaJual: 650000 },
  { id: 'SKU-087', nama: 'TUTUP KIPAS', stok: 0, satuan: 'UNIT', batasMinimum: 5, hargaBeli: 150000, hargaJual: 200000 },
  { id: 'SKU-088', nama: 'TUTUP KIPAS UK. Y 100 (DIAMETER : 190 MM, TINGGI : 90 MM)', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 112500, hargaJual: 150000 },
  { id: 'SKU-089', nama: 'TUTUP KIPAS UK. Y 112 (DIAMETER : 220 MM, TINGGI : 100 MM)', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 157500, hargaJual: 210000 },
  { id: 'SKU-090', nama: 'TUTUP KIPAS UK. Y 90 (DIAMETER : 175 MM, TINGGI : 90 MM)', stok: 0, satuan: 'PCS', batasMinimum: 5, hargaBeli: 90000, hargaJual: 120000 },
];

const initialFinance: FinanceTransaction[] = [];
const _legacyFinance: FinanceTransaction[] = [
  { id: 'TRX-0001', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-036 (ASIN PEMUDA)', nominal: 625000 },
  { id: 'TRX-0002', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-037 (ASIN PEMUDA)', nominal: 475000 },
  { id: 'TRX-0003', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-038 (ASIN PEMUDA)', nominal: 550000 },
  { id: 'TRX-0004', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-039 (ASIN PEMUDA)', nominal: 550000 },
  { id: 'TRX-0005', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-040 (ASIN PEMUDA)', nominal: 2900000 },
  { id: 'TRX-0006', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-041 (ASIN PEMUDA)', nominal: 8700000 },
  { id: 'TRX-0007', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-042 (ASIN PEMUDA)', nominal: 475000 },
  { id: 'TRX-0008', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-043 (ASIN PEMUDA)', nominal: 2900000 },
  { id: 'TRX-0009', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-045 (BAPAK ADI SEI PAKNING)', nominal: 275000 },
  { id: 'TRX-0010', tanggal: '2025-01-07', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-048 (BAPAK RIO)', nominal: 1050000 },
  { id: 'TRX-0011', tanggal: '2025-01-07', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-049 (BAPAK RIO)', nominal: 3780000 },
  { id: 'TRX-0012', tanggal: '2025-01-21', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-063 (BAPAK ERWIN PALAS)', nominal: 700000 },
  { id: 'TRX-0013', tanggal: '2025-01-27', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-082 (BAPAK ERWIN PALAS)', nominal: 800000 },
  { id: 'TRX-0014', tanggal: '2025-01-28', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-083 (BAPAK ERWIN PALAS)', nominal: 7010000 },
  { id: 'TRX-0015', tanggal: '2025-01-28', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-084 (BAPAK ERWIN PALAS)', nominal: 200000 },
  { id: 'TRX-0016', tanggal: '2025-01-27', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-035 (BAPAK HANIF)', nominal: 1825000 },
  { id: 'TRX-0017', tanggal: '2025-01-29', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-087 (BAPAK HASAN)', nominal: 700000 },
  { id: 'TRX-0018', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-056 (BAPAK JON LASIMA)', nominal: 950000 },
  { id: 'TRX-0019', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-060 (BAPAK RIO)', nominal: 2250000 },
  { id: 'TRX-0020', tanggal: '2026-01-30', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-092 (BAPAK RIO)', nominal: 1200000 },
  { id: 'TRX-0021', tanggal: '2025-01-26', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-076 (BAPAK TARMIZI)', nominal: 250000 },
  { id: 'TRX-0022', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-033 (PT. FAJAR)', nominal: 3200000 },
  { id: 'TRX-0023', tanggal: '2025-01-23', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-072 (SINAR JAYA)', nominal: 375000 },
  { id: 'TRX-0024', tanggal: '2025-01-30', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-090 (BAPAK TONY)', nominal: 2302000 },
  { id: 'TRX-0025', tanggal: '2025-01-12', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-050 (BBJ)', nominal: 347500 },
  { id: 'TRX-0026', tanggal: '2025-01-26', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-077 (BBJ)', nominal: 35000 },
  { id: 'TRX-0027', tanggal: '2025-01-26', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-078 (BBJ)', nominal: 70000 },
  { id: 'TRX-0028', tanggal: '2026-01-09', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-016 (BBJ)', nominal: 362500 },
  { id: 'TRX-0029', tanggal: '2026-01-19', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-085 (BBJ)', nominal: 206700 },
  { id: 'TRX-0030', tanggal: '2025-01-02', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-007 (SETIA BANGUN)', nominal: 600000 },
  { id: 'TRX-0031', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-031 (SETIA BANGUN)', nominal: 950000 },
  { id: 'TRX-0032', tanggal: '2025-01-17', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-054 (CV. BAKTI INDAH JAYA)', nominal: 550000 },
  { id: 'TRX-0033', tanggal: '2025-01-17', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-053 (SETIA BANGUN)', nominal: 100000 },
  { id: 'TRX-0034', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-012 (CV.CENTRAL PRATAMA KARYA)', nominal: 850000 },
  { id: 'TRX-0035', tanggal: '2026-01-09', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-030 (CV.CENTRAL PRATAMA KARYA)', nominal: 700000 },
  { id: 'TRX-0036', tanggal: '2026-01-17', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-052 (CV.CENTRAL PRATAMA KARYA)', nominal: 1450000 },
  { id: 'TRX-0037', tanggal: '2026-01-26', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-081 (CV.CENTRAL PRATAMA KARYA)', nominal: 1322000 },
  { id: 'TRX-0038', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-051 (KARYA PEMUDA TEKNIK)', nominal: 1090000 },
  { id: 'TRX-0039', tanggal: '2025-01-21', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-064 (PAM SIAK)', nominal: 8610000 },
  { id: 'TRX-0040', tanggal: '2025-01-21', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-065 (PAM SIAK)', nominal: 6400000 },
  { id: 'TRX-0041', tanggal: '2025-01-22', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-067 (PAM SIAK)', nominal: 3568000 },
  { id: 'TRX-0042', tanggal: '2025-01-31', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-089 (PAM SIAK)', nominal: 6410000 },
  { id: 'TRX-0043', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-010 (BAPAK ELVIN)', nominal: 9882000 },
  { id: 'TRX-0044', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-008 (PT.INTI INDOKOMP)', nominal: 5660000 },
  { id: 'TRX-0045', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-009 (PT.INTI INDOKOMP)', nominal: 100000 },
  { id: 'TRX-0046', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-004 (PT.MAKMUR ANDALAN SAWIT)', nominal: 450000 },
  { id: 'TRX-0047', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-005 (PT.PALMA MAS SEJATI)', nominal: 1100000 },
  { id: 'TRX-0048', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-006 (PT.MAKMUR ANDALAN SAWIT)', nominal: 5000000 },
  { id: 'TRX-0049', tanggal: '2025-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-059 (RS. PRIMA)', nominal: 1075000 },
  { id: 'TRX-0050', tanggal: '2025-01-12', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-046 (SETIA BANGUN)', nominal: 450000 },
  { id: 'TRX-0051', tanggal: '2025-01-23', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-073 (SETIA BANGUN)', nominal: 800000 },
  { id: 'TRX-0052', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-027 (SUPERTON)', nominal: 1639000 },
  { id: 'TRX-0053', tanggal: '2025-11-06', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2511-014 (SINAR JAYA)', nominal: 850000 },
  { id: 'TRX-0054', tanggal: '2025-11-07', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2511-020 (SINAR JAYA)', nominal: 1300000 },
  { id: 'TRX-0055', tanggal: '2025-11-29', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2511-164 (PT.ADHI KARYA)', nominal: 650000 },
  { id: 'TRX-0056', tanggal: '2025-12-30', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2512-048 (UD.DAYA MANDIRI SEJATI)', nominal: 5500000 },
  { id: 'TRX-0057', tanggal: '2026-01-02', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2501-003 (UD.DAYA MANDIRI SEJATI)', nominal: 1000000 },
  { id: 'TRX-0058', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-001 (PT.UKM)', nominal: 6340000 },
  { id: 'TRX-0059', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-002 (PT.UKM)', nominal: 5990000 },
  { id: 'TRX-0060', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-020 (PT.UKM)', nominal: 2838000 },
  { id: 'TRX-0061', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-021 (PT.UKM)', nominal: 3450000 },
  { id: 'TRX-0062', tanggal: '2026-01-15', kategori: 'Pemasukan', subKategori: 'Pembayaran Servis', deskripsi: 'Pembayaran Servis WO-2601-022 (PT.UKM)', nominal: 2095000 },
];

const initialBoms: BomItem[] = [];
const _legacyBoms: BomItem[] = [
  { id: 'BOM-0001', woId: 'WO-2601-036', barang: 'OLI', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 50000 },
  { id: 'BOM-0002', woId: 'WO-2601-036', barang: 'KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0003', woId: 'WO-2601-045', barang: 'CAPASITOR 8 UF', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 75000 },
  { id: 'BOM-0004', woId: 'WO-2601-048', barang: 'KIPAS AS 24', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0005', woId: 'WO-2601-049', barang: 'BEARING 6309', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 280000 },
  { id: 'BOM-0006', woId: 'WO-2601-049', barang: 'SEAL DEBU', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0007', woId: 'WO-2601-063', barang: 'EROPLUG', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 700000 },
  { id: 'BOM-0008', woId: 'WO-2601-082', barang: 'RC SNUBER', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 800000 },
  { id: 'BOM-0009', woId: 'WO-2601-083', barang: 'KABEL NYMHY 2X2,5MM', stok: 0, jumlah: 50, satuan: 'MTR', harga: 30000 },
  { id: 'BOM-0010', woId: 'WO-2601-083', barang: 'PHOTO CELL 10 A', stok: 0, jumlah: 2, satuan: 'PCS', harga: 80000 },
  { id: 'BOM-0011', woId: 'WO-2601-083', barang: 'LAMPU SOROT 100 WATT (OPPLE)', stok: 0, jumlah: 3, satuan: 'PCS', harga: 950000 },
  { id: 'BOM-0012', woId: 'WO-2601-083', barang: 'CONTECTOR NXC 12 220V CHNT', stok: 0, jumlah: 1, satuan: 'PCS', harga: 210000 },
  { id: 'BOM-0013', woId: 'WO-2601-083', barang: 'KLEM KABEL NO.10', stok: 0, jumlah: 1, satuan: 'BKS', harga: 40000 },
  { id: 'BOM-0014', woId: 'WO-2601-035', barang: 'DIODA PANAH ATAS', stok: 0, jumlah: 2, satuan: 'PCS', harga: 75000 },
  { id: 'BOM-0015', woId: 'WO-2601-035', barang: 'TERMINAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0016', woId: 'WO-2601-035', barang: 'KABEL -  KABEL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 150000 },
  { id: 'BOM-0017', woId: 'WO-2601-035', barang: 'DIODA P. ATAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 75000 },
  { id: 'BOM-0018', woId: 'WO-2601-035', barang: 'TERMINAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0019', woId: 'WO-2601-035', barang: 'PERBAIKAN RADIATOR', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 850000 },
  { id: 'BOM-0020', woId: 'WO-2601-087', barang: 'IC CONTROL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 700000 },
  { id: 'BOM-0021', woId: 'WO-2601-076', barang: 'DIODA 4 KAKI BESAR', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0022', woId: 'WO-2601-072', barang: 'DIODA OUTPUT', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 400000 },
  { id: 'BOM-0023', woId: 'WO-2601-090', barang: 'BEARING 6205', stok: 0, jumlah: 2, satuan: 'PCS', harga: 76000 },
  { id: 'BOM-0024', woId: 'WO-2601-090', barang: 'CAPASITOR 10UF', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 50000 },
  { id: 'BOM-0025', woId: 'WO-2601-090', barang: 'BEARING 6201', stok: 0, jumlah: 2, satuan: 'PCS', harga: 50000 },
  { id: 'BOM-0026', woId: 'WO-2601-090', barang: 'PERBOSH 6201', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 150000 },
  { id: 'BOM-0027', woId: 'WO-2601-050', barang: 'EROPLUG', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 250000 },
  { id: 'BOM-0028', woId: 'WO-2601-077', barang: 'ARANG - ARANG', stok: 0, jumlah: 1, satuan: 'SET', harga: 35000 },
  { id: 'BOM-0029', woId: 'WO-2601-078', barang: 'ARANG - ARANG', stok: 0, jumlah: 2, satuan: 'SET', harga: 35000 },
  { id: 'BOM-0030', woId: 'WO-2601-016', barang: 'KEPALA BOR', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 65000 },
  { id: 'BOM-0031', woId: 'WO-2601-085', barang: 'BENSIN', stok: 0, jumlah: 2, satuan: 'LTR', harga: 12000 },
  { id: 'BOM-0032', woId: 'WO-2601-085', barang: 'OLI', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 38000 },
  { id: 'BOM-0033', woId: 'WO-2601-007', barang: 'DIODA PANAH ATAS', stok: 0, jumlah: 4, satuan: 'PCS', harga: 75000 },
  { id: 'BOM-0034', woId: 'WO-2601-007', barang: 'TERMINAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0035', woId: 'WO-2601-031', barang: 'BEARING 608', stok: 0, jumlah: 2, satuan: 'PCS', harga: 50000 },
  { id: 'BOM-0036', woId: 'WO-2601-031', barang: 'PERBOSH 608', stok: 0, jumlah: 2, satuan: 'PCS', harga: 100000 },
  { id: 'BOM-0037', woId: 'WO-2601-012', barang: 'BENDIT', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 650000 },
  { id: 'BOM-0038', woId: 'WO-2601-030', barang: 'BENDIT', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 350000 },
  { id: 'BOM-0039', woId: 'WO-2601-030', barang: 'BUSHING', stok: 0, jumlah: 2, satuan: 'PCS', harga: 75000 },
  { id: 'BOM-0040', woId: 'WO-2601-052', barang: 'BEARING 6305', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 150000 },
  { id: 'BOM-0041', woId: 'WO-2601-052', barang: 'PERBOSH 6305', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 170000 },
  { id: 'BOM-0042', woId: 'WO-2601-081', barang: 'BEARING 6203', stok: 0, jumlah: 2, satuan: 'PCS', harga: 61000 },
  { id: 'BOM-0043', woId: 'WO-2601-081', barang: 'SEAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 150000 },
  { id: 'BOM-0044', woId: 'WO-2601-051', barang: 'TUTUP KIPAS UK. Y 90 (DIAMETER : 175 MM, TINGGI : 90 MM)', stok: 0, jumlah: 3, satuan: 'PCS', harga: 120000 },
  { id: 'BOM-0045', woId: 'WO-2601-051', barang: 'TUTUP KIPAS UK. Y 100 (DIAMETER : 190 MM, TINGGI : 90 MM)', stok: 0, jumlah: 2, satuan: 'PCS', harga: 150000 },
  { id: 'BOM-0046', woId: 'WO-2601-051', barang: 'TUTUP KIPAS UK. Y 112 (DIAMETER : 220 MM, TINGGI : 100 MM)', stok: 0, jumlah: 2, satuan: 'PCS', harga: 210000 },
  { id: 'BOM-0047', woId: 'WO-2601-064', barang: 'REKONDISI AS POMPA 65 MM X 60 CM', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 650000 },
  { id: 'BOM-0048', woId: 'WO-2601-064', barang: 'BEARING 6310 ( SKF )', stok: 0, jumlah: 2, satuan: 'PCS', harga: 685000 },
  { id: 'BOM-0049', woId: 'WO-2601-064', barang: 'PERBOSH KEDUDUKAN LAHAR LUAR DALAM', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 1330000 },
  { id: 'BOM-0050', woId: 'WO-2601-064', barang: 'DOUBLE MECHANICAL SEAL AS 45 MM', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 1710000 },
  { id: 'BOM-0051', woId: 'WO-2601-064', barang: 'LAS BUBUT AS SEAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 550000 },
  { id: 'BOM-0052', woId: 'WO-2601-065', barang: 'TIMER H3CR A8 220 V', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 350000 },
  { id: 'BOM-0053', woId: 'WO-2601-065', barang: 'CONTACTOR LC1D80', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 3150000 },
  { id: 'BOM-0054', woId: 'WO-2601-065', barang: 'OVERLOAD LRD3365', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 1900000 },
  { id: 'BOM-0055', woId: 'WO-2601-067', barang: 'BEARING 6204 (SKF)', stok: 0, jumlah: 2, satuan: 'PCS', harga: 84000 },
  { id: 'BOM-0056', woId: 'WO-2601-067', barang: 'TUTUP KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 200000 },
  { id: 'BOM-0057', woId: 'WO-2601-067', barang: 'SEAL DEBU', stok: 0, jumlah: 2, satuan: 'PCS', harga: 50000 },
  { id: 'BOM-0058', woId: 'WO-2601-067', barang: 'BEARING UFC205', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 85000 },
  { id: 'BOM-0059', woId: 'WO-2601-067', barang: 'CONTACTOR LC109', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 360000 },
  { id: 'BOM-0060', woId: 'WO-2601-067', barang: 'TERMINAL LRD14', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 455000 },
  { id: 'BOM-0061', woId: 'WO-2601-089', barang: 'POMPA DIAMETER AS 40MM X 45CM', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 1700000 },
  { id: 'BOM-0062', woId: 'WO-2601-089', barang: 'BEARING 6306 SKF', stok: 0, jumlah: 2, satuan: 'PCS', harga: 215000 },
  { id: 'BOM-0063', woId: 'WO-2601-089', barang: 'BLOK KEDUDUKAN BEARING', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 480000 },
  { id: 'BOM-0064', woId: 'WO-2601-089', barang: 'MECHANICAL SEAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 800000 },
  { id: 'BOM-0065', woId: 'WO-2601-010', barang: 'BEARING 6205', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 76000 },
  { id: 'BOM-0066', woId: 'WO-2601-010', barang: 'TUTUP KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 200000 },
  { id: 'BOM-0067', woId: 'WO-2601-010', barang: 'BEARING 6205', stok: 0, jumlah: 2, satuan: 'PCS', harga: 76000 },
  { id: 'BOM-0068', woId: 'WO-2601-010', barang: 'SEAL DEBU', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 50000 },
  { id: 'BOM-0069', woId: 'WO-2601-010', barang: 'TUTUP KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 200000 },
  { id: 'BOM-0070', woId: 'WO-2601-010', barang: 'BAUT-BAUT', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 16000 },
  { id: 'BOM-0071', woId: 'WO-2601-010', barang: 'TUTUP DINAMO', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 650000 },
  { id: 'BOM-0072', woId: 'WO-2601-010', barang: 'KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 80000 },
  { id: 'BOM-0073', woId: 'WO-2601-010', barang: 'TUTUP KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 200000 },
  { id: 'BOM-0074', woId: 'WO-2601-010', barang: 'BEARING 6205', stok: 0, jumlah: 2, satuan: 'PCS', harga: 76000 },
  { id: 'BOM-0075', woId: 'WO-2601-010', barang: 'PERBOSH 6205', stok: 0, jumlah: 2, satuan: 'PCS', harga: 150000 },
  { id: 'BOM-0076', woId: 'WO-2601-010', barang: 'BAUT-BAUT', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 16000 },
  { id: 'BOM-0077', woId: 'WO-2601-010', barang: 'TUTUP KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 200000 },
  { id: 'BOM-0078', woId: 'WO-2601-010', barang: 'TUTUP DINAMO', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 650000 },
  { id: 'BOM-0079', woId: 'WO-2601-010', barang: 'BAUT-BAUT', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 16000 },
  { id: 'BOM-0080', woId: 'WO-2601-010', barang: 'KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 80000 },
  { id: 'BOM-0081', woId: 'WO-2601-010', barang: 'TUTUP KIPAS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 200000 },
  { id: 'BOM-0082', woId: 'WO-2601-010', barang: 'SEAL DEBU', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 50000 },
  { id: 'BOM-0083', woId: 'WO-2601-010', barang: 'BEARING 6205', stok: 0, jumlah: 2, satuan: 'PCS', harga: 76000 },
  { id: 'BOM-0084', woId: 'WO-2601-010', barang: 'BAUT-BAUT', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 16000 },
  { id: 'BOM-0085', woId: 'WO-2601-010', barang: 'BEARING 6205', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 76000 },
  { id: 'BOM-0086', woId: 'WO-2601-010', barang: 'PERBOSH 6205', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 150000 },
  { id: 'BOM-0087', woId: 'WO-2601-008', barang: 'BEARING 6309', stok: 0, jumlah: 2, satuan: 'PCS', harga: 280000 },
  { id: 'BOM-0088', woId: 'WO-2601-008', barang: 'PERBOSH 6309', stok: 0, jumlah: 2, satuan: 'PCS', harga: 300000 },
  { id: 'BOM-0089', woId: 'WO-2601-008', barang: 'KIPAS AS 43', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 250000 },
  { id: 'BOM-0090', woId: 'WO-2601-004', barang: 'MOSFET', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 450000 },
  { id: 'BOM-0091', woId: 'WO-2601-005', barang: 'OTOMATIS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 450000 },
  { id: 'BOM-0092', woId: 'WO-2601-005', barang: 'BEARING 6005', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0093', woId: 'WO-2601-005', barang: 'PERBOSH', stok: 0, jumlah: 3, satuan: 'PCS', harga: 100000 },
  { id: 'BOM-0094', woId: 'WO-2601-006', barang: 'TERMINAL', stok: 0, jumlah: 2, satuan: 'PCS', harga: 100000 },
  { id: 'BOM-0095', woId: 'WO-2601-006', barang: 'DIODA PANAH ATAS', stok: 0, jumlah: 12, satuan: 'PCS', harga: 75000 },
  { id: 'BOM-0096', woId: 'WO-2601-006', barang: 'DIODA PANAH BAWAH', stok: 0, jumlah: 12, satuan: 'PCS', harga: 75000 },
  { id: 'BOM-0097', woId: 'WO-2601-006', barang: 'KIPAS SEDANG', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 350000 },
  { id: 'BOM-0098', woId: 'WO-2601-006', barang: 'KIPAS KECIL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 120000 },
  { id: 'BOM-0099', woId: 'WO-2601-059', barang: 'BEARING 6201', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 50000 },
  { id: 'BOM-0100', woId: 'WO-2601-059', barang: 'BAUT STAINLESS', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 50000 },
  { id: 'BOM-0101', woId: 'WO-2601-059', barang: 'PAKING', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 25000 },
  { id: 'BOM-0102', woId: 'WO-2601-046', barang: 'DIODA P. ATAS', stok: 0, jumlah: 2, satuan: 'PCS', harga: 75000 },
  { id: 'BOM-0103', woId: 'WO-2601-046', barang: 'TERMINAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0104', woId: 'WO-2601-073', barang: 'IC CONTROL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 800000 },
  { id: 'BOM-0105', woId: 'WO-2601-027', barang: 'BEARING 6202', stok: 0, jumlah: 2, satuan: 'PCS', harga: 57000 },
  { id: 'BOM-0106', woId: 'WO-2601-027', barang: 'SEAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0107', woId: 'WO-2601-027', barang: 'CAPASITOR', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 80000 },
  { id: 'BOM-0108', woId: 'WO-2601-027', barang: 'KIPAS AS 15', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0109', woId: 'WO-2601-027', barang: 'KABEL', stok: 0, jumlah: 1, satuan: 'MTR', harga: 20000 },
  { id: 'BOM-0110', woId: 'WO-2601-027', barang: 'BOX TERMINAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0111', woId: 'WO-2601-027', barang: 'COK', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 15000 },
  { id: 'BOM-0112', woId: 'WO-2511-014', barang: 'IC CONTROL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 900000 },
  { id: 'BOM-0113', woId: 'WO-2511-020', barang: 'IC CONTROL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 1350000 },
  { id: 'BOM-0114', woId: 'WO-2511-164', barang: 'BEARING 6305', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 150000 },
  { id: 'BOM-0115', woId: 'WO-2511-164', barang: 'BUBUT AS BEARING', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 200000 },
  { id: 'BOM-0116', woId: 'WO-2601-001', barang: 'SEAL(DOUBLE SEAL)', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 850000 },
  { id: 'BOM-0117', woId: 'WO-2601-001', barang: 'BEARING 6307', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 188000 },
  { id: 'BOM-0118', woId: 'WO-2601-001', barang: 'BEARING 6310', stok: 0, jumlah: 2, satuan: 'PCS', harga: 288000 },
  { id: 'BOM-0119', woId: 'WO-2601-001', barang: 'ORING SEAL', stok: 0, jumlah: 4, satuan: 'PCS', harga: 50000 },
  { id: 'BOM-0120', woId: 'WO-2601-001', barang: 'OLI', stok: 0, jumlah: 2, satuan: 'LTR', harga: 38000 },
  { id: 'BOM-0121', woId: 'WO-2601-001', barang: 'BUBUT AS IMPELER', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 350000 },
  { id: 'BOM-0122', woId: 'WO-2601-001', barang: 'BUBUT KEDUDUKAN SEAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 200000 },
  { id: 'BOM-0123', woId: 'WO-2601-001', barang: 'PERBOSH 6310', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 300000 },
  { id: 'BOM-0124', woId: 'WO-2601-002', barang: 'SEAL(DOUBLE SEAL)', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 850000 },
  { id: 'BOM-0125', woId: 'WO-2601-002', barang: 'BEARING 6309', stok: 0, jumlah: 2, satuan: 'PCS', harga: 280000 },
  { id: 'BOM-0126', woId: 'WO-2601-002', barang: 'BEARING 6308', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 230000 },
  { id: 'BOM-0127', woId: 'WO-2601-002', barang: 'ORING SEAL', stok: 0, jumlah: 4, satuan: 'PCS', harga: 50000 },
  { id: 'BOM-0128', woId: 'WO-2601-002', barang: 'KARET KABEL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 250000 },
  { id: 'BOM-0129', woId: 'WO-2601-002', barang: 'PERBOSH 6309', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 300000 },
  { id: 'BOM-0130', woId: 'WO-2601-020', barang: 'BEARING 6307', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 188000 },
  { id: 'BOM-0131', woId: 'WO-2601-020', barang: 'LAS BUBUT AS', stok: 0, jumlah: 2, satuan: 'TITIK', harga: 150000 },
  { id: 'BOM-0132', woId: 'WO-2601-020', barang: 'MECANICAL SEAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 1200000 },
  { id: 'BOM-0133', woId: 'WO-2601-020', barang: 'SEAL DEBU', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0134', woId: 'WO-2601-020', barang: 'ORING SEAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 50000 },
  { id: 'BOM-0135', woId: 'WO-2601-021', barang: 'DIODA PANAH ATAS', stok: 0, jumlah: 9, satuan: 'PCS', harga: 75000 },
  { id: 'BOM-0136', woId: 'WO-2601-021', barang: 'DIODA PANAH BAWAH', stok: 0, jumlah: 9, satuan: 'PCS', harga: 75000 },
  { id: 'BOM-0137', woId: 'WO-2601-021', barang: 'TERMINAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 100000 },
  { id: 'BOM-0138', woId: 'WO-2601-022', barang: 'SEAL', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 250000 },
  { id: 'BOM-0139', woId: 'WO-2601-022', barang: 'SEAL DEBU', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 50000 },
  { id: 'BOM-0140', woId: 'WO-2601-022', barang: 'BUBUT IMPELER', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 150000 },
  { id: 'BOM-0141', woId: 'WO-2601-022', barang: 'BEARING 6204', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 70000 },
  { id: 'BOM-0142', woId: 'WO-2601-022', barang: 'BEARING 6305', stok: 0, jumlah: 1, satuan: 'UNIT', harga: 150000 },
];

const initialServices: ServiceItem[] = [];
const _legacyServices: ServiceItem[] = [
  { id: 'SVC-0001', woId: 'WO-2601-036', deskripsi: 'GULUNG', biaya: 475000 },
  { id: 'SVC-0002', woId: 'WO-2601-037', deskripsi: 'GULUNG', biaya: 475000 },
  { id: 'SVC-0003', woId: 'WO-2601-038', deskripsi: 'GULUNG', biaya: 550000 },
  { id: 'SVC-0004', woId: 'WO-2601-039', deskripsi: 'GULUNG', biaya: 550000 },
  { id: 'SVC-0005', woId: 'WO-2601-040', deskripsi: 'GULUNG', biaya: 2900000 },
  { id: 'SVC-0006', woId: 'WO-2601-041', deskripsi: 'GULUNG', biaya: 8700000 },
  { id: 'SVC-0007', woId: 'WO-2601-042', deskripsi: 'GULUNG', biaya: 475000 },
  { id: 'SVC-0008', woId: 'WO-2601-043', deskripsi: 'GULUNG', biaya: 2900000 },
  { id: 'SVC-0009', woId: 'WO-2601-045', deskripsi: 'GULUNG', biaya: 200000 },
  { id: 'SVC-0010', woId: 'WO-2601-048', deskripsi: 'GULUNG', biaya: 950000 },
  { id: 'SVC-0011', woId: 'WO-2601-049', deskripsi: 'GULUNG', biaya: 3400000 },
  { id: 'SVC-0012', woId: 'WO-2601-083', deskripsi: 'JASA PEMASANGAN LAMPU TIANG,PHOTO CELL DAN CONTECTOR', biaya: 1500000 },
  { id: 'SVC-0013', woId: 'WO-2601-083', deskripsi: 'JASA TAREK KABEL', biaya: 750000 },
  { id: 'SVC-0014', woId: 'WO-2601-084', deskripsi: 'JASA PERBAIKAN LAMPU SOROT BELAKANG', biaya: 200000 },
  { id: 'SVC-0015', woId: 'WO-2601-035', deskripsi: 'JASA SERVICE', biaya: 200000 },
  { id: 'SVC-0016', woId: 'WO-2601-035', deskripsi: 'JASA SERVICE', biaya: 200000 },
  { id: 'SVC-0017', woId: 'WO-2601-056', deskripsi: 'GULUNG', biaya: 950000 },
  { id: 'SVC-0018', woId: 'WO-2601-060', deskripsi: 'GULUNG', biaya: 2250000 },
  { id: 'SVC-0019', woId: 'WO-2601-092', deskripsi: 'GULUNG', biaya: 1200000 },
  { id: 'SVC-0020', woId: 'WO-2601-076', deskripsi: 'JASA PERBAIKAN KABEL - KABEL', biaya: 150000 },
  { id: 'SVC-0021', woId: 'WO-2601-033', deskripsi: 'GULUNG', biaya: 950000 },
  { id: 'SVC-0022', woId: 'WO-2601-033', deskripsi: 'GULUNG', biaya: 2250000 },
  { id: 'SVC-0023', woId: 'WO-2601-090', deskripsi: 'GULUNG', biaya: 950000 },
  { id: 'SVC-0024', woId: 'WO-2601-090', deskripsi: 'GULUNG', biaya: 900000 },
  { id: 'SVC-0025', woId: 'WO-2601-050', deskripsi: 'JASA', biaya: 100000 },
  { id: 'SVC-0026', woId: 'WO-2601-016', deskripsi: 'JASA SERVICE', biaya: 50000 },
  { id: 'SVC-0027', woId: 'WO-2601-016', deskripsi: 'GULUNG', biaya: 200000 },
  { id: 'SVC-0028', woId: 'WO-2601-016', deskripsi: 'JASA SERVICE', biaya: 50000 },
  { id: 'SVC-0029', woId: 'WO-2601-085', deskripsi: 'JASA SERVICE', biaya: 150000 },
  { id: 'SVC-0030', woId: 'WO-2601-007', deskripsi: 'JASA SERVICE', biaya: 200000 },
  { id: 'SVC-0031', woId: 'WO-2601-031', deskripsi: 'GULUNG', biaya: 650000 },
  { id: 'SVC-0032', woId: 'WO-2601-054', deskripsi: 'GULUNG', biaya: 550000 },
  { id: 'SVC-0033', woId: 'WO-2601-053', deskripsi: 'JASA PEMASANGAN DINAMO KIPAS', biaya: 100000 },
  { id: 'SVC-0034', woId: 'WO-2601-012', deskripsi: 'JASA SERVICE', biaya: 200000 },
  { id: 'SVC-0035', woId: 'WO-2601-030', deskripsi: 'JASA SERVICE', biaya: 200000 },
  { id: 'SVC-0036', woId: 'WO-2601-052', deskripsi: 'GULUNG', biaya: 1200000 },
  { id: 'SVC-0037', woId: 'WO-2601-081', deskripsi: 'GULUNG', biaya: 1050000 },
  { id: 'SVC-0038', woId: 'WO-2601-064', deskripsi: 'JASA SERVICE', biaya: 1000000 },
  { id: 'SVC-0039', woId: 'WO-2601-064', deskripsi: 'JASA BONGKAR PASANG DILOKASI', biaya: 2000000 },
  { id: 'SVC-0040', woId: 'WO-2601-065', deskripsi: 'JASA SERVICE', biaya: 1000000 },
  { id: 'SVC-0041', woId: 'WO-2601-067', deskripsi: 'GULUNG', biaya: 700000 },
  { id: 'SVC-0042', woId: 'WO-2601-067', deskripsi: 'JASA BONGKAR PASANG DILOKASI', biaya: 1500000 },
  { id: 'SVC-0043', woId: 'WO-2601-089', deskripsi: 'JASA SERVICE', biaya: 1000000 },
  { id: 'SVC-0044', woId: 'WO-2601-089', deskripsi: 'JASA BONGKAR PASANG DILOKASI', biaya: 2000000 },
  { id: 'SVC-0045', woId: 'WO-2601-010', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0046', woId: 'WO-2601-010', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0047', woId: 'WO-2601-010', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0048', woId: 'WO-2601-010', deskripsi: 'JASA SERVICE', biaya: 200000 },
  { id: 'SVC-0049', woId: 'WO-2601-010', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0050', woId: 'WO-2601-010', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0051', woId: 'WO-2601-010', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0052', woId: 'WO-2601-010', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0053', woId: 'WO-2601-010', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0054', woId: 'WO-2601-008', deskripsi: 'GULUNG', biaya: 4250000 },
  { id: 'SVC-0055', woId: 'WO-2601-009', deskripsi: 'JASA PERBAIKAN KABELKABEL', biaya: 100000 },
  { id: 'SVC-0056', woId: 'WO-2601-005', deskripsi: 'JASA SERVICE', biaya: 250000 },
  { id: 'SVC-0057', woId: 'WO-2601-006', deskripsi: 'GULUNG', biaya: 2400000 },
  { id: 'SVC-0058', woId: 'WO-2601-006', deskripsi: 'JASA SERVICE', biaya: 250000 },
  { id: 'SVC-0059', woId: 'WO-2601-059', deskripsi: 'GULUNG', biaya: 750000 },
  { id: 'SVC-0060', woId: 'WO-2601-059', deskripsi: 'JASA SERVICE DAN PERBAIKAN KABEL - KABEL', biaya: 200000 },
  { id: 'SVC-0061', woId: 'WO-2601-046', deskripsi: 'JASA', biaya: 200000 },
  { id: 'SVC-0062', woId: 'WO-2601-027', deskripsi: 'GULUNG', biaya: 700000 },
  { id: 'SVC-0063', woId: 'WO-2601-027', deskripsi: 'JASA SERVICE', biaya: 200000 },
  { id: 'SVC-0064', woId: 'WO-2601-027', deskripsi: 'JASA SERVICE DAN PERBAIKAN KABEL-KABEL', biaya: 200000 },
  { id: 'SVC-0065', woId: 'WO-2511-164', deskripsi: 'JASA SERVICE DAN PRESS', biaya: 300000 },
  { id: 'SVC-0066', woId: 'WO-2512-048', deskripsi: 'GULUNG STATOR', biaya: 2750000 },
  { id: 'SVC-0067', woId: 'WO-2512-048', deskripsi: 'GULUNG STATOR', biaya: 2750000 },
  { id: 'SVC-0068', woId: 'WO-2501-003', deskripsi: 'JASA PEMASANGAN GENERATOR 31,5KVA', biaya: 1000000 },
  { id: 'SVC-0069', woId: 'WO-2601-001', deskripsi: 'GULUNG', biaya: 3300000 },
  { id: 'SVC-0070', woId: 'WO-2601-001', deskripsi: 'JASA BONGKAR PASANG', biaya: 300000 },
  { id: 'SVC-0071', woId: 'WO-2601-002', deskripsi: 'GULUNG', biaya: 3300000 },
  { id: 'SVC-0072', woId: 'WO-2601-002', deskripsi: 'JASA BONGKAR PASANG', biaya: 300000 },
  { id: 'SVC-0073', woId: 'WO-2601-020', deskripsi: 'JASA SERVICE', biaya: 1000000 },
  { id: 'SVC-0074', woId: 'WO-2601-021', deskripsi: 'GULUNG', biaya: 1500000 },
  { id: 'SVC-0075', woId: 'WO-2601-021', deskripsi: 'JASA SERVICE', biaya: 500000 },
  { id: 'SVC-0076', woId: 'WO-2601-022', deskripsi: 'GULUNG', biaya: 1275000 },
  { id: 'SVC-0077', woId: 'WO-2601-022', deskripsi: 'JASA SERVICE', biaya: 150000 },
];

const initialCustomers: Customer[] = [];
const _legacyCustomers: Customer[] = [
  { id: 'CUS-001', nama: '-', perusahaan: 'ASIN PEMUDA', telepon: '-', alamat: '-', totalWo: 8 },
  { id: 'CUS-002', nama: '-', perusahaan: 'BAPAK ADI SEI PAKNING', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-003', nama: '-', perusahaan: 'BAPAK RIO', telepon: '-', alamat: '-', totalWo: 4 },
  { id: 'CUS-004', nama: '-', perusahaan: 'BAPAK ERWIN PALAS', telepon: '-', alamat: '-', totalWo: 4 },
  { id: 'CUS-005', nama: '-', perusahaan: 'BAPAK HANIF', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-006', nama: '-', perusahaan: 'BAPAK HASAN', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-007', nama: '-', perusahaan: 'BAPAK JON LASIMA', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-008', nama: '-', perusahaan: 'BAPAK TARMIZI', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-009', nama: '-', perusahaan: 'PT. FAJAR', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-010', nama: '-', perusahaan: 'SINAR JAYA', telepon: '-', alamat: '-', totalWo: 3 },
  { id: 'CUS-011', nama: '-', perusahaan: 'BAPAK TONY', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-012', nama: '-', perusahaan: 'BBJ', telepon: '-', alamat: '-', totalWo: 5 },
  { id: 'CUS-013', nama: '-', perusahaan: 'SETIA BANGUN', telepon: '-', alamat: '-', totalWo: 5 },
  { id: 'CUS-014', nama: '-', perusahaan: 'CV. BAKTI INDAH JAYA', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-015', nama: '-', perusahaan: 'CV.CENTRAL PRATAMA KARYA', telepon: '-', alamat: '-', totalWo: 4 },
  { id: 'CUS-016', nama: '-', perusahaan: 'KARYA PEMUDA TEKNIK', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-017', nama: '-', perusahaan: 'PAM SIAK', telepon: '-', alamat: '-', totalWo: 4 },
  { id: 'CUS-018', nama: '-', perusahaan: 'BAPAK ELVIN', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-019', nama: '-', perusahaan: 'PT.INTI INDOKOMP', telepon: '-', alamat: '-', totalWo: 2 },
  { id: 'CUS-020', nama: '-', perusahaan: 'PT.MAKMUR ANDALAN SAWIT', telepon: '-', alamat: '-', totalWo: 2 },
  { id: 'CUS-021', nama: '-', perusahaan: 'PT.PALMA MAS SEJATI', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-022', nama: '-', perusahaan: 'RS. PRIMA', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-023', nama: '-', perusahaan: 'SUPERTON', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-024', nama: '-', perusahaan: 'PT.ADHI KARYA', telepon: '-', alamat: '-', totalWo: 1 },
  { id: 'CUS-025', nama: '-', perusahaan: 'UD.DAYA MANDIRI SEJATI', telepon: '-', alamat: '-', totalWo: 2 },
  { id: 'CUS-026', nama: '-', perusahaan: 'PT.UKM', telepon: '-', alamat: '-', totalWo: 5 },
];
export const useStore = create<AppState>((set) => ({
  workOrders: initialWorkOrders,
  inventory: initialInventory,
  finance: initialFinance,
  boms: initialBoms,
  services: initialServices,
  customers: initialCustomers,
  bengkelSettings: loadBengkelSettings(),
  isLoading: false,

  // Hydrate seluruh store dari Supabase setelah load
  setAllData: (d) => set((state) => ({ ...state, ...d, isLoading: false })),

  // Update settings & persist ke localStorage (cache cepat) + Supabase (sync antar device)
  updateBengkelSettings: (s) => {
    saveBengkelSettings(s);   // localStorage: agar tidak flicker saat reload
    db.settings.upsert(s);    // Supabase: sync permanen antar browser/device
    set({ bengkelSettings: s });
  },

  updateWorkOrder: (updatedWo) => set((state) => {
    const prevWo = state.workOrders.find(wo => wo.id === updatedWo.id);
    const justFinished = (updatedWo.status === 'Finished' || updatedWo.status === 'Picked Up')
      && prevWo?.status !== 'Finished' && prevWo?.status !== 'Picked Up';

    const newCustomers = [...state.customers];
    if (!newCustomers.some(c => c.perusahaan.toLowerCase() === updatedWo.customer.toLowerCase() || c.nama.toLowerCase() === updatedWo.customer.toLowerCase())) {
      const maxId = newCustomers.reduce((max, c) => { const n = parseInt(c.id.split('-').at(-1) || '0', 10); return !isNaN(n) && n > max ? n : max; }, 0);
      const newCus = { id: `CUS-${String(maxId + 1).padStart(3, '0')}`, nama: '-', perusahaan: updatedWo.customer, telepon: '-', alamat: '-', totalWo: 0 };
      newCustomers.push(newCus);
      db.customers.upsert(newCus);
    }

    const newFinance = [...state.finance];
    if (justFinished && updatedWo.estimatedCost > 0) {
      const alreadyRecorded = newFinance.some(f => f.deskripsi.includes(updatedWo.id));
      if (!alreadyRecorded) {
        const maxId = newFinance.reduce((max, f) => { const n = parseInt(f.id.split('-').at(-1) || '0', 10); return !isNaN(n) && n > max ? n : max; }, 0);
        const newTrx = {
          id: `TRX-${String(maxId + 1).padStart(4, '0')}`,
          tanggal: new Date().toISOString().split('T')[0],
          kategori: 'Pemasukan',
          subKategori: 'Pembayaran Servis',
          deskripsi: `Pelunasan - ${updatedWo.id} (${updatedWo.customer})`,
          nominal: updatedWo.estimatedCost,
        };
        newFinance.push(newTrx);
        db.finance.upsert(newTrx);
      }
    }

    db.workOrders.upsert(updatedWo);
    if (justFinished) toast.success(`WO ${updatedWo.id} selesai & dicatat ke keuangan.`);
    return {
      workOrders: state.workOrders.map(wo => wo.id === updatedWo.id ? updatedWo : wo),
      customers: newCustomers,
      finance: newFinance,
    };
  }),
  addWorkOrder: (wo) => set((state) => {
    const newCustomers = [...state.customers];
    if (!newCustomers.some(c => c.perusahaan.toLowerCase() === wo.customer.toLowerCase() || c.nama.toLowerCase() === wo.customer.toLowerCase())) {
      const maxId = newCustomers.reduce((max, c) => { const n = parseInt(c.id.split('-').at(-1) || '0', 10); return !isNaN(n) && n > max ? n : max; }, 0);
      const newCus = { id: `CUS-${String(maxId + 1).padStart(3, '0')}`, nama: '-', perusahaan: wo.customer, telepon: '-', alamat: '-', totalWo: 0 };
      newCustomers.push(newCus);
      db.customers.upsert(newCus);
    }
    db.workOrders.upsert(wo);
    toast.success(`SPK ${wo.id} berhasil dibuat.`);
    return { workOrders: [...state.workOrders, wo], customers: newCustomers };
  }),
  deleteWorkOrder: (id) => {
    db.workOrders.delete(id); // cascade ke boms & services di DB
    toast.info(`WO ${id} telah dihapus.`);
    set((state) => ({
      workOrders: state.workOrders.filter(wo => wo.id !== id),
      boms: state.boms.filter(bom => bom.woId !== id),
      services: state.services.filter(svc => svc.woId !== id),
    }));
  },

  updateInventory: (updatedItem) => {
    db.inventory.upsert(updatedItem);
    set((state) => ({ inventory: state.inventory.map(item => item.id === updatedItem.id ? updatedItem : item) }));
  },
  addInventory: (item) => {
    db.inventory.upsert(item);
    toast.success(`Item "${item.nama}" berhasil ditambahkan.`);
    set((state) => ({ inventory: [...state.inventory, item] }));
  },
  deleteInventory: (id) => {
    db.inventory.delete(id);
    toast.info('Item stok dihapus.');
    set((state) => ({ inventory: state.inventory.filter(item => item.id !== id) }));
  },

  updateFinance: (updatedTrx) => set((state) => {
    const prev = state.finance.find(t => t.id === updatedTrx.id);
    const wasBeliMat = !!prev && prev.kategori === 'Pengeluaran' && (prev.deskripsi || '').startsWith('Beli Material - ');
    const isBeliMat = updatedTrx.kategori === 'Pengeluaran' && (updatedTrx.deskripsi || '').startsWith('Beli Material - ');

    let newInventory = state.inventory;
    if (!wasBeliMat && isBeliMat) {
      const nama = updatedTrx.deskripsi.replace(/^Beli Material - /, '').trim();
      newInventory = state.inventory.map(inv =>
        inv.nama.toLowerCase() === nama.toLowerCase()
          ? { ...inv, stok: inv.stok + 1 }
          : inv
      );
      newInventory.forEach(inv => db.inventory.upsert(inv));
    }

    db.finance.upsert(updatedTrx);
    return {
      finance: state.finance.map(trx => trx.id === updatedTrx.id ? updatedTrx : trx),
      inventory: newInventory,
    };
  }),
  addFinance: (trx) => set((state) => {
    let newInventory = state.inventory;
    if (trx.kategori === 'Pengeluaran' && (trx.deskripsi || '').startsWith('Beli Material - ')) {
      const nama = trx.deskripsi.replace(/^Beli Material - /, '').trim();
      newInventory = state.inventory.map(inv =>
        inv.nama.toLowerCase() === nama.toLowerCase()
          ? { ...inv, stok: inv.stok + 1 }
          : inv
      );
      newInventory.forEach(inv => db.inventory.upsert(inv));
    }
    db.finance.upsert(trx);
    toast.success(`Transaksi "${trx.deskripsi}" berhasil dicatat.`);
    return { finance: [...state.finance, trx], inventory: newInventory };
  }),
  deleteFinance: (id) => {
    db.finance.delete(id);
    toast.info('Transaksi dihapus.');
    set((state) => ({ finance: state.finance.filter(trx => trx.id !== id) }));
  },

  updateBom: (updatedBom) => set((state) => {
    const newInventory = [...state.inventory];
    const namaBarang = updatedBom.barang.trim();
    if (namaBarang && !newInventory.some(i => i.nama.toLowerCase() === namaBarang.toLowerCase())) {
      const maxId = newInventory.reduce((max, i) => { const n = parseInt(i.id.split('-').at(-1) || '0', 10); return !isNaN(n) && n > max ? n : max; }, 0);
      const newInv = { id: `SKU-${String(maxId + 1).padStart(3, '0')}`, nama: namaBarang, stok: updatedBom.stok, satuan: updatedBom.satuan, batasMinimum: 5, hargaBeli: Math.round(updatedBom.harga * 0.8), hargaJual: updatedBom.harga };
      newInventory.push(newInv);
      db.inventory.upsert(newInv);
    }
    db.boms.upsert(updatedBom);
    return { boms: state.boms.map(bom => bom.id === updatedBom.id ? updatedBom : bom), inventory: newInventory };
  }),
  addBom: (bom) => set((state) => {
    const newInventory = [...state.inventory];
    const namaBarang = bom.barang.trim();
    if (namaBarang && !newInventory.some(i => i.nama.toLowerCase() === namaBarang.toLowerCase())) {
      const maxId = newInventory.reduce((max, i) => { const n = parseInt(i.id.split('-').at(-1) || '0', 10); return !isNaN(n) && n > max ? n : max; }, 0);
      const newInv = { id: `SKU-${String(maxId + 1).padStart(3, '0')}`, nama: namaBarang, stok: bom.stok, satuan: bom.satuan, batasMinimum: 5, hargaBeli: Math.round(bom.harga * 0.8), hargaJual: bom.harga };
      newInventory.push(newInv);
      db.inventory.upsert(newInv);
    }
    db.boms.upsert(bom);
    return { boms: [...state.boms, bom], inventory: newInventory };
  }),
  removeBom: (id) => {
    db.boms.delete(id);
    set((state) => ({ boms: state.boms.filter(bom => bom.id !== id) }));
  },

  updateService: (updatedSvc) => {
    db.services.upsert(updatedSvc);
    set((state) => ({ services: state.services.map(svc => svc.id === updatedSvc.id ? updatedSvc : svc) }));
  },
  addService: (svc) => {
    db.services.upsert(svc);
    set((state) => ({ services: [...state.services, svc] }));
  },
  removeService: (id) => {
    db.services.delete(id);
    set((state) => ({ services: state.services.filter(svc => svc.id !== id) }));
  },

  updateCustomer: (updatedC) => {
    db.customers.upsert(updatedC);
    set((state) => ({ customers: state.customers.map(c => c.id === updatedC.id ? updatedC : c) }));
  },
  addCustomer: (c) => {
    db.customers.upsert(c);
    toast.success('Pelanggan baru berhasil ditambahkan.');
    set((state) => ({ customers: [...state.customers, c] }));
  },
  deleteCustomer: (id) => {
    db.customers.delete(id);
    toast.info('Data pelanggan dihapus.');
    set((state) => ({ customers: state.customers.filter(c => c.id !== id) }));
  },
}));
