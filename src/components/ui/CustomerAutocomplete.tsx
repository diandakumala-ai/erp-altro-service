import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type { Customer } from '../../store/useStore';

interface CustomerAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  customers: Customer[];
  /** Saat customer dipilih dari dropdown — opsional, dipakai kalau caller butuh tahu objek customers-nya. */
  onSelect?: (c: Customer) => void;
  ariaLabel?: string;
  placeholder?: string;
  /** Default 'inline' (kompak utk tabel). 'modal' = lebih lebar. */
  variant?: 'inline' | 'modal';
}

/**
 * Input pelanggan dengan autocomplete dari list customers + link ke halaman
 * Customers untuk mengelola data pelanggan secara penuh.
 *
 * Pola serupa BomRow material autocomplete di WorkOrders.
 */
export function CustomerAutocomplete({
  value, onChange, customers, onSelect,
  ariaLabel = 'Cari/pilih pelanggan',
  placeholder = 'Ketik nama pelanggan…',
  variant = 'inline',
}: CustomerAutocompleteProps) {
  const [showDrop, setShowDrop] = useState(false);
  const [input, setInput] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value → internal
  useEffect(() => { setInput(value); }, [value]);

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    const list = q
      ? customers.filter(c =>
          c.nama.toLowerCase().includes(q) ||
          c.perusahaan.toLowerCase().includes(q) ||
          c.telepon.includes(q)
        )
      : customers;
    return list.slice(0, 25);
  }, [input, customers]);

  // Tutup dropdown saat klik luar
  useEffect(() => {
    if (!showDrop) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDrop]);

  const select = (c: Customer) => {
    // Prefer perusahaan kalau ada (lebih representatif untuk B2B)
    const display = c.perusahaan && c.perusahaan !== '-' ? c.perusahaan : c.nama;
    setInput(display);
    onChange(display);
    onSelect?.(c);
    setShowDrop(false);
  };

  const dropWidth = variant === 'modal' ? 'min-w-[340px]' : 'min-w-[280px]';

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); onChange(e.target.value); setShowDrop(true); }}
        onFocus={() => setShowDrop(true)}
        aria-label={ariaLabel}
        placeholder={placeholder}
        className="w-full border border-slate-200 rounded px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus:border-indigo-400 bg-white"
      />
      {showDrop && (
        <div
          className={`absolute left-0 top-full mt-0.5 bg-white border border-indigo-300 rounded-lg shadow-xl overflow-y-auto max-h-[260px] ${dropWidth}`}
          style={{ zIndex: 'var(--z-dropdown)' }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400">
              Tidak ada pelanggan cocok dengan "<b>{input}</b>".
              <br />Pelanggan baru akan otomatis terdaftar saat WO disimpan.
            </div>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); select(c); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex justify-between gap-3 items-start border-b border-slate-50 last:border-0 focus-visible:outline-none focus-visible:bg-indigo-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-700 truncate">
                    {c.perusahaan && c.perusahaan !== '-' ? c.perusahaan : c.nama}
                  </div>
                  <div className="text-2xs text-slate-400 truncate">
                    {c.id}
                    {c.nama && c.nama !== '-' && c.perusahaan && c.perusahaan !== '-' && ` · ${c.nama}`}
                    {c.telepon && c.telepon !== '-' && ` · ${c.telepon}`}
                  </div>
                </div>
                {c.totalWo > 0 && (
                  <span className="text-2xs font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded shrink-0">
                    {c.totalWo} WO
                  </span>
                )}
              </button>
            ))
          )}
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 sticky bottom-0">
            <Link
              to="/customers"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setShowDrop(false)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              <ExternalLink className="w-3 h-3" />
              Kelola data pelanggan
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
