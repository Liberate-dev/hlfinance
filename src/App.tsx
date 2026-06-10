import { useState } from 'react';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardPage from './components/DashboardPage';
import PelangganPage from './components/PelangganPage';
import ProdukPage from './components/ProdukPage';
import PenjualanPage from './components/PenjualanPage';
import LaporanPage from './components/LaporanPage';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('beranda');

  const renderActiveContent = () => {
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

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      onLogout={() => {
        setIsLoggedIn(false);
        setActiveTab('beranda');
      }}
    >
      {renderActiveContent()}
    </DashboardLayout>
  );
}

export default App;
