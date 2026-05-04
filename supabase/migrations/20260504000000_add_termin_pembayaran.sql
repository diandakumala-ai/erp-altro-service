-- ─────────────────────────────────────────────────────────────
-- Fitur Termin Pembayaran (Phase 1) + Refactor Link Pembayaran (Phase 5)
--
-- Phase 1: Foundation untuk fitur termin pembayaran
--   - work_orders.termin_hari   — termin pembayaran (0 = COD, default)
--   - work_orders.tanggal_invoice — tanggal terbit invoice (untuk hitung jatuh tempo)
--
-- Phase 5: Refactor link finance ↔ work_orders
--   - finance.wo_id — foreign key eksplisit ke work_orders
--   - Sebelumnya: link via substring matching deskripsi.includes(wo.id)
--   - Sekarang: kolom FK eksplisit, lebih reliable + bisa di-index
--
-- RLS: tidak perlu update karena policy `app_users_only` dipasang
-- FOR ALL (semua kolom otomatis ter-cover).
--
-- Backfill: WO yang sudah Finished/Picked Up dengan estimated_cost > 0
-- akan auto-set tanggal_invoice = date_in (asumsi WO selesai = invoice terbit
-- saat itu). Finance trx yang deskripsinya mengandung WO ID akan auto-link
-- ke wo_id.
-- ─────────────────────────────────────────────────────────────

-- ── Phase 1: kolom termin pembayaran di work_orders ──────────
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS termin_hari INTEGER NOT NULL DEFAULT 0;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS tanggal_invoice DATE;

COMMENT ON COLUMN work_orders.termin_hari IS
  'Termin pembayaran dalam hari. 0 = COD/Lunas di Tempat. Standar B2B: 7, 14, 30, 45, 60.';

COMMENT ON COLUMN work_orders.tanggal_invoice IS
  'Tanggal terbit invoice. Auto-set ke today saat status pertama kali Finished. Bisa di-override manual. Tidak berubah saat re-print.';

-- ── Phase 5: foreign key wo_id di finance ────────────────────
ALTER TABLE finance
  ADD COLUMN IF NOT EXISTS wo_id TEXT REFERENCES work_orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN finance.wo_id IS
  'Link eksplisit ke work_orders.id untuk pembayaran servis. NULL untuk transaksi non-WO (operasional, gaji, dll). Sebelumnya link via substring matching deskripsi.';

-- Index untuk query computeStatusBayar yang filter by wo_id
CREATE INDEX IF NOT EXISTS idx_finance_wo_id ON finance(wo_id) WHERE wo_id IS NOT NULL;

-- ── Backfill: tanggal_invoice untuk WO yang sudah selesai ────
-- Asumsi: WO yang sudah Finished/Picked Up dengan estimasi biaya > 0
-- berarti invoice sudah pernah terbit. Pakai date_in sebagai proxy
-- (lebih baik daripada NULL yang akan bikin perhitungan jatuh tempo error).
UPDATE work_orders
SET tanggal_invoice = COALESCE(
  NULLIF(date_in, '')::DATE,
  CURRENT_DATE
)
WHERE tanggal_invoice IS NULL
  AND status IN ('Finished', 'Picked Up')
  AND estimated_cost > 0;

-- ── Backfill: link finance.wo_id ke work_orders via substring match ──
-- Heuristik lama: f.deskripsi.includes(wo.id) AND f.kategori='Pemasukan'.
-- Setelah migrasi, kode TS akan filter pakai wo_id langsung; backfill ini
-- memastikan data lama tetap ter-link tanpa kehilangan informasi piutang.
UPDATE finance f
SET wo_id = wo.id
FROM work_orders wo
WHERE f.wo_id IS NULL
  AND f.kategori = 'Pemasukan'
  AND f.deskripsi LIKE '%' || wo.id || '%';

-- ── Settings: kolom default_termin_hari (opsional, dipakai saat WO baru) ──
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS default_termin_hari INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN settings.default_termin_hari IS
  'Termin default untuk WO baru. 0 = COD. Bisa di-override per WO.';
