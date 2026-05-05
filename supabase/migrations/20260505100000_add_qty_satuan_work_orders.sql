-- ─────────────────────────────────────────────────────────────
-- Tambah kolom qty + qty_satuan di work_orders untuk item utama
-- yang dicetak di SPK / Invoice / Surat Jalan.
--
-- Sebelumnya: qty di-hardcode "1 UNIT" di template print → user tidak
-- bisa cetak misalnya "2 UNIT Elektromotor" tanpa edit kode.
--
-- Default: 1 UNIT (kompatibel dengan data lama).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS qty NUMERIC NOT NULL DEFAULT 1;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS qty_satuan TEXT NOT NULL DEFAULT 'UNIT';

COMMENT ON COLUMN work_orders.qty IS
  'Jumlah unit item utama WO (untuk cetak SPK/Invoice/Surat Jalan). Default 1.';

COMMENT ON COLUMN work_orders.qty_satuan IS
  'Satuan item utama WO (UNIT/PCS/SET/dll). Default UNIT.';

-- Backfill: semua WO existing dapat default 1 UNIT (sudah ter-handle DEFAULT).
