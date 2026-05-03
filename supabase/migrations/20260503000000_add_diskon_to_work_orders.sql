-- Tambah kolom diskon (Rp, nominal) ke work_orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS diskon NUMERIC NOT NULL DEFAULT 0;
