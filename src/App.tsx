import { useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './components/DashboardPage';
import PelangganPage from './components/PelangganPage';
import ProdukPage from './components/ProdukPage';
import PenjualanPage from './components/PenjualanPage';
import LaporanPage from './components/LaporanPage';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { useStore } from './store/useStore';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('beranda');
  const { fetchAllData, isLoading, isHydrated, dataError } = useStore();

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
      setAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isLoggedIn && isSupabaseConfigured) {
      fetchAllData();
    }
  }, [isLoggedIn, fetchAllData]);

  const renderActiveContent = () => {
    if (isLoading && !isHydrated) {
      return (
        <div className="flex items-center justify-center min-h-[40vh] text-slate-500 font-medium">
          Memuat data...
        </div>
      );
    }

    if (dataError) {
      return (
        <div className="p-6 bg-red-50 border border-red-100 rounded-xl text-red-700">
          <p className="font-bold mb-1">Gagal memuat data</p>
          <p className="text-sm">{dataError}</p>
          <button
            onClick={() => fetchAllData()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'beranda':
        return <DashboardPage onNavigate={setActiveTab} />;
      case 'pelanggan':
        return <PelangganPage />;
      case 'produk':
        return <ProdukPage />;
      case 'penjualan':
        return <PenjualanPage />;
      case 'laporan':
        return <LaporanPage />;
      default:
        return <DashboardPage onNavigate={setActiveTab} />;
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Memuat...
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <DashboardLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={async () => {
        await supabase.auth.signOut();
        setIsLoggedIn(false);
        setActiveTab('beranda');
      }}
    >
      {renderActiveContent()}
    </DashboardLayout>
  );
}

export default App;