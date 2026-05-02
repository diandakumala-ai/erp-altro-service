import { useState } from 'react';
import { Save, Building2, User, Phone, Mail, MapPin, FileText, Eye, Upload, Trash2 } from 'lucide-react';
import { useStore, type BengkelSettings } from '../store/useStore';
import { toast } from '../lib/toast';

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
        className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 bg-white placeholder:text-slate-300"
      />
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-6 grid grid-cols-2 gap-5">
        {children}
      </div>
    </div>
  );
}

function KopSuratPreview({ s }: { s: BengkelSettings }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
          <Eye className="w-4 h-4 text-emerald-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">Preview Kop Surat</h3>
        <span className="ml-auto text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Tampilan di print / PDF</span>
      </div>
      <div className="p-6">
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
                <p className="text-[11px] text-slate-500">{s.alamat}{s.kota ? `, ${s.kota}` : ''}</p>
                <p className="text-[11px] text-slate-500">
                  {s.telepon && `Telp: ${s.telepon}`}
                  {s.telepon && s.hp && ' | '}
                  {s.hp && `HP: ${s.hp}`}
                </p>
                {s.email && <p className="text-[11px] text-slate-500">Email: {s.email}</p>}
                {s.npwp && <p className="text-[11px] text-slate-500">NPWP: {s.npwp}</p>}
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
              <p>{s.kota || 'Kota'}, ___________</p>
              <div className="h-10 border-b border-dashed border-slate-300 my-2" />
              <p className="font-semibold text-slate-700">{s.namaPemilik || '( Nama Pemilik )'}</p>
              <p className="text-slate-400">{s.jabatanPemilik || 'Jabatan'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
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
      <header className="bg-white border-b border-slate-200 h-12 flex items-center px-6 justify-between shrink-0">
        <h2 className="text-base font-semibold text-slate-800">Pengaturan Sistem</h2>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Batalkan Perubahan
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium text-sm transition-colors shadow-sm ${
              dirty
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan
          </button>
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
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              toast.error('Ukuran file maksimal 2MB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              update('logoUrl', ev.target?.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                    {form.logoUrl && (
                      <button 
                        onClick={() => update('logoUrl', '')}
                        className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Hapus
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">Format: JPG, PNG, WEBP. Maks 2MB. Disarankan rasio kotak / horizontal.</p>
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
