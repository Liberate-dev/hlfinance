import React from 'react';
import { Home, Users, Package, FileText, BarChart2, LogOut } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export default function DashboardLayout({ 
  children, 
  activeTab, 
  setActiveTab, 
  onLogout 
}: DashboardLayoutProps) {
  
  const menuItems = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'pelanggan', label: 'Pelanggan', icon: Users },
    { id: 'produk', label: 'Produk', icon: Package },
    { id: 'penjualan', label: 'Pencatatan Bon', icon: FileText },
    { id: 'laporan', label: 'Laporan', icon: BarChart2 },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans antialiased text-slate-800">
      {/* Sidebar Navigasi Kiri */}
      <aside className="w-72 h-screen bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 sticky top-0">
        {/* Header Sidebar */}
        <div className="p-6 border-b border-slate-100 shrink-0">
          <h2 className="text-2xl font-extrabold text-[#002B8F] tracking-tight">
            HL Finance
          </h2>
        </div>

        {/* Menu Navigasi */}
        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-4 px-4 py-3.5 rounded-xl text-left font-bold transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#002B8F] text-white shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
                style={{ minHeight: '52px' }} // Target sentuh besar ramah lansia
              >
                <IconComponent 
                  size={22} 
                  className={isActive ? 'text-white' : 'text-slate-400'} 
                />
                <span className="text-[16px] tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bagian Bawah Sidebar (Logout) */}
        <div className="p-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-4 px-4 py-3.5 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold rounded-xl transition-all duration-200"
            style={{ minHeight: '52px' }}
          >
            <LogOut size={22} className="text-red-500" />
            <span className="text-[16px] tracking-wide">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Konten Utama Kanan */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Kontainer Halaman */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
