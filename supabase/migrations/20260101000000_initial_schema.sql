-- =====================================================
-- ALTRO ERP — Initial Database Schema
-- Migration: 20260101000000_initial_schema
-- Jalankan di: Supabase Dashboard → SQL Editor
-- Atau otomatis via GitHub Actions (supabase db push)
-- =====================================================

-- ─── CUSTOMERS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id             TEXT PRIMARY KEY,
  nama           TEXT NOT NULL DEFAULT '',
  perusahaan     TEXT NOT NULL DEFAULT '',
  telepon        TEXT NOT NULL DEFAULT '',
  alamat         TEXT NOT NULL DEFAULT '',
  total_wo       INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── WORK ORDERS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS work_orders (
  id               TEXT PRIMARY KEY,
  customer         TEXT NOT NULL DEFAULT '',
  merk             TEXT NOT NULL DEFAULT '',
  capacity         TEXT NOT NULL DEFAULT '',
  keluhan          TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'Antri',
  technician       TEXT NOT NULL DEFAULT '',
  date_in          TEXT,
  estimasi_selesai TEXT NOT NULL DEFAULT '',
  estimated_cost   NUMERIC NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVENTORY ────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id              TEXT PRIMARY KEY,
  nama            TEXT NOT NULL DEFAULT '',
  stok            NUMERIC NOT NULL DEFAULT 0,
  satuan          TEXT NOT NULL DEFAULT '',
  batas_minimum   NUMERIC NOT NULL DEFAULT 0,
  harga_beli      NUMERIC NOT NULL DEFAULT 0,
  harga_jual      NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── FINANCE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS finance (
  id            TEXT PRIMARY KEY,
  tanggal       TEXT NOT NULL,
  kategori      TEXT NOT NULL,
  sub_kategori  TEXT,
  deskripsi     TEXT NOT NULL DEFAULT '',
  nominal       NUMERIC NOT NULL DEFAULT 0,
  catatan       TEXT,
  is_rutin      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BILL OF MATERIALS ────────────────────────────
CREATE TABLE IF NOT EXISTS boms (
  id         TEXT PRIMARY KEY,
  wo_id      TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  barang     TEXT NOT NULL DEFAULT '',
  stok       NUMERIC NOT NULL DEFAULT 0,
  jumlah     NUMERIC NOT NULL DEFAULT 0,
  satuan     TEXT NOT NULL DEFAULT '',
  harga      NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SERVICE ITEMS ────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id         TEXT PRIMARY KEY,
  wo_id      TEXT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  deskripsi  TEXT NOT NULL DEFAULT '',
  biaya      NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SETTINGS (Pengaturan Bengkel) ────────────────
CREATE TABLE IF NOT EXISTS settings (
  id               TEXT PRIMARY KEY DEFAULT 'bengkel',
  nama_bengkel     TEXT NOT NULL DEFAULT '',
  alamat           TEXT NOT NULL DEFAULT '',
  kota             TEXT NOT NULL DEFAULT '',
  telepon          TEXT NOT NULL DEFAULT '',
  hp               TEXT NOT NULL DEFAULT '',
  email            TEXT NOT NULL DEFAULT '',
  npwp             TEXT NOT NULL DEFAULT '',
  nama_pemilik     TEXT NOT NULL DEFAULT '',
  jabatan_pemilik  TEXT NOT NULL DEFAULT '',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Seed baris settings default (aman di-run ulang)
INSERT INTO settings (id, nama_bengkel, alamat, kota, telepon, hp, email, jabatan_pemilik)
VALUES ('bengkel', 'CV ALTRO SERVICE', 'Jl. Pemudi No. 8A, Payung Sekaki',
        'Pekanbaru, Riau', '0761-8405083', '0812668188', 'altroservice1@gmail.com', 'Pimpinan')
ON CONFLICT (id) DO NOTHING;

-- ─── ROW LEVEL SECURITY ───────────────────────────
ALTER TABLE customers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE boms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE services   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings   ENABLE ROW LEVEL SECURITY;

-- Policy: hanya user yang sudah login yang bisa akses
DO $$
BEGIN
  -- customers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customers' AND policyname='authenticated_only') THEN
    CREATE POLICY "authenticated_only" ON customers FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  -- work_orders
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='work_orders' AND policyname='authenticated_only') THEN
    CREATE POLICY "authenticated_only" ON work_orders FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  -- inventory
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory' AND policyname='authenticated_only') THEN
    CREATE POLICY "authenticated_only" ON inventory FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  -- finance
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='finance' AND policyname='authenticated_only') THEN
    CREATE POLICY "authenticated_only" ON finance FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  -- boms
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='boms' AND policyname='authenticated_only') THEN
    CREATE POLICY "authenticated_only" ON boms FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  -- services
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='services' AND policyname='authenticated_only') THEN
    CREATE POLICY "authenticated_only" ON services FOR ALL USING (auth.role() = 'authenticated');
  END IF;
  -- settings
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='settings' AND policyname='authenticated_only') THEN
    CREATE POLICY "authenticated_only" ON settings FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
