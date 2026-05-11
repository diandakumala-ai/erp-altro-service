-- ─────────────────────────────────────────────────────────────
-- Tambah kolom akuntansi di `settings` untuk Neraca + Laba Rugi
--
-- Dipakai oleh fitur Laporan Pajak (Neraca & Laba Rugi).
-- Aset tetap & utang manual disimpan sebagai JSONB karena
-- volumenya kecil (biasanya < 20 baris per kategori).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS modal_awal NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS saldo_kas_awal NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS tahun_buku INTEGER;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS jenis_usaha TEXT NOT NULL DEFAULT 'UMKM_PP55'
  CHECK (jenis_usaha IN ('UMKM_PP55', 'Badan', 'Manual'));

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS tarif_pph_manual NUMERIC NOT NULL DEFAULT 0.5;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS aset_tetap JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS utang_jangka_pendek JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS utang_jangka_panjang JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS laba_ditahan_awal NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN settings.modal_awal IS
  'Modal disetor / modal awal (Rp). Pos Ekuitas di Neraca.';

COMMENT ON COLUMN settings.saldo_kas_awal IS
  'Saldo kas + bank awal periode buku (Rp). Default 0.';

COMMENT ON COLUMN settings.tahun_buku IS
  'Tahun buku berjalan (mis. 2026). Default: NULL (pakai tahun sekarang).';

COMMENT ON COLUMN settings.jenis_usaha IS
  'Jenis usaha untuk perhitungan PPh: UMKM_PP55 (PPh Final 0.5% omzet), '
  'Badan (PPh Badan 22% laba), atau Manual (pakai tarif_pph_manual).';

COMMENT ON COLUMN settings.tarif_pph_manual IS
  'Tarif PPh manual (%) — hanya dipakai bila jenis_usaha = Manual.';

COMMENT ON COLUMN settings.aset_tetap IS
  'Array of AsetTetap: {id, nama, kategori, hargaPerolehan, akumulasiPenyusutan, tanggalPerolehan, umurEkonomis}';

COMMENT ON COLUMN settings.utang_jangka_pendek IS
  'Array of UtangManual {id, nama, nominal, jatuhTempo} — di luar utang PPN/PPh otomatis.';

COMMENT ON COLUMN settings.utang_jangka_panjang IS
  'Array of UtangManual {id, nama, nominal, jatuhTempo} — utang >1 tahun (KMK, KKB, dll).';

COMMENT ON COLUMN settings.laba_ditahan_awal IS
  'Laba ditahan dari tahun-tahun sebelumnya (manual). Pos Ekuitas di Neraca.';
