import { Wrench, Clock, Eye, FlaskConical, CheckCircle, PackageCheck } from 'lucide-react';

/** Status Work Order — single source of truth. */
export const WO_STATUS = ['Queue', 'Inspecting', 'Repairing', 'Testing', 'Finished', 'Picked Up'] as const;
export type WOStatus = typeof WO_STATUS[number];

/** Status yang dianggap aktif (belum selesai). */
export const ACTIVE_STATUSES: readonly WOStatus[] = ['Queue', 'Inspecting', 'Repairing', 'Testing'];

/** Status yang dianggap selesai. */
export const FINISHED_STATUSES: readonly WOStatus[] = ['Finished', 'Picked Up'];

export const isActive = (s: string): boolean => (ACTIVE_STATUSES as readonly string[]).includes(s);
export const isFinished = (s: string): boolean => (FINISHED_STATUSES as readonly string[]).includes(s);

interface StatusConfig {
  bg: string;
  icon: React.ElementType;
}

const STATUS_CONFIG: Record<WOStatus, StatusConfig> = {
  'Queue':      { bg: 'bg-slate-100 text-slate-600',   icon: Clock },
  'Inspecting': { bg: 'bg-amber-100 text-amber-700',   icon: Eye },
  'Repairing':  { bg: 'bg-blue-100 text-blue-700',     icon: Wrench },
  'Testing':    { bg: 'bg-purple-100 text-purple-700', icon: FlaskConical },
  'Finished':   { bg: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  'Picked Up':  { bg: 'bg-teal-100 text-teal-700',     icon: PackageCheck },
};

const FALLBACK: StatusConfig = { bg: 'bg-slate-100 text-slate-600', icon: Clock };

/** Pill badge untuk status WO — dengan ikon (WCAG: tidak hanya warna). */
export function StatusPill({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' }) {
  const cfg = STATUS_CONFIG[status as WOStatus] ?? FALLBACK;
  const Icon = cfg.icon;
  const textSize = size === 'xs' ? 'text-2xs' : 'text-xs';
  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${textSize} ${cfg.bg}`}>
      <Icon className={`${iconSize} shrink-0`} aria-hidden="true" />
      {status}
    </span>
  );
}
