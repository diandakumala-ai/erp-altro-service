/**
 * Imperative confirm dialog API — pengganti `window.confirm()`.
 *
 * Pemakaian:
 * ```ts
 * if (await confirm({ title: 'Hapus?', message: '...', destructive: true })) {
 *   doDelete();
 * }
 * ```
 *
 * Membutuhkan `<ConfirmDialogHost />` ter-mount di tree (sudah di App.tsx).
 */
import type { ReactNode } from 'react';

export type ConfirmVariant = 'danger' | 'warning' | 'primary';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  /** Default: 'Konfirmasi' (atau 'Hapus' jika destructive). */
  confirmLabel?: string;
  /** Default: 'Batal'. */
  cancelLabel?: string;
  /** Skema warna tombol konfirmasi. Default: 'primary' (atau 'danger' jika destructive). */
  variant?: ConfirmVariant;
  /** Shortcut: set true untuk action destruktif (icon AlertTriangle merah, tombol danger). */
  destructive?: boolean;
}

export interface ActiveConfirm extends ConfirmOptions {
  id: string;
  resolve: (v: boolean) => void;
}

let active: ActiveConfirm | null = null;
let listener: (a: ActiveConfirm | null) => void = () => {};

/**
 * Tampilkan confirm dialog. Resolve `true` jika user klik Konfirmasi,
 * `false` jika user klik Batal / tekan Esc / klik backdrop.
 */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  // Jika sudah ada confirm aktif, resolve yang lama dengan false (cancel)
  if (active) {
    active.resolve(false);
    active = null;
  }
  return new Promise<boolean>((resolve) => {
    const id = Math.random().toString(36).slice(2);
    active = { ...opts, id, resolve };
    listener(active);
  });
}

/** Hanya untuk dipakai oleh `<ConfirmDialogHost />`. */
export const __confirmHost = {
  subscribe(fn: (a: ActiveConfirm | null) => void) {
    listener = fn;
    fn(active);
    return () => {
      listener = () => {};
    };
  },
  resolve(value: boolean) {
    if (active) {
      active.resolve(value);
      active = null;
      listener(null);
    }
  },
};
