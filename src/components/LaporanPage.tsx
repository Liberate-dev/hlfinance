import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import type { Customer } from '../store/useStore';
import jsPDF from 'jspdf';

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function LaporanPage() {
  const { transactions, customers } = useStore();

  // State Filter Bulan & Tahun (Default ke November 2024 sesuai mockup user)
  const [selectedMonth, setSelectedMonth] = useState<number | 'semua'>(11);
  const [selectedYear, setSelectedYear] = useState<number | 'semua'>(2024);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReportTab, setActiveReportTab] = useState<'semua' | 'LM' | 'BR' | 'bonus'>('semua');
  
  // State untuk Detail Modal Pelanggan
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

  // Pagination State untuk Tabel Utama (20 per halaman per PRD AC-6.2 / perf tablet)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const monthsList = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' }
  ];

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1;
  const yearsList = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

  const handleYearChange = (year: number | 'semua') => {
    setSelectedYear(year);
    if (year === currentYear && selectedMonth !== 'semua' && selectedMonth > currentMonthNum) {
      setSelectedMonth(currentMonthNum);
    }
  };

  // Dinamis generate label periode laporan (Sangat jelas untuk orang tua)
  const periodLabel = useMemo(() => {
    const monthLabel = selectedMonth === 'semua' ? 'Semua Bulan' : (monthsList.find(m => m.value === selectedMonth)?.label || '');
    const yearLabel = selectedYear === 'semua' ? 'Semua Tahun' : selectedYear.toString();
    
    if (selectedMonth === 'semua' && selectedYear === 'semua') return 'Semua Periode';
    if (selectedMonth === 'semua') return `Tahun ${yearLabel}`;
    if (selectedYear === 'semua') return `Bulan ${monthLabel} (Semua Tahun)`;
    return `${monthLabel} ${yearLabel}`;
  }, [selectedMonth, selectedYear, monthsList]);

  // Filter transaksi berdasarkan bulan/tahun terpilih (Mendukung opsi "Semua")
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const parts = t.tanggal.split('-');
      const txYear = parseInt(parts[0], 10);
      const txMonth = parseInt(parts[1], 10);
      
      const matchYear = selectedYear === 'semua' || txYear === selectedYear;
      const matchMonth = selectedMonth === 'semua' || txMonth === selectedMonth;
      
      return matchYear && matchMonth;
    });
  }, [transactions, selectedYear, selectedMonth]);

  // Transaksi bonus saja
  const bonusTransactions = useMemo(() => {
    return monthTransactions.filter(t => t.is_bonus);
  }, [monthTransactions]);

  // --- LOGIKA KALKULASI KPI UTAMA ---
  
  const metrics = useMemo(() => {
    let omzetLunas = 0;
    let labaHL = 0;
    let sudahDibayar = 0; // Piutang Masuk
    let sisaPiutang = 0;   // Sisa Piutang

    if (activeReportTab === 'semua') {
      monthTransactions.forEach(t => {
        if (t.is_bonus) return;
        
        if (t.status === 'Lunas') {
          omzetLunas += t.omzet;
          sudahDibayar += (t.omzet + t.ongkir);
          t.lines.forEach(l => {
            const modal = l.harga_modal_snapshot ?? 0;
            labaHL += (l.harga_final - modal) * l.qty;
          });
        } else if (t.status === 'Open') {
          sisaPiutang += (t.omzet + t.ongkir);
        }
      });
    } else if (activeReportTab === 'LM' || activeReportTab === 'BR') {
      const type = activeReportTab;

      monthTransactions.forEach(t => {
        if (t.is_bonus) return;

        let txOmzetTipe = 0;
        let txLabaTipe = 0;

        t.lines.forEach(l => {
          if (l.tipe === type) {
            const lineOmzet = l.harga_final * l.qty;
            txOmzetTipe += lineOmzet;

            const modal = l.harga_modal_snapshot ?? 0;
            txLabaTipe += (l.harga_final - modal) * l.qty;
          }
        });

        if (t.status === 'Lunas') {
          omzetLunas += txOmzetTipe;
          labaHL += txLabaTipe;
          sudahDibayar += txOmzetTipe;
        } else if (t.status === 'Open') {
          sisaPiutang += txOmzetTipe;
        }
      });
    } else {
      let totalKlaim = 0;
      let totalUnit = 0;
      let totalSubsidi = 0;

      bonusTransactions.forEach(t => {
        totalKlaim += (t.bonus_count ?? 1);
        t.lines.forEach(l => {
          totalUnit += l.qty;
          totalSubsidi += (l.harga_base * l.qty);
        });
      });

      return {
        omzetLunas: 0,
        labaHL: 0,
        sudahDibayar: totalKlaim,
        sisaPiutang: totalUnit,
        totalSubsidi
      };
    }

    return {
      omzetLunas,
      labaHL,
      sudahDibayar,
      sisaPiutang,
      totalSubsidi: 0
    };
  }, [monthTransactions, bonusTransactions, activeReportTab]);

  // --- TABEL RINCIAN PERFORMA PELANGGAN ---
  
  const customerPerformance = useMemo(() => {
    const activeAndTransacting = customers.filter(c => {
      const hasTx = monthTransactions.some(t => t.customer_id === c.id);
      return c.deleted_at === null || hasTx;
    });

    const list = activeAndTransacting.map(c => {
      const cTxs = monthTransactions.filter(t => t.customer_id === c.id);
      
      let totalTransaksi = 0;
      let omzet = 0;
      let statusTerakhir: 'LUNAS' | 'PIUTANG' | 'BATAL' | '—' = '—';

      if (activeReportTab === 'bonus') {
        const cBonusTxs = cTxs.filter(t => t.is_bonus);
        totalTransaksi = cBonusTxs.length;
        cBonusTxs.forEach(t => {
          t.lines.forEach(l => {
            omzet += l.qty;
          });
        });
        if (cBonusTxs.length > 0) {
          statusTerakhir = 'LUNAS';
        }
      } else {
        const cRegularTxs = cTxs.filter(t => !t.is_bonus);
        totalTransaksi = cRegularTxs.length;

        if (cRegularTxs.length > 0) {
          const sorted = [...cRegularTxs].sort((a, b) => b.tanggal.localeCompare(a.tanggal));
          const latest = sorted[0];
          statusTerakhir = latest.status === 'Lunas' ? 'LUNAS' : latest.status === 'Open' ? 'PIUTANG' : 'BATAL';
        }

        cRegularTxs.forEach(t => {
          if (t.status !== 'Lunas') return;
          
          if (activeReportTab === 'semua') {
            omzet += t.omzet;
          } else {
            t.lines.forEach(l => {
              if (l.tipe === activeReportTab) {
                omzet += (l.harga_final * l.qty);
              }
            });
          }
        });
      }

      return {
        customer: c,
        totalTransaksi,
        omzet,
        statusTerakhir
      };
    });

    return list.filter(row => {
      const matchesSearch = row.customer.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            row.customer.kode.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (searchQuery) return matchesSearch;
      return row.totalTransaksi > 0;
    });
  }, [customers, monthTransactions, activeReportTab, searchQuery]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(customerPerformance.length / itemsPerPage));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return customerPerformance.slice(start, start + itemsPerPage);
  }, [customerPerformance, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };

  // --- DETAIL TRANSAKSI PELANGGAN TERPILIH (MODAL) ---
  
  const customerDetailTransactions = useMemo(() => {
    if (!detailCustomer) return [];
    return monthTransactions.filter(t => t.customer_id === detailCustomer.id);
  }, [detailCustomer, monthTransactions]);

  // --- REAL PDF EXPORT (jsPDF) per PRD AC-7.8 - proper layout ---
  
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    const reportTitle = activeReportTab === 'bonus' 
      ? 'LAPORAN DATA KLAIM BONUS PELANGGAN' 
      : `LAPORAN KEUANGAN HL FINANCE - ${activeReportTab === 'semua' ? 'KESELURUHAN' : activeReportTab.toUpperCase()}`;
    const periodStr = periodLabel;

    // Header
    doc.setFillColor(0, 43, 143);
    doc.rect(15, y - 5, pageWidth - 30, 16, 'F');
    doc.setTextColor(255);
    doc.setFontSize(12);
    doc.text('HL FINANCE', 20, y + 2);
    doc.setFontSize(8);
    doc.text('Rekapitulasi & Pelaporan Keuangan Bulanan', 20, y + 8);
    doc.setTextColor(0);
    doc.text(`Periode: ${periodStr.toUpperCase()}`, pageWidth - 20, y, { align: 'right' });
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, pageWidth - 20, y + 5, { align: 'right' });
    y += 18;

    doc.setFontSize(10);
    doc.text(reportTitle, 20, y);
    y += 5;

    // KPI summary box
    doc.setFillColor(248, 250, 252);
    doc.rect(15, y - 3, pageWidth - 30, 10, 'F');
    doc.setFontSize(8);
    if (activeReportTab === 'bonus') {
      doc.text(`Klaim: ${metrics.sudahDibayar} | Unit: ${metrics.sisaPiutang} | Nilai: ${formatRp(metrics.totalSubsidi)} | Status: LUNAS`, 20, y + 3);
    } else {
      doc.text(`Omzet: ${formatRp(metrics.omzetLunas)} | Laba: ${formatRp(metrics.labaHL)} | Terbayar: ${formatRp(metrics.sudahDibayar)} | Piutang: ${formatRp(metrics.sisaPiutang)}`, 20, y + 3);
    }
    y += 12;

    // Table
    doc.setFontSize(7);
    doc.setFillColor(240, 244, 249);
    doc.rect(15, y - 4, pageWidth - 30, 6, 'F');
    doc.text('NO', 17, y);
    doc.text('PELANGGAN (KODE)', 30, y);
    doc.text('TRX', 95, y);
    const valHeader = activeReportTab === 'bonus' ? 'UNIT BONUS' : 'OMZET LUNAS';
    doc.text(valHeader, 115, y);
    doc.text('STATUS', 165, y);
    y += 5;
    doc.setDrawColor(200);
    doc.line(15, y, pageWidth - 15, y);
    y += 4;

    customerPerformance.slice(0, 28).forEach((row, idx) => {
      const val = activeReportTab === 'bonus' ? `${row.omzet} Unit` : formatRp(row.omzet);
      doc.text(String(idx + 1), 17, y);
      doc.text(`${row.customer.nama} (${row.customer.kode})`.substring(0, 32), 30, y);
      doc.text(`${row.totalTransaksi}x`, 95, y);
      doc.text(val, 115, y);
      doc.text(row.statusTerakhir, 165, y);
      y += 4.5;
      if (y > 265) { doc.addPage(); y = 20; }
    });

    y += 4;
    doc.line(15, y, pageWidth - 15, y);
    y += 6;
    doc.setFontSize(7);
    doc.text('Laporan resmi - Sistem HL Finance (Cash Basis, no PPN)', 20, y);

    doc.save(`Laporan-HL-${periodStr.replace(/[^A-Za-z0-9]/g, '')}-${activeReportTab}.pdf`);
  };



  if (detailCustomer) {
    return (
      <div className="space-y-8 animate-fade-in text-slate-900 select-none">
        
        {/* HEADER KEMBALI */}
        <div className="flex items-center border-b-2 border-slate-200 pb-5">
          <button
            onClick={() => setDetailCustomer(null)}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-black text-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            style={{ minHeight: '52px' }}
          >
            <span>← Kembali ke Laporan Utama</span>
          </button>
        </div>

        {/* INFO UTAMA PELANGGAN */}
        <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 md:p-8 shadow-sm">
          <p className="text-xs font-black text-[#002B8F] uppercase tracking-wider font-mono">RINCIAN DATA TRANSAKSI</p>
          <h2 className="text-3xl font-black text-slate-900 leading-tight mt-1">
            {detailCustomer.nama}
          </h2>
          <p className="text-lg font-bold text-slate-650 mt-2 leading-relaxed">
            ID Pelanggan: <span className="font-mono text-slate-900">{detailCustomer.kode}</span> | Periode: <span className="text-slate-900">{periodLabel}</span>
          </p>
        </div>

        {/* TABEL TRANSAKSI DETAIL */}
        <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
          <h3 className="text-xl font-black text-slate-900 pl-1">
            Daftar Riwayat Bon Transaksi
          </h3>

          {customerDetailTransactions.length > 0 ? (
            <div className="overflow-hidden border-2 border-slate-200 rounded-2xl shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-base">
                  <thead className="bg-[#f0f4f9] border-b-2 border-slate-200 font-black text-slate-700">
                    <tr>
                      <th className="py-5 px-5">Tanggal</th>
                      <th className="py-5 px-5">Nomor Bon</th>
                      <th className="py-5 px-5 text-center">Tipe</th>
                      <th className="py-5 px-5 text-right">Omzet LM</th>
                      <th className="py-5 px-5 text-right">Omzet BR</th>
                      <th className="py-5 px-5 text-right">Ongkir</th>
                      <th className="py-5 px-5 text-right">Total Tagihan</th>
                      <th className="py-5 px-5 text-right">Laba HL</th>
                      <th className="py-5 px-5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-extrabold text-slate-850 text-base">
                    {customerDetailTransactions.map((t) => {
                      let omzLM = 0;
                      let omzBR = 0;
                      let laba = 0;

                      t.lines.forEach(l => {
                        const lineOmzet = l.harga_final * l.qty;
                        if (l.tipe === 'LM') omzLM += lineOmzet;
                        else if (l.tipe === 'BR') omzBR += lineOmzet;

                        const modal = l.harga_modal_snapshot ?? 0;
                        laba += (l.harga_final - modal) * l.qty;
                      });

                      return (
                        <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-5 px-5 whitespace-nowrap">
                            {new Date(t.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-5 px-5 font-mono font-black text-blue-900 text-base">{t.nomor_bon}</td>
                          <td className="py-5 px-5 text-center whitespace-nowrap">
                            {t.is_bonus ? (
                              <span className="bg-amber-50 text-amber-800 text-xs font-black px-3 py-1 rounded-full border-2 border-amber-200">BONUS</span>
                            ) : (
                              <span className="bg-blue-50 text-blue-800 text-xs font-black px-3 py-1 rounded-full border-2 border-blue-200">BIASA</span>
                            )}
                          </td>
                          <td className="py-5 px-5 text-right whitespace-nowrap">{formatRp(omzLM)}</td>
                          <td className="py-5 px-5 text-right whitespace-nowrap">{formatRp(omzBR)}</td>
                          <td className="py-5 px-5 text-right whitespace-nowrap">{formatRp(t.ongkir)}</td>
                          <td className="py-5 px-5 text-right font-black text-slate-900 text-lg whitespace-nowrap">
                            {formatRp(t.omzet + t.ongkir)}
                          </td>
                          <td className="py-5 px-5 text-right font-black text-emerald-800 text-lg whitespace-nowrap">
                            {t.status === 'Lunas' ? formatRp(laba) : '—'}
                          </td>
                          <td className="py-5 px-5 text-center">
                            <span className={`inline-flex px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                              t.status === 'Lunas' 
                                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200' 
                                : t.status === 'Open'
                                  ? 'bg-amber-50 text-amber-700 border-2 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-2 border-rose-200'
                            }`}>
                              {t.status === 'Open' ? 'Piutang' : t.status === 'Lunas' ? 'Lunas' : 'Batal'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-550 font-black py-20 text-xl">
              Tidak ada transaksi tercatat untuk pelanggan ini pada periode terpilih.
            </p>
          )}

          {/* Footer Rincian */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border-t border-slate-200 pt-6 font-black text-slate-700 text-lg">
            <div>
              Total Transaksi: <span className="text-[#002B8F] font-black">{customerDetailTransactions.length} Kali</span>
            </div>
            <button
              onClick={() => setDetailCustomer(null)}
              className="px-8 py-4 bg-[#002B8F] hover:bg-[#001E66] text-white font-black text-base rounded-2xl transition-all shadow-md cursor-pointer active:scale-95 hover:scale-[1.02]"
              style={{ minHeight: '52px' }}
            >
              Kembali ke Laporan Utama
            </button>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in text-slate-900 select-none">
      
      {/* HEADER UTAMA */}
      <div className="border-b-2 border-slate-200 pb-6">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">HL Laporan</h1>
        <p className="text-slate-600 text-lg font-bold mt-1.5 leading-relaxed">
          Analisis detail performa penjualan, laba, piutang, dan pencairan bonus pelanggan.
        </p>
      </div>

      {/* CARD FILTER & PERIODE LAPORAN */}
      <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 md:p-8 shadow-sm space-y-5">
        <h3 className="text-xl font-black text-slate-900 pl-1">
          Pilih Filter & Periode Laporan
        </h3>
        
        <div className="flex flex-col md:flex-row items-end gap-5">
          {/* Dropdown Tahun */}
          <div className="w-full md:w-40 space-y-2.5 shrink-0">
            <label className="block text-sm font-black text-slate-500 uppercase tracking-wider pl-1">Tahun</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                const val = e.target.value;
                handleYearChange(val === 'semua' ? 'semua' : Number(val));
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 px-5 py-3 rounded-2xl outline-none font-black text-slate-900 text-xl cursor-pointer focus:border-[#002B8F] transition-all shadow-2xs"
              style={{ minHeight: '56px' }}
            >
              <option value="semua">Semua Tahun</option>
              {yearsList.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Dropdown Bulan */}
          <div className="w-full md:w-52 space-y-2.5 shrink-0">
            <label className="block text-sm font-black text-slate-500 uppercase tracking-wider pl-1">Bulan</label>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMonth(val === 'semua' ? 'semua' : Number(val));
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 px-5 py-3 rounded-2xl outline-none font-black text-slate-900 text-xl cursor-pointer focus:border-[#002B8F] transition-all shadow-2xs"
              style={{ minHeight: '56px' }}
            >
              <option value="semua">Semua Bulan</option>
              {monthsList.map(m => {
                const isFutureMonth = selectedYear === currentYear && m.value > currentMonthNum;
                if (isFutureMonth) return null;
                return (
                  <option key={m.value} value={m.value}>{m.label}</option>
                );
              })}
            </select>
          </div>

          {/* Cari Pelanggan */}
          <div className="w-full md:flex-1 space-y-2.5">
            <label className="block text-sm font-black text-slate-500 uppercase tracking-wider pl-1">Cari Pelanggan</label>
            <input
              type="text"
              placeholder="Cari nama atau kode pelanggan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-5 py-3 bg-slate-50 hover:bg-slate-100 border-2 border-slate-300 rounded-2xl text-xl font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#002B8F] focus:bg-white transition-all shadow-2xs"
              style={{ minHeight: '56px' }}
            />
          </div>

          {/* Tombol Tampilkan */}
          <button
            onClick={() => setCurrentPage(1)}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-[#006B44] hover:bg-[#005234] text-white font-black text-lg rounded-2xl shadow-md transition-all shrink-0 cursor-pointer w-full md:w-auto hover:scale-[1.02] active:scale-[0.98]"
            style={{ minHeight: '56px' }}
          >
            <span>Tampilkan</span>
          </button>
        </div>
      </div>

      {/* SUB-TABS FILTER TIPE PRODUK */}
      <div className="space-y-3">
        <label className="block text-sm font-black text-slate-500 uppercase tracking-wider pl-1">
          Kategori Tipe Laporan
        </label>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          {(['semua', 'LM', 'BR', 'bonus'] as const).map((tab) => {
            const labels = { semua: 'Keseluruhan', LM: 'LM', BR: 'BR', bonus: 'Log Bonus' };
            const isActive = activeReportTab === tab;
            
            return (
              <button
                key={tab}
                onClick={() => { setActiveReportTab(tab); setCurrentPage(1); }}
                className={`flex items-center justify-center px-6 py-4.5 rounded-2xl font-black text-lg transition-all cursor-pointer border-2 hover:scale-[1.02] active:scale-[0.98] ${
                  isActive
                    ? 'bg-[#002B8F] border-[#002B8F] text-white shadow-md'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs'
                }`}
                style={{ minHeight: '56px' }}
              >
                <span>{labels[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* METRIK KEUANGAN */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {activeReportTab === 'bonus' ? (
          <>
            {/* Total Klaim */}
            <div className="bg-amber-50/60 border-2 border-amber-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-amber-500 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-amber-200 text-amber-955 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Klaim Bonus
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-amber-900/70 uppercase tracking-wide">
                  Total Klaim
                </p>
                <p className="text-3xl font-black text-amber-950 tracking-tight mt-0.5">
                  {metrics.sudahDibayar} Kali
                </p>
              </div>
            </div>

            {/* Total Unit Barang Bonus */}
            <div className="bg-blue-50/60 border-2 border-blue-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-blue-500 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-blue-200 text-blue-955 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Barang Keluar
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-[#002B8F]/70 uppercase tracking-wide">
                  Total Unit Barang
                </p>
                <p className="text-3xl font-black text-blue-955 tracking-tight mt-0.5">
                  {metrics.sisaPiutang} Unit
                </p>
              </div>
            </div>

            {/* Nominal Subsidi Bonus */}
            <div className="bg-emerald-50/60 border-2 border-emerald-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-emerald-500 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-emerald-200 text-emerald-955 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Estimasi Nilai
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-emerald-800/70 uppercase tracking-wide">
                  Total Subsidi Harga Base
                </p>
                <p className="text-[26px] font-black text-emerald-900 tracking-tight mt-0.5">
                  {formatRp(metrics.totalSubsidi)}
                </p>
              </div>
            </div>

            {/* Status Kelayakan */}
            <div className="bg-emerald-50/60 border-2 border-emerald-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 border-l-[8px] border-l-emerald-600">
              <div className="flex items-start justify-between">
                <span className="bg-emerald-200 text-emerald-955 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Sistem
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-emerald-800/70 uppercase tracking-wide">
                  Status Kelayakan
                </p>
                <p className="text-[21px] font-black text-emerald-900 tracking-tight mt-1">
                  100% Lunas Otomatis
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Omzet Lunas */}
            <div className="bg-blue-50/60 border-2 border-blue-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-[#002B8F] transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-blue-200 text-blue-955 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Omzet
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-[#002B8F]/70 uppercase tracking-wide">
                  Omzet Lunas {activeReportTab !== 'semua' && `(${activeReportTab})`}
                </p>
                <p className="text-[26px] font-black text-[#002B8F] tracking-tight mt-0.5">
                  {formatRp(metrics.omzetLunas)}
                </p>
              </div>
            </div>

            {/* Total Laba HL */}
            <div className="bg-emerald-50/60 border-2 border-emerald-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-emerald-600 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-emerald-200 text-emerald-955 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Laba
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-emerald-800/70 uppercase tracking-wide">
                  Total Laba HL {activeReportTab !== 'semua' && `(${activeReportTab})`}
                </p>
                <p className="text-[26px] font-black text-emerald-800 tracking-tight mt-0.5">
                  {formatRp(metrics.labaHL)}
                </p>
              </div>
            </div>

            {/* Piutang Masuk (Total Terbayar) */}
            <div className="bg-indigo-50/60 border-2 border-indigo-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-indigo-600 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-indigo-200 text-indigo-955 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider font-sans">
                  Terbayar
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-indigo-800/70 uppercase tracking-wide">
                  Piutang Masuk {activeReportTab !== 'semua' && `(${activeReportTab})`}
                </p>
                <p className="text-[26px] font-black text-indigo-955 tracking-tight mt-0.5">
                  {formatRp(metrics.sudahDibayar)}
                </p>
              </div>
            </div>

            {/* Sisa Piutang */}
            <div className="bg-amber-50/65 border-2 border-amber-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-amber-600 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-amber-200 text-amber-850 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Belum Lunas
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-amber-850/70 uppercase tracking-wide">
                  Sisa Piutang {activeReportTab !== 'semua' && `(${activeReportTab})`}
                </p>
                <p className="text-[26px] font-black text-amber-900 tracking-tight mt-0.5">
                  {formatRp(metrics.sisaPiutang)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* RINCIAN PERFORMA PELANGGAN CARD */}
      <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 md:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border-b-2 border-slate-100 pb-5 mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeReportTab === 'bonus' 
                ? `Rincian Klaim Bonus Pelanggan (${periodLabel})`
                : `Rincian Performa Pelanggan (${periodLabel})`
              }
            </h2>
            <p className="text-base font-semibold text-slate-500 mt-1">
              {activeReportTab === 'bonus'
                ? 'Daftar pelanggan yang mencairkan bonus gratis beserta total unit produk bonus.'
                : `Omzet penjualan ${activeReportTab === 'semua' ? 'LM & BR' : activeReportTab} yang berstatus lunas.`
              }
            </p>
          </div>

          {/* Tombol Unduh PDF */}
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-[#1A202C] hover:bg-[#2D3748] text-white font-black text-base rounded-2xl shadow-md transition-all cursor-pointer hover:scale-[1.02]"
            style={{ minHeight: '52px' }}
          >
            <span>Unduh PDF Laporan</span>
          </button>
        </div>

        {/* Tabel Data Performa */}
        <div className="overflow-hidden border-2 border-slate-200 rounded-2xl shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#f0f4f9] border-b-2 border-slate-200 text-base font-black text-slate-700">
                <tr>
                  <th className="py-5 px-6 uppercase tracking-wider">Nama Pelanggan</th>
                  <th className="py-5 px-6 uppercase tracking-wider text-center" style={{ width: '220px' }}>Jumlah Transaksi</th>
                  <th className="py-5 px-6 uppercase tracking-wider" style={{ width: '250px' }}>
                    {activeReportTab === 'bonus' ? 'Unit Bonus' : 'Omzet (IDR)'}
                  </th>
                  <th className="py-5 px-6 uppercase tracking-wider text-center" style={{ width: '200px' }}>Status Terakhir</th>
                  <th className="py-5 px-6 uppercase tracking-wider text-center" style={{ width: '150px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-lg">
                {paginatedCustomers.length > 0 ? (
                  paginatedCustomers.map((row) => {
                    return (
                      <tr key={row.customer.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-6 px-6">
                          <div>
                            <div className="font-black text-slate-900 text-xl leading-tight">
                              {row.customer.nama}
                            </div>
                            <div className="text-slate-500 font-mono text-sm font-bold mt-1.5 uppercase tracking-wider">
                              ID: {row.customer.kode}
                            </div>
                          </div>
                        </td>
                        <td className="py-6 px-6 text-center font-black text-slate-800 text-xl">
                          {row.totalTransaksi} Kali
                        </td>
                        <td className="py-6 px-6 font-black text-slate-900 text-2xl">
                          {activeReportTab === 'bonus' ? `${row.omzet} Unit` : formatRp(row.omzet)}
                        </td>
                        <td className="py-6 px-6 text-center">
                          <div className="flex justify-center">
                            {row.statusTerakhir === 'LUNAS' ? (
                              <span className="inline-flex items-center px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-2xl text-base font-black border-2 border-emerald-200 uppercase tracking-wider shadow-2xs">
                                Lunas
                              </span>
                            ) : row.statusTerakhir === 'PIUTANG' ? (
                              <span className="inline-flex items-center px-5 py-2.5 bg-amber-50 text-amber-700 rounded-2xl text-base font-black border-2 border-amber-200 uppercase tracking-wider shadow-2xs">
                                Piutang
                              </span>
                            ) : row.statusTerakhir === 'BATAL' ? (
                              <span className="inline-flex items-center px-5 py-2.5 bg-rose-50 text-rose-700 rounded-2xl text-base font-black border-2 border-rose-200 uppercase tracking-wider shadow-2xs">
                                Batal
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-6 px-6">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setDetailCustomer(row.customer)}
                              className="px-8 py-3 bg-white border-2 border-slate-350 hover:bg-slate-50 text-slate-800 font-black text-base rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                              style={{ minHeight: '46px' }}
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-500 font-black text-xl">
                      Tidak ada data performa pelanggan untuk kriteria filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {customerPerformance.length > 0 && (
          <div className="flex items-center justify-between gap-4 mt-8 flex-wrap pl-1 pr-1">
            <span className="text-base font-black text-slate-500">
              Menampilkan {Math.min(customerPerformance.length, (currentPage - 1) * itemsPerPage + 1)}–{Math.min(customerPerformance.length, currentPage * itemsPerPage)} dari {customerPerformance.length} Pelanggan
            </span>
            <div className="flex items-center gap-3">
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="w-12 h-12 border-2 border-slate-300 bg-white rounded-xl font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center cursor-pointer transition-all disabled:cursor-not-allowed"
                style={{ minHeight: '48px' }}
              >
                <span>&lt;</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-12 h-12 font-black rounded-xl flex items-center justify-center cursor-pointer transition-all text-base ${
                    page === currentPage 
                      ? 'bg-[#002B8F] text-white shadow-md' 
                      : 'border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  style={{ minHeight: '48px' }}
                >
                  {page}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="w-12 h-12 border-2 border-slate-300 bg-white rounded-xl font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 flex items-center justify-center cursor-pointer transition-all disabled:cursor-not-allowed"
                style={{ minHeight: '48px' }}
              >
                <span>&gt;</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
