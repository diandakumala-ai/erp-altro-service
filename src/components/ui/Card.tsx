import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Hilangkan padding dalam Card — berguna untuk Card berisi tabel */
  noPadding?: boolean;
}

/** Card putih standar — bordered + shadow + rounded-xl. */
export function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${noPadding ? '' : 'p-5'} ${className}`}>
      {children}
    </div>
  );
}

interface SectionProps {
  title: string;
  icon?: React.ElementType;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Warna ikon header — default indigo */
  accent?: 'indigo' | 'emerald' | 'red' | 'amber';
  /** Override class untuk body (default `p-6`). */
  bodyClassName?: string;
}

const ACCENT: Record<NonNullable<SectionProps['accent']>, { bg: string; fg: string }> = {
  indigo:  { bg: 'bg-indigo-50',  fg: 'text-indigo-600'  },
  emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  red:     { bg: 'bg-red-50',     fg: 'text-red-600'     },
  amber:   { bg: 'bg-amber-50',   fg: 'text-amber-600'   },
};

/** Card dengan header (judul + ikon + slot kanan opsional) — pola dipakai di Settings. */
export function Section({ title, icon: Icon, rightSlot, children, className = '', accent = 'indigo', bodyClassName = 'p-6' }: SectionProps) {
  const a = ACCENT[accent];
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        {Icon && (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${a.bg}`}>
            <Icon className={`w-4 h-4 ${a.fg}`} />
          </div>
        )}
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {rightSlot && <div className="ml-auto">{rightSlot}</div>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
