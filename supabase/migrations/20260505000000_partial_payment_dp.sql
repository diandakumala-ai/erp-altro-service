-- ─────────────────────────────────────────────────────────────
-- Partial Payment / DP — rencana pembayaran di WO + rename
-- subKategori finance.
--
-- Konsep:
-- - work_orders.dp_amount = RENCANA DP (Rp). 0 = bayar penuh.
--   Bukan pembayaran aktual (itu di tabel finance).
-- - Sisa pelunasan = (estimated_cost - diskon) - dp_amount
-- - Saat user catat finance trx, sub_kategori 'DP' atau 'Pelunasan'
--   menentukan apakah pembayaran tergolong DP atau pelunasan
--
-- Sub-kategori finance Pemasukan diseragamkan jadi:
--   'DP', 'Pelunasan', 'Lain-lain'
-- (Sebelumnya: 'Pembayaran Servis', 'DP', 'Lain-lain')
-- 'Pembayaran Servis' → 'Pelunasan' (lebih jelas semantiknya)
-- ─────────────────────────────────────────────────────────────

-- ── Tambah kolom dp_amount ke work_orders ────────────────────
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS dp_amount NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN work_orders.dp_amount IS
  'Rencana DP (Rp). 0 = bayar penuh tanpa DP. Bukan pembayaran aktual — '
  'pembayaran aktual dicatat di tabel finance dengan sub_kategori = DP/Pelunasan.';

-- ── Migrate existing finance.sub_kategori ────────────────────
-- 'Pembayaran Servis' adalah istilah lama; semantiknya = pelunasan.
-- Migrate dengan WHERE clause defensif (tidak akan error kalau sudah dimigrate).
UPDATE finance
SET sub_kategori = 'Pelunasan'
WHERE sub_kategori = 'Pembayaran Servis';
