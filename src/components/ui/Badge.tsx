import type { ReactNode } from 'react';

type Tone = 'neutral' | 'indigo' | 'emerald' | 'amber' | 'red' | 'blue';
type Size = 'sm' | 'md';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber:   'bg-amber-50 text-amber-700 border-amber-200',
  red:     'bg-red-50 text-red-700 border-red-200',
  blue:    'bg-blue-50 text-blue-700 border-blue-200',
};

const SIZES: Record<Size, string> = {
  sm: 'px-2 py-0.5 text-2xs',
  md: 'px-2.5 py-0.5 text-xs',
};

interface BadgeProps {
  tone?: Tone;
  size?: Size;
  bordered?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Pill kecil untuk status / kategori / counter. */
export function Badge({ tone = 'neutral', size = 'sm', bordered = false, children, className = '', title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider ${bordered ? 'border' : ''} ${TONES[tone]} ${SIZES[size]} ${className}`}
    >
      {children}
    </span>
  );
}
