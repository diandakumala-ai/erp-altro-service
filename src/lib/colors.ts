/**
 * Helper warna semantik — kurangi duplikasi conditional className inline.
 *
 * Aturan palette ALTRO ERP:
 * - emerald-* → financial positive, success, "lunas", "aktif"
 * - red-*     → danger, financial negative, errors, "belum bayar"
 * - amber-*   → warning, "DP", "menipis"
 * - indigo-*  → primary brand, neutral active
 * - slate-*   → text & background
 *
 * JANGAN pakai: green-* (legacy, ganti emerald), rose-* (legacy, ganti red).
 */

/** Class warna teks untuk nilai uang positif/negatif. */
export const moneyTextClass = (n: number): string =>
  n >= 0 ? 'text-emerald-600' : 'text-red-600';

/** Class warna teks lebih gelap (hover-grade) untuk uang. */
export const moneyTextStrongClass = (n: number): string =>
  n >= 0 ? 'text-emerald-700' : 'text-red-700';

/** Class background+text untuk badge nominal positif/negatif. */
export const moneyBadgeClass = (n: number): string =>
  n >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
