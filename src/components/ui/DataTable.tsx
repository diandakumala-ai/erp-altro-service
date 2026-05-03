import { useState, type ReactNode } from 'react';

export type SortDir = 'asc' | 'desc';

interface DataHeaderProps {
  label: string;
  field?: string;
  sortField: string | null;
  sortDir: SortDir;
  onSort: (f: string) => void;
  w?: string;
}

/** Header sel tabel — sortable dengan keyboard support (Enter/Space). */
export function DataHeader({ label, field, sortField, sortDir, onSort, w }: DataHeaderProps) {
  const active = sortField === field;
  const sortable = !!field;
  return (
    <th
      scope="col"
      role={sortable ? 'columnheader' : undefined}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
      tabIndex={sortable ? 0 : undefined}
      onClick={() => field && onSort(field)}
      onKeyDown={(e) => {
        if (!field) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(field); }
      }}
      className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-inset ${sortable ? 'cursor-pointer hover:bg-slate-100' : ''} ${w ?? ''}`}
    >
      {label}
      {sortable && (
        <span className={`ml-1 ${active ? 'text-indigo-500' : 'text-slate-300'}`} aria-hidden="true">
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      )}
    </th>
  );
}

interface DataCellProps {
  value: string | number;
  onSave: (v: string) => void;
  /** Tipe input HTML saat editing (default 'text'). */
  type?: string;
  /** Format display sebagai angka (Intl id-ID). */
  numericFormat?: boolean;
  /** Placeholder saat value kosong. */
  placeholder?: string;
  /** Aria label kustom. */
  ariaLabel?: string;
}

/** Sel tabel inline-editable. Aktivasi: double-click (mouse) atau Enter/F2 (keyboard). */
export function DataCell({ value, onSave, type = 'text', numericFormat = false, placeholder, ariaLabel = 'Edit nilai' }: DataCellProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value ?? ''));
  const display = numericFormat ? new Intl.NumberFormat('id-ID').format(Number(value || 0)) : String(value ?? '');

  const startEdit = () => { setVal(String(value ?? '')); setEditing(true); };

  return editing ? (
    <input
      autoFocus
      type={type}
      placeholder={placeholder}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="w-full border border-indigo-400 rounded px-1.5 py-0.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={() => { onSave(val); setEditing(false); }}
      onKeyDown={e => {
        if (e.key === 'Enter') { onSave(val); setEditing(false); }
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  ) : (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${ariaLabel}. Tekan Enter untuk mengubah.`}
      className="cursor-pointer hover:text-indigo-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded"
      onDoubleClick={startEdit}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); startEdit(); } }}
    >
      {(numericFormat ? display : value) ? (numericFormat ? display : value) : (
        placeholder ? <span className="text-slate-300 italic">{placeholder}</span> : <span className="text-slate-300">—</span>
      )}
    </span>
  );
}

interface EmptyStateProps {
  colSpan: number;
  message: ReactNode;
}

/** Baris empty state untuk tabel. */
export function EmptyRow({ colSpan, message }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12 text-slate-400">
        {message}
      </td>
    </tr>
  );
}
