-- ─────────────────────────────────────────────────────────────
-- Tambah kolom use_ppn + ppn_percent di work_orders.
--
-- Konsep:
-- - use_ppn = false (default) → tagihan tanpa PPN
-- - use_ppn = true → tagihan ditambah PPN sebesar
--   (estimated_cost - diskon) * ppn_percent / 100
-- - ppn_percent default 11 (PPN 11% per April 2022).
--
-- Default: tanpa PPN (kompatibel dengan data lama).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS use_ppn BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS ppn_percent NUMERIC NOT NULL DEFAULT 11;

COMMENT ON COLUMN work_orders.use_ppn IS
  'Aktifkan perhitungan PPN. FALSE = tanpa PPN, TRUE = PPN ditambahkan ke tagihan.';

COMMENT ON COLUMN work_orders.ppn_percent IS
  'Persentase PPN (default 11 untuk PPN 11%). Hanya dipakai bila use_ppn = TRUE.';

-- Backfill: semua WO existing dapat default tanpa PPN (sudah ter-handle DEFAULT).
