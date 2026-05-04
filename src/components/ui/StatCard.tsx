import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

type Accent = 'indigo' | 'emerald' | 'amber' | 'red' | 'slate';

const ACCENT_BORDER: Record<Accent, string> = {
  indigo:  'border-l-indigo-500',
  emerald: 'border-l-emerald-500',
  amber:   'border-l-amber-500',
  red:     'border-l-red-500',
  slate:   'border-l-slate-300',
};

const ACCENT_VALUE: Record<Accent, string> = {
  indigo:  'text-indigo-700',
  emerald: 'text-emerald-600',
  amber:   'text-amber-700',
  red:     'text-red-600',
  slate:   'text-slate-800',
};

interface StatCardProps {
  /** Caption uppercase di atas value. */
  label: string;
  /** Nilai utama (sudah ter-format). */
  value: ReactNode;
  /** Sub-text di bawah value (opsional). */
  hint?: ReactNode;
  /** Accent warna value + left border. */
  accent?: Accent;
  /** Variant ukuran. compact = 1 baris (digunakan di toolbar tabel), full = card besar dengan ikon. */
  variant?: 'compact' | 'full';
  /** Ikon di kanan untuk variant 'full'. */
  icon?: React.ElementType;
  /** Background ikon (untuk variant 'full'). */
  iconBg?: string;
  /** Jadikan card link/tombol. */
  to?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Stat / KPI card konsisten — sebelumnya ditulis ulang di 4 halaman.
 *
 * - `variant="compact"`: 1 baris, label kiri + value kanan. Untuk toolbar di atas tabel.
 * - `variant="full"`: card besar dengan ikon di kanan. Untuk dashboard.
 */
export function StatCard({
  label, value, hint, accent = 'slate', variant = 'compact',
  icon: Icon, iconBg = 'bg-indigo-100 text-indigo-600',
  to, onClick, className = '',
}: StatCardProps) {
  const interactive = !!(to || onClick);
  const accentBorder = accent === 'slate' ? '' : `border-l-4 ${ACCENT_BORDER[accent]}`;
  const valueColor = ACCENT_VALUE[accent];

  if (variant === 'full') {
    const inner = (
      <div className={`relative bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-start justify-between transition-all hover:shadow-md ${interactive ? 'cursor-pointer hover:border-indigo-300 group' : ''} ${className}`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-black mt-1 ${valueColor}`}>{value}</p>
          {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        )}
        {interactive && (
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 absolute right-4 bottom-4 transition-colors" aria-hidden="true" />
        )}
      </div>
    );
    if (to) return <Link to={to} className="block">{inner}</Link>;
    if (onClick) return <button type="button" onClick={onClick} className="text-left w-full">{inner}</button>;
    return inner;
  }

  // compact variant
  const inner = (
    <div className={`bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between transition-colors ${accentBorder} ${interactive ? 'hover:bg-slate-50 cursor-pointer' : ''} ${className}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">{label}</p>
        {hint && <p className="text-2xs text-slate-500 mt-0.5 truncate">{hint}</p>}
      </div>
      <h3 className={`text-lg font-bold whitespace-nowrap ${valueColor}`}>{value}</h3>
    </div>
  );
  if (to) return <Link to={to} className="block">{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="text-left w-full">{inner}</button>;
  return inner;
}
