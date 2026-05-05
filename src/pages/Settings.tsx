import { useState } from 'react';
import { Save, Building2, User, Phone, Mail, MapPin, FileText, Eye, EyeOff, Upload, Trash2, Lock, Loader2, ShieldCheck, CalendarClock } from 'lucide-react';
import { useStore, type BengkelSettings } from '../store/useStore';
import { toast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { Button, Section as UISection, TerminSelector } from '../components/ui';
import { cityShort } from '../lib/format';

function FormField({
  label, value, onChange, placeholder, icon: Icon, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ElementType;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus:border-indigo-400 bg-white placeholder:text-slate-300"
      />
      {hint && <p className="text-tiny text-slate-400">{hint}</p>}
    </div>
  );
}

/** Wrapper Section local — pakai shared UISection dengan grid 2 kolom default. */
function Section({ title, icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <UISection title={title} icon={icon} bodyClassName="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
      {children}
    </UISection>
  );
}

function KopSuratPreview({ s }: { s: BengkelSettings }) {
  return (
    <UISection title="Preview Kop Surat" icon={Eye} accent="emerald"
      rightSlot={<span className="text-tiny text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Tampilan di print / PDF</span>}>
        <div className="border border-slate-200 rounded-lg p-5 bg-slate-50">
          {/* Kop Surat Preview */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={s.logoUrl || '/primary-logo.png'}
                  alt="Logo"
                  className="w-full h-full object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div>
                <p className="text-base font-black text-slate-900 leading-tight">{s.namaBengkel || 'Nama Bengkel'}</p>
                <p className="text-tiny text-slate-500">{s.alamat}{s.kota ? `, ${s.kota}` : ''}</p>
                <p className="text-tiny text-slate-500">
                  {s.telepon && `Telp: ${s.telepon}`}
                  {s.telepon && s.hp && ' | '}
                  {s.hp && `HP: ${s.hp}`}
                </p>
                {s.email && <p className="text-tiny text-slate-500">Email: {s.email}</p>}
                {s.npwp && <p className="text-tiny text-slate-500">NPWP: {s.npwp}</p>}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-semibold text-slate-700">No. Dokumen : WO-XXXX-XXX</p>
              <p className="mt-1">Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Signature preview */}
          <div className="mt-4 flex justify-end">
            <div className="text-center text-xs text-slate-500 w-40">
              <p>{cityShort(s.kota) || 'Kota'}, ___________</p>
              <div className="h-10 border-b border-dashed border-slate-300 my-2" />
              <p className="font-semibold text-slate-700">{s.namaPemilik || '( Nama Pemilik )'}</p>
              <p className="text-slate-400">{s.jabatanPemilik || 'Jabatan'}</p>
            </div>
          </div>
        </div>
    </UISection>
  );
}

// Indikator persyaratan password — di-lift keluar agar tidak re-create tiap render.
function Req({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {children}
    </li>
  );
}

// ── Panel ganti password (re-auth dulu, lalu update) ────────────
function PasswordChangePanel() {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validasi kekuatan password
  const lenOk = newPwd.length >= 12;
  const hasLetter = /[A-Za-z]/.test(newPwd);
  const hasNumber = /\d/.test(newPwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(newPwd);
  const strengthOk = lenOk && hasLetter && hasNumber && hasSymbol;
  const matchOk = newPwd.length > 0 && newPwd === confirmPwd;
  const differentOk = newPwd !== oldPwd;
  const canSubmit = oldPwd.length > 0 && strengthOk && matchOk && differentOk && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);

    // Verifikasi password lama dulu (re-auth) — Supabase JS tidak melakukannya
    // otomatis di updateUser, jadi kalau session attacker hijack, password lama
    // tetap diperlukan untuk ganti.
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (userErr || !email) {
      toast.error('Sesi tidak valid. Silakan login ulang.');
      setLoading(false);
      return;
    }

    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email,
      password: oldPwd,
    });
    if (verifyErr) {
      toast.error('Password lama salah.');
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd });
    if (updateErr) {
      toast.error(`Gagal mengganti password: ${updateErr.message}`);
      setLoading(false);
      return;
    }

    toast.success('Password berhasil diganti.');
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setLoading(false);
  };

  return (
    <UISection title="Akun & Keamanan" icon={ShieldCheck} accent="red"
      rightSlot={<span className="text-tiny text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Ganti Password</span>}
      bodyClassName="p-0">
      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Password lama */}
        <div className="col-span-2">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Password Lama
          </label>
          <div className="relative">
            <input
              type={showOld ? 'text' : 'password'}
              value={oldPwd}
              onChange={e => setOldPwd(e.target.value)}
              autoComplete="current-password"
              placeholder="Masukkan password lama"
              className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus:border-red-400 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowOld(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded"
              aria-label={showOld ? 'Sembunyikan password lama' : 'Tampilkan password lama'}
            >
              {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Password baru */}
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Password Baru
          </label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              autoComplete="new-password"
              placeholder="Minimal 12 karakter"
              className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus:border-red-400 bg-white"
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded"
              aria-label={showNew ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Konfirmasi password baru */}
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Ulangi Password Baru
          </label>
          <input
            type={showNew ? 'text' : 'password'}
            value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            autoComplete="new-password"
            placeholder="Ketik ulang password baru"
            className={`w-full px-3 py-2 text-sm border rounded-lg focus-visible:outline-none focus-visible:ring-2 bg-white ${
              confirmPwd.length === 0
                ? 'border-slate-200 focus-visible:ring-red-300 focus:border-red-400'
                : matchOk
                ? 'border-emerald-300 focus-visible:ring-emerald-300 focus:border-emerald-400'
                : 'border-red-300 focus-visible:ring-red-300 focus:border-red-400'
            }`}
          />
        </div>

        {/* Indikator kekuatan password */}
        {newPwd.length > 0 && (
          <div className="col-span-2 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5">
            <p className="text-tiny font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Syarat password baru</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <Req ok={lenOk}>Minimal 12 karakter</Req>
              <Req ok={hasLetter}>Mengandung huruf</Req>
              <Req ok={hasNumber}>Mengandung angka</Req>
              <Req ok={hasSymbol}>Mengandung simbol (!@#…)</Req>
              <Req ok={differentOk}>Berbeda dari password lama</Req>
              <Req ok={matchOk}>Konfirmasi cocok</Req>
            </ul>
          </div>
        )}

        <div className="col-span-2 flex justify-end">
          <Button type="submit" variant="danger" size="md" disabled={!canSubmit}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {loading ? 'Memproses...' : 'Ganti Password'}
          </Button>
        </div>
      </form>
    </UISection>
  );
}

export default function Settings() {
  const savedSettings = useStore(s => s.bengkelSettings);
  const updateBengkelSettings = useStore(s => s.updateBengkelSettings);

  const [form, setForm] = useState<BengkelSettings>({ ...savedSettings });
  const [dirty, setDirty] = useState(false);

  const update = (field: keyof BengkelSettings, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updateBengkelSettings(form);
    setDirty(false);
    toast.success('Pengaturan berhasil disimpan!');
  };

  const handleReset = () => {
    setForm({ ...savedSettings });
    setDirty(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-12 flex items-center pl-14 pr-4 lg:px-6 justify-between shrink-0">
        <h2 className="text-base font-semibold text-slate-800">Pengaturan Sistem</h2>
        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="secondary" onClick={handleReset}>
              Batalkan Perubahan
            </Button>
          )}
          <Button variant="primary" onClick={handleSave} disabled={!dirty}>
            <Save className="w-4 h-4" />
            Simpan Pengaturan
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-5">

          {/* Info Bengkel */}
          <Section title="Informasi Bengkel" icon={Building2}>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                Logo Perusahaan
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={form.logoUrl || '/primary-logo.png'}
                    alt="Logo"
                    className="w-full h-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 cursor-pointer flex items-center gap-2 transition-colors">
                      <Upload className="w-4 h-4" />
                      Upload Logo
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error('Ukuran file maksimal 2MB');
                            return;
                          }
                          // Cek MIME yang dilaporkan browser
                          const allowedMime = ['image/png', 'image/jpeg', 'image/webp'];
                          if (!allowedMime.includes(file.type)) {
                            toast.error('Format file tidak didukung. Pakai PNG, JPG, atau WebP.');
                            return;
                          }
                          // Verifikasi magic bytes — cegah upload file disguised
                          const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
                          const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
                          const isJpg = head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF;
                          const isWebp =
                            head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
                            head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
                          if (!isPng && !isJpg && !isWebp) {
                            toast.error('Isi file tidak valid sebagai gambar.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            update('logoUrl', ev.target?.result as string);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {form.logoUrl && (
                      <Button variant="soft-danger" onClick={() => update('logoUrl', '')}>
                        <Trash2 className="w-4 h-4" />
                        Hapus
                      </Button>
                    )}
                  </div>
                  <p className="text-tiny text-slate-500">Format: JPG, PNG, WEBP. Maks 2MB. Disarankan rasio kotak / horizontal.</p>
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <FormField
                label="Nama Bengkel / Perusahaan"
                value={form.namaBengkel}
                onChange={v => update('namaBengkel', v)}
                placeholder="CV Altro Service"
                icon={Building2}
              />
            </div>
            <div className="col-span-2">
              <FormField
                label="Alamat"
                value={form.alamat}
                onChange={v => update('alamat', v)}
                placeholder="Jl. Pemudi No. 8A, Payung Sekaki"
                icon={MapPin}
              />
            </div>
            <FormField
              label="Kota / Provinsi"
              value={form.kota}
              onChange={v => update('kota', v)}
              placeholder="Pekanbaru, Riau"
              icon={MapPin}
            />
            <FormField
              label="Nomor Telepon"
              value={form.telepon}
              onChange={v => update('telepon', v)}
              placeholder="0761-8405083"
              icon={Phone}
            />
            <FormField
              label="Nomor HP / WhatsApp"
              value={form.hp}
              onChange={v => update('hp', v)}
              placeholder="0812668188"
              icon={Phone}
            />
            <FormField
              label="Email"
              value={form.email}
              onChange={v => update('email', v)}
              placeholder="altroservice1@gmail.com"
              icon={Mail}
            />
            <div className="col-span-2">
              <FormField
                label="NPWP"
                value={form.npwp}
                onChange={v => update('npwp', v)}
                placeholder="XX.XXX.XXX.X-XXX.XXX (kosongkan jika tidak ada)"
                icon={FileText}
                hint="Akan muncul di kop surat jika diisi."
              />
            </div>
          </Section>

          {/* Info Pemilik / Tanda Tangan */}
          <Section title="Tanda Tangan & Pemilik" icon={User}>
            <FormField
              label="Nama Pemilik / Penandatangan"
              value={form.namaPemilik}
              onChange={v => update('namaPemilik', v)}
              placeholder="Nama lengkap pemilik"
              icon={User}
            />
            <FormField
              label="Jabatan"
              value={form.jabatanPemilik}
              onChange={v => update('jabatanPemilik', v)}
              placeholder="Pimpinan / Direktur"
              icon={User}
              hint="Ditampilkan di bawah nama pada kolom tanda tangan."
            />
          </Section>

          {/* Preview */}
          <KopSuratPreview s={form} />

          {/* Default Termin Pembayaran */}
          <UISection
            title="Default Termin Pembayaran"
            icon={CalendarClock}
            accent="indigo"
            rightSlot={<span className="text-tiny text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Otomatis untuk SPK baru</span>}
          >
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500">
                Setiap WO baru akan otomatis pakai termin ini. Bisa di-override per WO di
                modal "Detail Pekerjaan & Material". <b>COD</b> = lunas saat barang diserahkan
                (auto-record pelunasan saat status Finished). <b>NET</b> = pelanggan punya N hari
                untuk bayar setelah tanggal invoice terbit.
              </p>
              <TerminSelector
                id="default-termin"
                value={form.defaultTerminHari ?? 0}
                onChange={(v) => { setForm(prev => ({ ...prev, defaultTerminHari: v })); setDirty(true); }}
              />
              <div className="text-tiny text-slate-400 italic">
                Saat ini default: <b>{(form.defaultTerminHari ?? 0) === 0 ? 'COD (Lunas di Tempat)' : `NET ${form.defaultTerminHari} hari`}</b>
              </div>
            </div>
          </UISection>

          {/* Akun & Keamanan */}
          <PasswordChangePanel />

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
            <p className="font-semibold mb-1">ℹ️ Catatan</p>
            <p>Pengaturan ini disimpan di perangkat ini (browser). Data akan tetap ada selama Anda tidak menghapus data browser. Kop surat pada semua dokumen cetak (SPK, Invoice, Laporan) akan otomatis menggunakan data ini.</p>
          </div>

        </div>
      </main>
    </div>
  );
}
