-- ─────────────────────────────────────────────────────────────
-- RLS Hardening: Ganti policy "authenticated_only" yang terlalu
-- longgar dengan allowlist berbasis tabel `app_users`.
--
-- Skenario sebelumnya: SIAPAPUN yang berhasil sign-up via Supabase
-- Auth (kalau email-signup masih ON di dashboard) bisa baca/edit
-- seluruh tabel — termasuk transaksi finance & data customer.
--
-- Setelah migrasi ini: hanya user yang user_id-nya terdaftar di
-- `app_users` yang bisa akses data. Tidak cukup hanya
-- "authenticated", harus juga ada di allowlist.
--
-- ⚠️ AKSI MANUAL WAJIB SETELAH MIGRASI:
-- 1. Login ke Supabase Dashboard → Authentication → Users → copy
--    UUID user admin Anda.
-- 2. Jalankan di SQL Editor (ganti UUID & email):
--      INSERT INTO app_users (user_id, email, role)
--      VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
--              'admin@altroservice.com', 'admin');
-- 3. Test login dari aplikasi — harus bisa baca data seperti biasa.
-- 4. Matikan email signup di Authentication → Providers → Email.
-- ─────────────────────────────────────────────────────────────

-- ── Tabel allowlist user yang boleh akses ────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- User hanya bisa lihat row dirinya sendiri di tabel app_users
DROP POLICY IF EXISTS "self_only_select" ON app_users;
CREATE POLICY "self_only_select" ON app_users
  FOR SELECT USING (auth.uid() = user_id);

-- ── Helper: cek apakah user current ada di allowlist ────────
CREATE OR REPLACE FUNCTION is_app_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users WHERE user_id = auth.uid()
  );
$$;

-- ── Ganti policy lama dengan yang ketat ─────────────────────
-- Pattern: drop policy lama → buat policy baru dengan is_app_user()

-- customers
DROP POLICY IF EXISTS "authenticated_only" ON customers;
CREATE POLICY "app_users_only" ON customers FOR ALL
  USING (is_app_user()) WITH CHECK (is_app_user());

-- work_orders
DROP POLICY IF EXISTS "authenticated_only" ON work_orders;
CREATE POLICY "app_users_only" ON work_orders FOR ALL
  USING (is_app_user()) WITH CHECK (is_app_user());

-- inventory
DROP POLICY IF EXISTS "authenticated_only" ON inventory;
CREATE POLICY "app_users_only" ON inventory FOR ALL
  USING (is_app_user()) WITH CHECK (is_app_user());

-- finance
DROP POLICY IF EXISTS "authenticated_only" ON finance;
CREATE POLICY "app_users_only" ON finance FOR ALL
  USING (is_app_user()) WITH CHECK (is_app_user());

-- boms
DROP POLICY IF EXISTS "authenticated_only" ON boms;
CREATE POLICY "app_users_only" ON boms FOR ALL
  USING (is_app_user()) WITH CHECK (is_app_user());

-- services
DROP POLICY IF EXISTS "authenticated_only" ON services;
CREATE POLICY "app_users_only" ON services FOR ALL
  USING (is_app_user()) WITH CHECK (is_app_user());

-- bengkel_settings (jika ada)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'bengkel_settings') THEN
    EXECUTE 'DROP POLICY IF EXISTS "authenticated_only" ON bengkel_settings';
    EXECUTE 'CREATE POLICY "app_users_only" ON bengkel_settings FOR ALL
             USING (is_app_user()) WITH CHECK (is_app_user())';
  END IF;
END $$;
