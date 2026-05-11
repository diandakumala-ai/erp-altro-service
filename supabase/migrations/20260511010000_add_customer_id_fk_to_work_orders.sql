-- =====================================================
-- ALTRO ERP — Add customer_id FK to work_orders
-- Migration: 20260511010000_add_customer_id_fk_to_work_orders
--
-- Sebelumnya relasi WO → Customer hanya by name-matching string
-- (work_orders.customer ≈ customers.perusahaan|customers.nama,
-- case-insensitive). Rename pelanggan = WO orphan.
--
-- Migration ini menambahkan kolom customer_id sebagai FK eksplisit
-- ke customers(id). Kolom `customer` (denormalized name) dipertahankan
-- untuk:
--   1. Backward compat dengan client yang belum di-redeploy.
--   2. Display name yang tidak harus join — banyak dipakai di tabel & cetak.
--
-- ON DELETE SET NULL: kalau customer dihapus, WO masih ada (history
-- penting untuk audit) tapi customer_id jadi NULL. Field `customer`
-- (denormalized) tetap berisi nama sebagai jejak.
-- =====================================================

-- 1. Tambah kolom customer_id (nullable dulu untuk backfill)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;

-- 2. Index untuk join performance
CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON work_orders(customer_id);

-- 3. Backfill — match WO.customer ke customers.perusahaan dulu, lalu fallback ke nama.
--    Case-insensitive, trim whitespace.
UPDATE work_orders wo
SET customer_id = c.id
FROM customers c
WHERE wo.customer_id IS NULL
  AND TRIM(LOWER(wo.customer)) = TRIM(LOWER(c.perusahaan))
  AND TRIM(c.perusahaan) <> '';

-- 4. Backfill round 2 — yang belum match via perusahaan, coba via nama.
UPDATE work_orders wo
SET customer_id = c.id
FROM customers c
WHERE wo.customer_id IS NULL
  AND TRIM(LOWER(wo.customer)) = TRIM(LOWER(c.nama))
  AND TRIM(c.nama) <> ''
  AND c.nama <> '-';

-- 5. Audit log — berapa WO yang tidak ter-match (akan jadi customer_id NULL,
--    bukan error). Hanya di-print, tidak block migration.
DO $$
DECLARE
  unmatched_count INTEGER;
  matched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmatched_count FROM work_orders WHERE customer_id IS NULL;
  SELECT COUNT(*) INTO matched_count FROM work_orders WHERE customer_id IS NOT NULL;
  RAISE NOTICE 'Backfill complete: % WO matched, % WO unmatched (customer_id NULL).',
    matched_count, unmatched_count;
  IF unmatched_count > 0 THEN
    RAISE NOTICE 'WO yang tidak match akan tetap berfungsi karena field "customer" (TEXT) masih ada. Cek manual di Dashboard → Customers.';
  END IF;
END $$;
