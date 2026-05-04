import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { Users, Wrench, Package, Receipt, Menu, ChevronLeft, Loader2, LayoutDashboard, LogOut, Settings as SettingsIcon } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

import WorkOrders from './pages/WorkOrders'
import Inventory from './pages/Inventory'
import Finance from './pages/Finance'
import Customers from './pages/Customers'
import PrintTemplates from './pages/PrintTemplates'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Settings from './pages/Settings'

import { loadAllData, loadSettings, isDatabaseEmpty, seedDatabase } from './lib/db'
import { useStore } from './store/useStore'
import { supabase } from './lib/supabase'
import { Toaster } from './components/Toaster'
import { ConfirmDialogHost } from './components/ConfirmDialogHost'
import { NotificationBell } from './components/NotificationBell'
import { toast } from './lib/toast'

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/work-orders', label: 'Work Orders', icon: Wrench },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/finance', label: 'Finance', icon: Receipt },
  { to: '/settings', label: 'Pengaturan', icon: SettingsIcon },
];

const Sidebar = ({
  collapsed, onToggle, user, onLogout
}: {
  collapsed: boolean; onToggle: () => void;
  user: { email: string } | null;
  onLogout: () => void;
}) => {
  const location = useLocation();
  const initials = user?.email?.slice(0, 1).toUpperCase() ?? 'A';
  const emailDisplay = user?.email ?? 'admin@altro.com';

  return (
    <div className={`bg-slate-900 text-slate-300 h-screen flex flex-col shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`}>
      {collapsed ? (
        <div className="h-12 border-b border-slate-800 flex items-center justify-center">
          <button onClick={onToggle} title="Perluas sidebar" aria-label="Perluas sidebar"
            className="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <Menu className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="h-12 px-3 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 p-1 overflow-hidden">
            <img src={import.meta.env.BASE_URL + 'primary-logo.png'} alt="Logo CV Altro" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white leading-none">ALTRO ERP</h1>
            <p className="text-xs text-slate-400 mt-0.5">CV Altro Service</p>
          </div>
          <button onClick={onToggle} title="Ciutkan sidebar" aria-label="Ciutkan sidebar"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        {!collapsed && <p className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu</p>}
        <ul className="space-y-0.5 px-2">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to || (to === '/dashboard' && location.pathname === '/') || location.pathname.startsWith(to + '/');
            return (
              <li key={to}>
                <Link to={to} title={collapsed ? label : undefined}
                  className={`flex items-center gap-3 px-2.5 py-2.5 rounded-md text-sm font-medium transition-all ${isActive ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-slate-800 flex items-center gap-3 overflow-hidden">
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium truncate">{emailDisplay}</p>
              <p className="text-2xs text-slate-400 truncate">Administrator</p>
            </div>
            <NotificationBell />
            <button
              onClick={onLogout}
              title="Keluar"
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {collapsed && (
          <NotificationBell />
        )}
      </div>
    </div>
  );
};


function AppShell({ session }: { session: Session }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [loadStatus, setLoadStatus] = useState('Menghubungkan ke database...');
  const [loadError, setLoadError] = useState<string | null>(null);
  const setAllData = useStore(s => s.setAllData);
  const location = useLocation();
  const isPrintPage = location.pathname.startsWith('/print');

  useEffect(() => {
    const init = async () => {
      try {
        setLoadStatus('Memeriksa database...');

        // Cek apakah DB kosong (instalasi pertama kali)
        const empty = await isDatabaseEmpty();

        if (empty) {
          // Ambil data seed dari store (initial state sebelum di-overwrite)
          const storeState = useStore.getState();
          const hasSeedData = storeState.workOrders.length > 0;

          if (hasSeedData) {
            setLoadStatus('Setup awal: menyimpan data ke Supabase... (ini hanya sekali)');
            await seedDatabase({
              workOrders: storeState.workOrders,
              inventory: storeState.inventory,
              finance: storeState.finance,
              boms: storeState.boms,
              services: storeState.services,
              customers: storeState.customers,
            });
            toast.success('Data berhasil disinkronisasi ke Supabase!');
          }
        }

        setLoadStatus('Memuat data...');
        const [data, settings] = await Promise.all([loadAllData(), loadSettings()]);
        setAllData({ ...data, ...(settings ? { bengkelSettings: settings } : {}) });
        setAppLoading(false);
      } catch (err) {
        console.error('Gagal inisialisasi:', err);
        setLoadError('Gagal terhubung ke database. Periksa koneksi internet dan konfigurasi Supabase.');
        setAppLoading(false);
      }
    };
    init();
  }, [setAllData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.info('Berhasil keluar dari sistem.');
  };

  if (appLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4 text-slate-500">
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md p-2">
            <img src={import.meta.env.BASE_URL + 'primary-logo.png'} alt="Logo" className="w-full h-full object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <p className="text-sm font-medium">{loadStatus}</p>
          <p className="text-xs text-slate-400">ALTRO ERP v1.0</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md text-center">
          <p className="text-red-500 font-semibold mb-2">Gagal Memuat Data</p>
          <p className="text-slate-500 text-sm mb-4">{loadError}</p>
          <button onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  // ── Halaman cetak: tampilkan tanpa sidebar ──────────────────────────
  if (isPrintPage) {
    return (
      <Routes>
        <Route path="/print/:type/:id" element={<PrintTemplates />} />
        <Route path="/print/:type" element={<PrintTemplates />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen w-full font-sans text-slate-900 overflow-hidden bg-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
        user={{ email: session.user?.email ?? '' }}
        onLogout={handleLogout}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-hidden flex">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/work-orders" element={<WorkOrders />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/print/:type/:id" element={<PrintTemplates />} />
            <Route path="/print/:type" element={<PrintTemplates />} />
            <Route path="*" element={
              <div className="flex-1 p-10 flex flex-col items-center justify-center text-slate-400">
                <h2 className="text-2xl font-semibold mb-2">Segera Hadir</h2>
                <p>Halaman ini masih dalam tahap pengembangan.</p>
              </div>
            } />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Loading auth state
  if (session === undefined) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <>
      <Router basename="/">
        {session ? (
          <AppShell session={session} />
        ) : (
          <Routes>
            <Route path="*" element={<Login />} />
          </Routes>
        )}
      </Router>
      <Toaster />
      <ConfirmDialogHost />
    </>
  );
}

export default App;
