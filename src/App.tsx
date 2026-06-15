import { useEffect, useState } from 'react';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './components/DashboardPage';
import PelangganPage from './components/PelangganPage';
import ProdukPage from './components/ProdukPage';
import PenjualanPage from './components/PenjualanPage';
import LaporanPage from './components/LaporanPage';
import AdminPage from './components/AdminPage';
import ForgotPasswordPage from './components/ForgotPasswordPage';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { useStore } from './store/useStore';
import AppToastHost from './components/ui/AppToast';
import { scrollToAppTop } from './lib/scrollToAppTop';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('beranda');
  const [penjualanStartInAdd, setPenjualanStartInAdd] = useState(false);
  const [penjualanSessionKey, setPenjualanSessionKey] = useState(0);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { fetchAllData, isLoading, isHydrated, dataError } = useStore();

  const navigateTo = (tab: string, options?: { openBonForm?: boolean }) => {
    if (tab === 'penjualan') {
      setPenjualanStartInAdd(!!options?.openBonForm);
      setPenjualanSessionKey((k) => k + 1);
    } else {
      setPenjualanStartInAdd(false);
    }
    setActiveTab(tab);
  };

  const navigateSidebar = (tab: string) => {
    setPenjualanStartInAdd(false);
    setActiveTab(tab);
  };

  useEffect(() => {
    scrollToAppTop();
  }, [activeTab]);

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
          <p className="text-base">{dataError}</p>
          <button
            onClick={() => fetchAllData()}
            className="mt-4 px-6 py-3 bg-red-600 text-white rounded-xl text-base font-bold min-h-[48px]"
          >
            Coba Lagi
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'beranda':
        return <DashboardPage onNavigate={navigateTo} />;
      case 'pelanggan':
        return <PelangganPage />;
      case 'produk':
        return <ProdukPage />;
      case 'penjualan':
        return (
          <PenjualanPage
            key={penjualanSessionKey}
            startInAddMode={penjualanStartInAdd}
          />
        );
      case 'laporan':
        return <LaporanPage />;
      case 'admin':
        return <AdminPage />;
      default:
        return <DashboardPage onNavigate={navigateTo} />;
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
    if (showForgotPassword) {
      return (
        <ForgotPasswordPage
          onBack={() => setShowForgotPassword(false)}
          onLogin={() => {
            setShowForgotPassword(false);
            setIsLoggedIn(true);
          }}
        />
      );
    }
    return (
      <LoginPage
        onLogin={() => setIsLoggedIn(true)}
        onForgotPassword={() => setShowForgotPassword(true)}
      />
    );
  }

  return (
    <>
      <DashboardLayout
        activeTab={activeTab}
        setActiveTab={navigateSidebar}
        onLogout={async () => {
          await supabase.auth.signOut();
          setIsLoggedIn(false);
          setPenjualanStartInAdd(false);
          setActiveTab('beranda');
        }}
      >
        {renderActiveContent()}
      </DashboardLayout>
      <AppToastHost />
    </>
  );
}

export default App;