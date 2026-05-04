import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'soft-indigo' | 'soft-emerald' | 'soft-danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:       'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border border-indigo-600',
  secondary:     'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200',
  danger:        'bg-red-600 hover:bg-red-700 text-white shadow-sm border border-red-600',
  success:       'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border border-emerald-600',
  ghost:         'bg-transparent hover:bg-slate-100 text-slate-600 border border-transparent',
  'soft-indigo': 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200',
  'soft-emerald':'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200',
  'soft-danger': 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-100',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'sm', className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
});
