import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import type { Bon, Customer } from '../store/useStore';

const formatRp = (n: number) => 'Rp ' + (Number.isFinite(n) ? n : 0).toLocaleString('id-ID');

type ReportTab = 'semua' | 'LM' | 'BR' | 'bonus';
type TipeFilter = 'semua' | 'LM' | 'BR';

interface TxFinancials {
  omzetLunas: number;
  labaHL: number;
  terbayar: number;
  piutang: number;
}

function calcLineTotals(
  lines: Bon['lines'] | undefined,
  tipe: TipeFilter
): { omzet: number; laba: number } {
  let omzet = 0;
  let laba = 0;
  for (const l of lines ?? []) {
    const lineTipe = l.tipe ?? l.tipe_snapshot;
    if (tipe !== 'semua' && lineTipe !== tipe) continue;
    const lineOmzet = l.harga_final * l.qty;
    omzet += lineOmzet;
    laba += (l.harga_final - (l.harga_modal_snapshot ?? 0)) * l.qty;
  }
  return { omzet, laba };
}

function calcTxFinancials(t: Bon, tipe: TipeFilter): TxFinancials {
  if (t.is_bonus || t.status === 'Cancelled') {
    return { omzetLunas: 0, labaHL: 0, terbayar: 0, piutang: 0 };
  }

  const { omzet, laba } = calcLineTotals(t.lines, tipe);

  if (t.status === 'Lunas') {
    const terbayar = tipe === 'semua' ? t.omzet + t.ongkir : omzet;
    return { omzetLunas: omzet, labaHL: laba, terbayar, piutang: 0 };
  }

  if (t.status === 'Open') {
    const piutang = tipe === 'semua' ? t.omzet + t.ongkir : omzet;
    return { omzetLunas: 0, labaHL: 0, terbayar: 0, piutang };
  }

  return { omzetLunas: 0, labaHL: 0, terbayar: 0, piutang: 0 };
}

function aggregateFinancials(transactions: Bon[], tipe: TipeFilter): TxFinancials {
  return transactions.reduce<TxFinancials>(
    (acc, t) => {
      if (t.is_bonus) return acc;
      const f = calcTxFinancials(t, tipe);
      return {
        omzetLunas: acc.omzetLunas + f.omzetLunas,
        labaHL: acc.labaHL + f.labaHL,
        terbayar: acc.terbayar + f.terbayar,
        piutang: acc.piutang + f.piutang,
      };
    },
    { omzetLunas: 0, labaHL: 0, terbayar: 0, piutang: 0 }
  );
}

