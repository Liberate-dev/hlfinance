import { 
  Wallet, 
  TrendingUp, 
  PiggyBank, 
  Users, 
  FileText, 
  UserPlus, 
  BarChart2,
  Package,
  Receipt
} from 'lucide-react';

import { useStore } from '../store/useStore';

interface DashboardPageProps {
  onNavigate: (tab: string, options?: { openBonForm?: boolean }) => void;
}

const formatAmount = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('id-ID');

function KpiAmount({ value, tone }: { value: number; tone: 'blue' | 'emerald' | 'rose' | 'slate' }) {
  const toneClass = {
    blue: 'text-[#002B8F]',
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    slate: 'text-slate-800',
  }[tone];

  return (
    <div className={`font-extrabold tracking-tight leading-none mt-1 min-w-0 ${toneClass}`}>
      <div className={`text-lg font-black mb-1.5 ${toneClass}`}>Rp</div>
      <div className="text-[clamp(1.1rem,3.2vw,1.65rem)] break-all">{formatAmount(value)}</div>
    </div>
  );
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { transactions, customers, setShowAddCustomer } = useStore();

  const currentMonthYear = new Date().toISOString().substring(0, 7); // e.g. "2026-06"
  const currentMonthBons = transactions.filter(t => t.tanggal.startsWith(currentMonthYear));

  const totalPiutang = transactions
    .filter(t => t.status === 'Open')
    .reduce((sum, t) => sum + t.omzet + t.ongkir, 0);

  const omzetBulanIni = currentMonthBons
    .filter(t => t.status === 'Lunas')
    .reduce((sum, t) => sum + t.omzet, 0);

  const labaBulanIni = currentMonthBons
    .filter(t => t.status === 'Lunas')
    .reduce((sum, t) => {
      const txLaba = t.lines.reduce((sub, line) => {
        const modal = line.harga_modal_snapshot || 0;
        return sub + (line.harga_final - modal) * line.qty;
      }, 0);
      return sum + txLaba;
    }, 0);

  const pelangganAktifCount = customers.filter(c => c.deleted_at === null).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Judul Halaman */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Beranda
        </h1>
        <p className="text-slate-500 text-base font-semibold mt-1">
          Selamat datang kembali! Berikut adalah ringkasan performa keuangan HL Finance hari ini.
        </p>
      </div>

      {/* KPI SUMMARY CARDS (Ramah Lansia: Huruf Sangat Besar, Kontras Tinggi) */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Piutang */}
        <div className="bg-white border-2 border-slate-200/60 rounded-2xl p-6 shadow-xs hover:border-[#002B8F] transition-all flex flex-col justify-between min-h-[11rem] overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-blue-50 text-[#002B8F] rounded-xl">
              <Wallet size={24} />
            </div>
            <span className="bg-amber-100 text-amber-800 text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Piutang
            </span>
          </div>
          <div className="mt-4 min-w-0">
            <p className="text-[14px] font-bold text-slate-500 uppercase tracking-wide">
              Total Piutang
            </p>
            <KpiAmount value={totalPiutang} tone="blue" />
          </div>
        </div>

        {/* Omzet Bulan Ini */}
        <div className="bg-white border-2 border-slate-200/60 rounded-2xl p-6 shadow-xs hover:border-emerald-600 transition-all flex flex-col justify-between min-h-[11rem] overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Lunas (Omzet)
            </span>
          </div>
          <div className="mt-4 min-w-0">
            <p className="text-[14px] font-bold text-slate-500 uppercase tracking-wide">
              Omzet Bulan Ini
            </p>
            <KpiAmount value={omzetBulanIni} tone="emerald" />
          </div>
        </div>

        {/* Laba HL Bulan Ini */}
        <div className="bg-white border-2 border-slate-200/60 rounded-2xl p-6 shadow-xs hover:border-emerald-600 transition-all flex flex-col justify-between min-h-[11rem] overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <PiggyBank size={24} />
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Lunas (Laba)
            </span>
          </div>
          <div className="mt-4 min-w-0">
            <p className="text-[14px] font-bold text-slate-500 uppercase tracking-wide">
              Laba HL Bulan Ini
            </p>
            <KpiAmount value={labaBulanIni} tone={labaBulanIni < 0 ? 'rose' : 'emerald'} />
          </div>
        </div>

        {/* Pelanggan Aktif */}
        <div className="bg-white border-2 border-slate-200/60 rounded-2xl p-6 shadow-xs hover:border-slate-400 transition-all flex flex-col justify-between min-h-[11rem] overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
              <Users size={24} />
            </div>
            <span className="bg-slate-100 text-slate-700 text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wide">
              Aktif
            </span>
          </div>
          <div className="mt-4 min-w-0">
            <p className="text-[14px] font-bold text-slate-500 uppercase tracking-wide">
              Pelanggan Aktif
            </p>
            <p className="text-[clamp(1.25rem,3.2vw,1.75rem)] font-extrabold text-slate-800 tracking-tight mt-1 leading-tight">
              {pelangganAktifCount} Orang
            </p>
          </div>
        </div>
      </div>

      {/* AKSI CEPAT (Ramah Lansia: Bentuk Kotak/Square, Teks Tengah, Mudah Ditekan) */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Aksi Cepat
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-5">
          {/* Tombol Buat Bon Baru */}
          <button
            onClick={() => onNavigate('penjualan', { openBonForm: true })}
            className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-[#002B8F] font-bold rounded-2xl shadow-sm border-2 border-blue-100/50 transition-all duration-200 active:scale-[0.95] aspect-square space-y-3 cursor-pointer"
          >
            <div className="p-2.5 bg-blue-100 text-[#002B8F] rounded-xl">
              <FileText size={28} />
            </div>
            <span className="text-[15px] tracking-wide text-center leading-snug px-1">Buat Bon Baru</span>
          </button>

          {/* Tombol Daftar Transaksi */}
          <button
            onClick={() => onNavigate('penjualan')}
            className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-[#002B8F] font-bold rounded-2xl shadow-sm border-2 border-blue-100/50 transition-all duration-200 active:scale-[0.95] aspect-square space-y-3 cursor-pointer"
          >
            <div className="p-2.5 bg-blue-100 text-[#002B8F] rounded-xl">
              <Receipt size={28} />
            </div>
            <span className="text-[15px] tracking-wide text-center leading-snug px-1">Daftar Transaksi</span>
          </button>

          {/* Tombol Daftar Pelanggan */}
          <button
            onClick={() => onNavigate('pelanggan')}
            className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-[#002B8F] font-bold rounded-2xl shadow-sm border-2 border-blue-100/50 transition-all duration-200 active:scale-[0.95] aspect-square space-y-3 cursor-pointer"
          >
            <div className="p-2.5 bg-blue-100 text-[#002B8F] rounded-xl">
              <Users size={28} />
            </div>
            <span className="text-[15px] tracking-wide text-center leading-snug px-1">Daftar Pelanggan</span>
          </button>

          {/* Tombol Tambah Pelanggan */}
          <button
            onClick={() => {
              setShowAddCustomer(true);
              onNavigate('pelanggan');
            }}
            className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-[#002B8F] font-bold rounded-2xl shadow-sm border-2 border-blue-100/50 transition-all duration-200 active:scale-[0.95] aspect-square space-y-3 cursor-pointer"
          >
            <div className="p-2.5 bg-blue-100 text-[#002B8F] rounded-xl">
              <UserPlus size={28} />
            </div>
            <span className="text-[15px] tracking-wide text-center leading-snug px-1">Tambah Pelanggan</span>
          </button>

          {/* Tombol Katalog Produk */}
          <button
            onClick={() => onNavigate('produk')}
            className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-[#002B8F] font-bold rounded-2xl shadow-sm border-2 border-blue-100/50 transition-all duration-200 active:scale-[0.95] aspect-square space-y-3 cursor-pointer"
          >
            <div className="p-2.5 bg-blue-100 text-[#002B8F] rounded-xl">
              <Package size={28} />
            </div>
            <span className="text-[15px] tracking-wide text-center leading-snug px-1">Katalog Produk</span>
          </button>

          {/* Tombol Lihat Laporan */}
          <button
            onClick={() => onNavigate('laporan')}
            className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-[#002B8F] font-bold rounded-2xl shadow-sm border-2 border-blue-100/50 transition-all duration-200 active:scale-[0.95] aspect-square space-y-3 cursor-pointer"
          >
            <div className="p-2.5 bg-blue-100 text-[#002B8F] rounded-xl">
              <BarChart2 size={28} />
            </div>
            <span className="text-[15px] tracking-wide text-center leading-snug px-1">Lihat Laporan</span>
          </button>
        </div>
      </div>

    </div>
  );
}
