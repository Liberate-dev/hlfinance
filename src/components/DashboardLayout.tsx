import { Home, Users, Package, FileText, BarChart2, Settings, LogOut } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const menuItems = [
  { id: 'beranda', label: 'Beranda', shortLabel: 'Home', icon: Home },
  { id: 'pelanggan', label: 'Pelanggan', shortLabel: 'Plg', icon: Users },
  { id: 'produk', label: 'Produk', shortLabel: 'Prod', icon: Package },
  { id: 'penjualan', label: 'Pencatatan Bon', shortLabel: 'Bon', icon: FileText },
  { id: 'laporan', label: 'Laporan', shortLabel: 'Lap', icon: BarChart2 },
  { id: 'admin', label: 'Admin', shortLabel: 'Adm', icon: Settings },
];

function NavButton({
  item,
  isActive,
  onClick,
  compact = false,
}: {
  item: (typeof menuItems)[number];
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const IconComponent = item.icon;

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex flex-1 flex-col items-center justify-center gap-1 px-1 py-2 min-h-[56px] rounded-xl font-bold transition-all ${
          isActive ? 'text-[#002B8F] bg-blue-50' : 'text-slate-500'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <IconComponent size={22} className={isActive ? 'text-[#002B8F]' : 'text-slate-400'} />
        <span className="text-[11px] leading-none">{item.shortLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center space-x-4 px-4 py-3.5 rounded-xl text-left font-bold transition-all duration-200 min-h-[52px] ${
        isActive
          ? 'bg-[#002B8F] text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <IconComponent size={22} className={isActive ? 'text-white' : 'text-slate-400'} />
      <span className="text-[16px] tracking-wide">{item.label}</span>
    </button>
  );
}

export default function DashboardLayout({
  children,
  activeTab,
  setActiveTab,
  onLogout,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 font-sans antialiased text-slate-800">
      <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <h2 className="text-xl font-extrabold text-[#002B8F] tracking-tight">HL Finance</h2>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 font-bold rounded-xl min-h-[48px]"
        >
          <LogOut size={20} />
          <span className="text-sm">Keluar</span>
        </button>
      </header>

      <aside className="hidden lg:flex w-72 h-screen bg-white border-r border-slate-200 flex-col justify-between shrink-0 sticky top-0">
        <div className="p-6 border-b border-slate-100 shrink-0">
          <h2 className="text-2xl font-extrabold text-[#002B8F] tracking-tight">HL Finance</h2>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          {menuItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center space-x-4 px-4 py-3.5 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold rounded-xl transition-all duration-200 min-h-[52px]"
          >
            <LogOut size={22} className="text-red-500" />
            <span className="text-[16px] tracking-wide">Keluar</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main id="app-main-scroll" className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-28 lg:pb-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 pt-1 pb-2 safe-area-pb shadow-[0_-4px_20px_rgba(15,23,42,0.08)]"
        aria-label="Navigasi utama"
      >
        <div className="flex items-stretch justify-between gap-1 max-w-3xl mx-auto">
          {menuItems.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
              compact
            />
          ))}
        </div>
      </nav>
    </div>
  );
}