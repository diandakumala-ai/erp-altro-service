/**
 * Format helpers — single source of truth.
 * Sebelumnya `fmt` didefinisikan duplikat di 6+ file.
 */

const ID = new Intl.NumberFormat('id-ID');

/** Format angka lokalisasi Indonesia. `1234567` → `"1.234.567"`. */
export const fmt = (n: number): string => ID.format(n);

/** Format Rupiah dengan absolut value. `-50000` → `"Rp 50.000"`. */
export const fmtRupiah = (n: number): string => `Rp ${ID.format(Math.abs(n))}`;

/** Format Rupiah signed dengan +/−. `-50000` → `"− Rp 50.000"`. */
export const fmtRupiahSigned = (n: number): string =>
  `${n >= 0 ? '+' : '−'} Rp ${ID.format(Math.abs(n))}`;

/** Format ringkas: 1.5 Jt / 250 Rb / 100. */
export const fmtShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Jt`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)} Rb`;
  return String(n);
};

/** Format tanggal ISO `2025-01-15` → `"15 Januari 2025"`. */
export const fmtTanggal = (iso: string): string => {
  if (!iso || iso === '-') return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Format tanggal pendek `2025-01-15` → `"15 Jan"`. */
export const fmtTanggalPendek = (iso: string): string => {
  if (!iso || iso === '-') return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};
