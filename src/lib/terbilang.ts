/**
 * Konversi angka ke terbilang Bahasa Indonesia.
 * Standar untuk kuitansi & bukti pembayaran.
 *
 * Contoh:
 *   terbilang(0)        → "nol"
 *   terbilang(1500)     → "seribu lima ratus"
 *   terbilang(2_500_000)→ "dua juta lima ratus ribu"
 *
 * Support: 0 .. 999.999.999.999.999 (kuadriliun − sebenarnya overkill).
 */

const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];

function terbilangBelowThousand(n: number): string {
  if (n === 0) return '';
  if (n < 10) return SATUAN[n];
  if (n < 20) {
    if (n === 10) return 'sepuluh';
    if (n === 11) return 'sebelas';
    return `${SATUAN[n - 10]} belas`;
  }
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rem  = n % 10;
    return rem === 0 ? `${SATUAN[tens]} puluh` : `${SATUAN[tens]} puluh ${SATUAN[rem]}`;
  }
  // 100..999
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  const hundredsLabel = hundreds === 1 ? 'seratus' : `${SATUAN[hundreds]} ratus`;
  return rem === 0 ? hundredsLabel : `${hundredsLabel} ${terbilangBelowThousand(rem)}`;
}

const SCALE: { value: number; label: string; one: string }[] = [
  { value: 1_000_000_000_000, label: 'triliun',  one: 'satu triliun' },
  { value: 1_000_000_000,     label: 'miliar',   one: 'satu miliar' },
  { value: 1_000_000,         label: 'juta',     one: 'satu juta' },
  { value: 1_000,             label: 'ribu',     one: 'seribu' },
];

export function terbilang(n: number): string {
  if (!Number.isFinite(n)) return '';
  const abs = Math.floor(Math.abs(n));
  if (abs === 0) return 'nol';

  let result = '';
  let rest = abs;

  for (const { value, label, one } of SCALE) {
    if (rest >= value) {
      const chunk = Math.floor(rest / value);
      rest = rest % value;
      if (chunk === 1 && value === 1_000) {
        result += `${one} `;
      } else {
        result += `${terbilangBelowThousand(chunk)} ${label} `;
      }
    }
  }

  if (rest > 0) result += terbilangBelowThousand(rest);

  const out = result.trim().replace(/\s+/g, ' ');
  return n < 0 ? `minus ${out}` : out;
}

/** Format untuk kuitansi: capitalize first + suffix " rupiah". */
export function terbilangRupiah(n: number): string {
  const t = terbilang(n);
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return `${cap} rupiah`;
}