export default function LaporanPage() {
  const { transactions: rawTransactions, customers: rawCustomers } = useStore();
  const transactions = rawTransactions ?? [];
  const customers = rawCustomers ?? [];

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState<number | 'semua'>(currentMonthNum);
  const [selectedYear, setSelectedYear] = useState<number | 'semua'>(currentYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('semua');
  
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

  const yearsList = Array.from(
    { length: Math.max(1, currentYear - 2024 + 1) },
    (_, i) => 2024 + i
  );

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
      if (!t?.tanggal) return false;
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

  const metrics = useMemo(() => {
    if (activeReportTab === 'bonus') {
      let totalKlaim = 0;
      let totalUnit = 0;
      let totalSubsidi = 0;
      const pelangganKlaim = new Set<string>();

      bonusTransactions.forEach(t => {
        totalKlaim += t.bonus_count ?? 1;
        pelangganKlaim.add(t.customer_id);
        (t.lines ?? []).forEach(l => {
          totalUnit += l.qty ?? 0;
          totalSubsidi += (l.harga_base ?? 0) * (l.qty ?? 0);
        });
      });

      return {
        omzetLunas: 0,
        labaHL: 0,
        terbayar: totalKlaim,
        piutang: totalUnit,
        totalSubsidi,
        pelangganKlaim: pelangganKlaim.size,
      };
    }

    const tipe: TipeFilter = activeReportTab;
    const agg = aggregateFinancials(monthTransactions, tipe);
    return { ...agg, totalSubsidi: 0, pelangganKlaim: 0 };
  }, [monthTransactions, bonusTransactions, activeReportTab]);

  const typeBreakdown = useMemo(() => {
    if (activeReportTab !== 'semua') return null;
    return {
      LM: aggregateFinancials(monthTransactions, 'LM'),
      BR: aggregateFinancials(monthTransactions, 'BR'),
    };
  }, [monthTransactions, activeReportTab]);

  // --- TABEL RINCIAN PERFORMA PELANGGAN ---
  
  const customerPerformance = useMemo(() => {
    const activeAndTransacting = customers.filter(c => {
      const hasTx = monthTransactions.some(t => t.customer_id === c.id);
      return c.deleted_at === null || hasTx;
    });

    const list = activeAndTransacting.flatMap(c => {
      if (!c?.id) return [];
      const cTxs = monthTransactions.filter(t => t.customer_id === c.id);

      if (activeReportTab === 'bonus') {
        const cBonusTxs = cTxs.filter(t => t.is_bonus);
        let unitBonus = 0;
        let subsidi = 0;
        cBonusTxs.forEach(t => {
          (t.lines ?? []).forEach(l => {
            unitBonus += l.qty ?? 0;
            subsidi += (l.harga_base ?? 0) * (l.qty ?? 0);
          });
        });
        return [{
          customer: c,
          totalTransaksi: cBonusTxs.length,
          omzetLunas: 0,
          labaHL: 0,
          piutang: 0,
          terbayar: 0,
          unitBonus,
          subsidi,
        }];
      }

      const cRegularTxs = cTxs.filter(t => !t.is_bonus && t.status !== 'Cancelled');
      const tipe: TipeFilter = activeReportTab;
      const totals = cRegularTxs.reduce(
        (acc, t) => {
          const f = calcTxFinancials(t, tipe);
          return {
            omzetLunas: acc.omzetLunas + f.omzetLunas,
            labaHL: acc.labaHL + f.labaHL,
            piutang: acc.piutang + f.piutang,
            terbayar: acc.terbayar + f.terbayar,
          };
        },
        { omzetLunas: 0, labaHL: 0, piutang: 0, terbayar: 0 }
      );

      return [{
        customer: c,
        totalTransaksi: cRegularTxs.length,
        ...totals,
        unitBonus: 0,
        subsidi: 0,
      }];
    });

    const filtered = list.filter(row => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (row.customer?.nama ?? '').toLowerCase().includes(q) ||
        (row.customer?.kode ?? '').toLowerCase().includes(q);
      if (searchQuery) return matchesSearch;
      return row.totalTransaksi > 0;
    });

    if (activeReportTab === 'bonus') {
      return filtered.sort((a, b) => b.unitBonus - a.unitBonus);
    }
    return filtered.sort((a, b) => b.labaHL - a.labaHL || b.omzetLunas - a.omzetLunas);
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
  
  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
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
      doc.text(
        `Klaim: ${metrics.terbayar} | Unit: ${metrics.piutang} | Subsidi: ${formatRp(metrics.totalSubsidi)} | Pelanggan: ${metrics.pelangganKlaim}`,
        20,
        y + 3
      );
    } else {
      doc.text(
        `Omzet Lunas: ${formatRp(metrics.omzetLunas)} | Laba HL: ${formatRp(metrics.labaHL)} | Sudah Dibayar: ${formatRp(metrics.terbayar)} | Belum bayar: ${formatRp(metrics.piutang)}`,
        20,
        y + 3
      );
    }
    y += 12;

    if (typeBreakdown) {
      doc.setFontSize(7);
      doc.text(
        `LM — Omzet: ${formatRp(typeBreakdown.LM.omzetLunas)} | Laba: ${formatRp(typeBreakdown.LM.labaHL)} | Belum bayar: ${formatRp(typeBreakdown.LM.piutang)}`,
        20,
        y
      );
      y += 4;
      doc.text(
        `BR — Omzet: ${formatRp(typeBreakdown.BR.omzetLunas)} | Laba: ${formatRp(typeBreakdown.BR.labaHL)} | Belum bayar: ${formatRp(typeBreakdown.BR.piutang)}`,
        20,
        y
      );
      y += 8;
    }

    doc.setFontSize(7);
    doc.setFillColor(240, 244, 249);
    doc.rect(15, y - 4, pageWidth - 30, 6, 'F');
    doc.text('NO', 17, y);
    doc.text('PELANGGAN', 28, y);
    doc.text('TRX', 78, y);
    if (activeReportTab === 'bonus') {
      doc.text('UNIT', 95, y);
      doc.text('SUBSIDI', 130, y);
    } else {
      doc.text('OMZET', 90, y);
      doc.text('LABA', 118, y);
      doc.text('BLM BYR', 143, y);
    }
    y += 5;
    doc.setDrawColor(200);
    doc.line(15, y, pageWidth - 15, y);
    y += 4;

    customerPerformance.slice(0, 28).forEach((row, idx) => {
      doc.text(String(idx + 1), 17, y);
      doc.text(`${row.customer.nama} (${row.customer.kode})`.substring(0, 28), 28, y);
      doc.text(`${row.totalTransaksi}x`, 78, y);
      if (activeReportTab === 'bonus') {
        doc.text(`${row.unitBonus}`, 95, y);
        doc.text(formatRp(row.subsidi), 130, y);
      } else {
        doc.text(formatRp(row.omzetLunas), 90, y);
        doc.text(formatRp(row.labaHL), 118, y);
        doc.text(formatRp(row.piutang), 145, y);
      }
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
      <div className="space-y-8 animate-fade-in text-slate-900">
        
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
          <p className="text-sm font-black text-[#002B8F] uppercase tracking-wide font-mono">RINCIAN DATA TRANSAKSI</p>
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
              <div className="md:hidden p-4 space-y-4">
                {customerDetailTransactions.map((t) => {
                  let omzLM = 0;
                  let omzBR = 0;
                  let laba = 0;
                  (t.lines ?? []).forEach(l => {
                    const lineOmzet = (l.harga_final ?? 0) * (l.qty ?? 0);
                    if (l.tipe === 'LM') omzLM += lineOmzet;
                    else if (l.tipe === 'BR') omzBR += lineOmzet;
                    const modal = l.harga_modal_snapshot ?? 0;
                    laba += (l.harga_final - modal) * l.qty;
                  });
                  return (
                    <div key={t.id} className="border-2 border-slate-200 rounded-2xl p-5 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-500">
                            {new Date(t.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="font-mono font-black text-[#002B8F] text-lg mt-1">{t.nomor_bon}</p>
                        </div>
                        <span className={`inline-flex px-3 py-2 rounded-xl text-xs font-black uppercase ${
                          t.status === 'Lunas'
                            ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200'
                            : t.status === 'Open'
                              ? 'bg-amber-50 text-amber-700 border-2 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-2 border-rose-200'
                        }`}>
                          {t.status === 'Open' ? 'Belum bayar' : t.status === 'Lunas' ? 'Lunas' : 'Batal'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-slate-500 font-bold">Omzet LM</span><p className="font-black text-slate-800">{formatRp(omzLM)}</p></div>
                        <div><span className="text-slate-500 font-bold">Omzet BR</span><p className="font-black text-slate-800">{formatRp(omzBR)}</p></div>
                        <div><span className="text-slate-500 font-bold">Ongkir</span><p className="font-black text-slate-800">{formatRp(t.ongkir)}</p></div>
                        <div><span className="text-slate-500 font-bold">Laba HL</span><p className="font-black text-emerald-800">{t.status === 'Lunas' ? formatRp(laba) : '—'}</p></div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-500">Total Tagihan</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{formatRp(t.omzet + t.ongkir)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block overflow-x-auto">
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

                      (t.lines ?? []).forEach(l => {
                        const lineOmzet = (l.harga_final ?? 0) * (l.qty ?? 0);
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
                              {t.status === 'Open' ? 'Belum bayar' : t.status === 'Lunas' ? 'Lunas' : 'Batal'}
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
    <div className="space-y-8 animate-fade-in text-slate-900">
      
      {/* HEADER UTAMA */}
      <div className="border-b-2 border-slate-200 pb-6">
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">HL Laporan</h1>
        <p className="text-slate-600 text-lg font-bold mt-1.5 leading-relaxed">
          Rekap omzet, laba, belum bayar, dan pembayaran per periode — sesuai AC-7.
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
                  {metrics.terbayar} Kali
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
                  {metrics.piutang} Unit
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

            {/* Pelanggan Klaim */}
            <div className="bg-slate-50/80 border-2 border-slate-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-slate-500 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-slate-200 text-slate-800 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Pelanggan
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-slate-600 uppercase tracking-wide">
                  Pelanggan Klaim Bonus
                </p>
                <p className="text-3xl font-black text-slate-900 tracking-tight mt-0.5">
                  {metrics.pelangganKlaim} Orang
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

            {/* Sudah Dibayar */}
            <div className="bg-indigo-50/60 border-2 border-indigo-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-indigo-600 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-indigo-200 text-indigo-955 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider font-sans">
                  Terbayar
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-indigo-800/70 uppercase tracking-wide">
                  Sudah Dibayar {activeReportTab !== 'semua' && `(${activeReportTab})`}
                </p>
                <p className="text-[26px] font-black text-indigo-955 tracking-tight mt-0.5">
                  {formatRp(metrics.terbayar)}
                </p>
              </div>
            </div>

            {/* Belum bayar */}
            <div className="bg-amber-50/65 border-2 border-amber-300 rounded-3xl p-6 shadow-xs flex flex-col justify-between h-44 hover:border-amber-600 transition-colors">
              <div className="flex items-start justify-between">
                <span className="bg-amber-200 text-amber-850 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
                  Belum bayar
                </span>
              </div>
              <div className="mt-3">
                <p className="text-sm font-black text-amber-850/70 uppercase tracking-wide">
                  Belum bayar{activeReportTab !== 'semua' && ` (${activeReportTab})`}
                </p>
                <p className="text-[26px] font-black text-amber-900 tracking-tight mt-0.5">
                  {formatRp(metrics.piutang)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {typeBreakdown && (
        <div className="bg-white border-2 border-slate-300 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
          <h3 className="text-lg font-black text-slate-900">Pemisahan LM vs BR (Keseluruhan)</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {(['LM', 'BR'] as const).map((tipe) => {
              const d = typeBreakdown[tipe];
              return (
                <div
                  key={tipe}
                  className={`rounded-2xl border-2 p-5 ${
                    tipe === 'LM' ? 'border-blue-200 bg-blue-50/40' : 'border-violet-200 bg-violet-50/40'
                  }`}
                >
                  <p className="text-sm font-black text-slate-600 uppercase tracking-wider mb-3">
                    Tipe {tipe}
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-base font-bold text-slate-800">
                    <div>
                      <p className="text-sm text-slate-600 uppercase">Omzet Lunas</p>
                      <p className="font-black text-slate-900">{formatRp(d.omzetLunas)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 uppercase">Laba HL</p>
                      <p className="font-black text-emerald-800">{formatRp(d.labaHL)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 uppercase">Sudah Dibayar</p>
                      <p className="font-black text-indigo-900">{formatRp(d.terbayar)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 uppercase">Belum bayar</p>
                      <p className="font-black text-amber-900">{formatRp(d.piutang)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                ? 'Daftar pelanggan yang mencairkan bonus — diurutkan berdasarkan unit bonus terbanyak.'
                : `Rekap per pelanggan — diurutkan berdasarkan laba HL ${activeReportTab === 'semua' ? '(LM & BR)' : `(${activeReportTab})`}.`
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

        {/* Data performa: kartu di mobile, tabel di desktop */}
        <div className="overflow-hidden border-2 border-slate-200 rounded-2xl shadow-2xs">
          <div className="md:hidden p-4 space-y-4">
            {paginatedCustomers.length > 0 ? paginatedCustomers.map((row) => (
              <div key={row.customer.id} className="border-2 border-slate-200 rounded-2xl p-5 space-y-4 bg-white">
                <div>
                  <p className="font-black text-slate-900 text-xl">{row.customer.nama}</p>
                  <p className="text-slate-500 font-mono text-sm font-bold mt-1 uppercase">{row.customer.kode}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="font-bold text-slate-500">Jumlah Bon</p>
                    <p className="font-black text-slate-800 text-lg mt-1">{row.totalTransaksi}</p>
                  </div>
                  {activeReportTab === 'bonus' ? (
                    <>
                      <div>
                        <p className="font-bold text-slate-500">Unit Bonus</p>
                        <p className="font-black text-slate-900 text-lg mt-1">{row.unitBonus} Unit</p>
                      </div>
                      <div className="col-span-2">
                        <p className="font-bold text-slate-500">Subsidi</p>
                        <p className="font-black text-emerald-800 text-xl mt-1">{formatRp(row.subsidi)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="font-bold text-slate-500">Omzet Lunas</p>
                        <p className="font-black text-[#002B8F] text-lg mt-1">{formatRp(row.omzetLunas)}</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-500">Laba HL</p>
                        <p className="font-black text-emerald-800 text-lg mt-1">{formatRp(row.labaHL)}</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-500">Belum bayar</p>
                        <p className="font-black text-amber-800 text-lg mt-1">{row.piutang > 0 ? formatRp(row.piutang) : '—'}</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-500">Sudah Dibayar</p>
                        <p className="font-black text-indigo-900 text-lg mt-1">{formatRp(row.terbayar)}</p>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setDetailCustomer(row.customer)}
                  className="w-full py-4 bg-white border-2 border-[#002B8F] text-[#002B8F] hover:bg-blue-50 font-black text-base rounded-2xl min-h-[48px]"
                >
                  Lihat Detail
                </button>
              </div>
            )) : (
              <p className="py-16 text-center text-slate-500 font-black text-lg">
                Tidak ada data performa pelanggan untuk kriteria filter ini.
              </p>
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#f0f4f9] border-b-2 border-slate-200 text-sm font-black text-slate-700">
                <tr>
                  <th className="py-4 px-4 uppercase tracking-wider">Pelanggan</th>
                  <th className="py-4 px-3 uppercase tracking-wider text-center">Bon</th>
                  {activeReportTab === 'bonus' ? (
                    <>
                      <th className="py-4 px-3 uppercase tracking-wider text-right">Unit Bonus</th>
                      <th className="py-4 px-3 uppercase tracking-wider text-right">Subsidi</th>
                    </>
                  ) : (
                    <>
                      <th className="py-4 px-3 uppercase tracking-wider text-right">Omzet Lunas</th>
                      <th className="py-4 px-3 uppercase tracking-wider text-right">Laba HL</th>
                      <th className="py-4 px-3 text-right font-black">Belum bayar</th>
                      <th className="py-4 px-3 uppercase tracking-wider text-right">Sudah Dibayar</th>
                    </>
                  )}
                  <th className="py-4 px-3 uppercase tracking-wider text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-base">
                {paginatedCustomers.length > 0 ? (
                  paginatedCustomers.map((row) => (
                    <tr key={row.customer.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4">
                        <div className="font-black text-slate-900 text-lg leading-tight">
                          {row.customer.nama}
                        </div>
                        <div className="text-slate-500 font-mono text-xs font-bold mt-1 uppercase tracking-wider">
                          {row.customer.kode}
                        </div>
                      </td>
                      <td className="py-4 px-3 text-center font-black text-slate-800">
                        {row.totalTransaksi}
                      </td>
                      {activeReportTab === 'bonus' ? (
                        <>
                          <td className="py-4 px-3 text-right font-black text-slate-900">
                            {row.unitBonus} Unit
                          </td>
                          <td className="py-4 px-3 text-right font-black text-emerald-800">
                            {formatRp(row.subsidi)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-4 px-3 text-right font-black text-[#002B8F]">
                            {formatRp(row.omzetLunas)}
                          </td>
                          <td className="py-4 px-3 text-right font-black text-emerald-800">
                            {formatRp(row.labaHL)}
                          </td>
                          <td className="py-4 px-3 text-right font-black text-amber-800">
                            {row.piutang > 0 ? formatRp(row.piutang) : '—'}
                          </td>
                          <td className="py-4 px-3 text-right font-black text-indigo-900">
                            {formatRp(row.terbayar)}
                          </td>
                        </>
                      )}
                      <td className="py-4 px-3 text-center">
                        <button
                          onClick={() => setDetailCustomer(row.customer)}
                          className="px-6 py-3 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-800 font-black text-base rounded-xl transition-all cursor-pointer min-h-[48px] min-w-[100px]"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={activeReportTab === 'bonus' ? 5 : 7} className="py-20 text-center text-slate-500 font-black text-xl">
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
              {(() => {
                const pages: number[] = [];
                const maxButtons = 7;
                let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
                const end = Math.min(totalPages, start + maxButtons - 1);
                start = Math.max(1, end - maxButtons + 1);
                for (let p = start; p <= end; p++) pages.push(p);
                return pages.map(page => (
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
                ));
              })()}
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
