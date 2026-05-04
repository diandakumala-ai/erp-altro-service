import { useState } from 'react';
import { Check } from 'lucide-react';

const PRESETS = [
  { value: 0, label: 'COD',    sub: 'Lunas di Tempat' },
  { value: 7, label: 'NET 7',  sub: '7 hari' },
  { value: 14, label: 'NET 14', sub: '14 hari' },
  { value: 30, label: 'NET 30', sub: '30 hari' },
  { value: 45, label: 'NET 45', sub: '45 hari' },
  { value: 60, label: 'NET 60', sub: '60 hari' },
] as const;

const PRESET_VALUES = PRESETS.map(p => p.value as number);

interface TerminSelectorProps {
  value: number;
  onChange: (v: number) => void;
  /** ID untuk hubungan label htmlFor (opsional). */
  id?: string;
  /** Tampilan compact (untuk Settings, single row). Default false (grid 7 tombol). */
  compact?: boolean;
}

/**
 * Pilihan termin pembayaran — preset (COD/NET 7/14/30/45/60) + custom hari.
 * Format universal di B2B Indonesia.
 */
export function TerminSelector({ value, onChange, id, compact = false }: TerminSelectorProps) {
  const isCustom = !PRESET_VALUES.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="flex flex-col gap-2" id={id}>
      <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'sm:gap-2'}`}>
        {PRESETS.map(p => {
          const active = value === p.value && !showCustom;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => { setShowCustom(false); onChange(p.value); }}
              aria-pressed={active}
              title={p.sub}
              className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                active
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
              }`}
            >
              {active && <Check className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white text-indigo-600 rounded-full p-0.5 border border-indigo-600" aria-hidden="true" />}
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          aria-pressed={showCustom}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
            showCustom
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
              : 'bg-white border-dashed border-slate-300 text-slate-500 hover:border-indigo-300 hover:text-indigo-700'
          }`}
        >
          Custom...
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2">
          <label htmlFor={`${id ?? 'termin'}-custom`} className="text-xs text-slate-500 font-medium">Termin custom:</label>
          <input
            id={`${id ?? 'termin'}-custom`}
            type="number"
            min={0}
            max={365}
            value={value}
            onChange={e => onChange(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
            className="w-24 px-2.5 py-1 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          />
          <span className="text-xs text-slate-500">hari</span>
        </div>
      )}
    </div>
  );
}
