import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  UserPlus, 
  FileDown, 
  Award,
  CheckSquare,
  Phone,
  MapPin,
  Pencil,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Check
} from 'lucide-react';
import jsPDF from 'jspdf';

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

// Tipe data untuk Customer sesuai PRD
interface Customer {
  id: string;
  kode: string;
  nama: string;
  diskon_lm: number[];
  diskon_br: number[];
  threshold_bonus: number;
  accumulated_omzet: number;
  bonus_claimed: number;
  telepon?: string;
  alamat?: string;
}

// Tipe data untuk Invoice/Bon Pelanggan
/*
interface Bon {
  id: string;
  nomor_bon: string;
  tanggal: string;
  ongkir: number;
  omzet: number;
  status: 'Open' | 'Lunas' | 'Cancelled';
  tanggal_lunas?: string;
  deskripsi?: string;
  lines: {
    productName: string;
    tipe: 'LM' | 'BR';
    qty: number;
    harga_base: number;
    diskon: number[];
    harga_final: number;
  }[];
}
*/

const renderStatusBadge = (status: 'Open' | 'Lunas' | 'Cancelled' | string) => {
  switch (status) {
    case 'Lunas':
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={16} className="text-emerald-600 stroke-[2.5]" />
          <span>Sudah Lunas</span>
        </span>
      );
    case 'Cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle size={16} className="text-rose-600 stroke-[2.5]" />
          <span>Batal</span>
        </span>
      );
    default: // 'Open'
      return (
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <Clock size={16} className="text-amber-600 stroke-[2.5]" />
          <span>Belum Lunas</span>
        </span>
      );
  }
};

import { useStore } from '../store/useStore';

export default function PelangganPage() {
  const { 
    customers, 
    transactions, 
    addCustomer, 
    updateCustomer, 
    settleTransaction, 
    settleBulkTransactions,
    showAddCustomer,
    setShowAddCustomer
  } = useStore();
  
  const bons = transactions;

  // 1. STATE MANAGEMENT UTAMA
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State Pelunasan Modal
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleMode, setSettleMode] = useState<'single' | 'bulk'>('single');
  const [targetBonId, setTargetBonId] = useState<string | null>(null);
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  
  // State Detail Bon Modal
  const [activeBonDetail, setActiveBonDetail] = useState<any | null>(null);

  // State Edit Pelanggan Halaman
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerForm, setEditCustomerForm] = useState<any | null>(null);
  const [newLmDiscount, setNewLmDiscount] = useState<string>('');
  const [newBrDiscount, setNewBrDiscount] = useState<string>('');

  // State Tambah Pelanggan Halaman
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [addCustomerForm, setAddCustomerForm] = useState<any | null>(null);
  const [newLmDiscountAdd, setNewLmDiscountAdd] = useState<string>('');
  const [newBrDiscountAdd, setNewBrDiscountAdd] = useState<string>('');

  const startAddCustomerForm = () => {
    setAddCustomerForm({
      id: '',
      kode: '',
      nama: '',
      diskon_lm: [],
      diskon_br: [],
      threshold_bonus: 10000000,
      accumulated_omzet: 0,
      bonus_claimed: 0,
      telepon: '',
      alamat: '',
    });
    setNewLmDiscountAdd('');
    setNewBrDiscountAdd('');
    setIsAddingCustomer(true);
  };

  // Sync direct open add from dashboard
  useEffect(() => {
    if (showAddCustomer) {
      startAddCustomerForm();
      setShowAddCustomer(false);
    }
  }, [showAddCustomer, setShowAddCustomer]);

  // State Filter Bulan & Tahun (Maksimal s/d Bulan & Tahun Saat Ini)
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

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

  const yearsList = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    if (year === currentYear && selectedMonth > currentMonthNum) {
      setSelectedMonth(currentMonthNum);
    }
  };

  // 4. LOGIKA FILTER & AKSESIBILITAS CUSTOMERS
  const filteredCustomers = customers.filter(c => 
    c.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.kode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCustomer = customers.find(c => c.id === selectedCustomerId);

  // Hitung kelayakan bonus untuk disorot warna oranye (Kebutuhan Bisnis PRD)
  const isEligibleForBonus = (c: Customer) => {
    const available = Math.floor(c.accumulated_omzet / c.threshold_bonus) - c.bonus_claimed;
    return available > 0;
  };

  // 5. PAGINASI DETAIL TRANSAKSI CUSTOMER (Wajib 20 item/halaman sesuai PRD §4.6)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filter bon milik customer aktif (untuk Toko Jaya Abadi cust-1)
  // PRD AC-6.1: pilih bulan -> tampilkan daftar untuk bulan tersebut (dikelompokkan per bulan)
  const yearPrefix = selectedYear.toString();
  const monthPrefix = selectedMonth.toString().padStart(2, '0');
  const selectedYearMonth = `${yearPrefix}-${monthPrefix}`;

  const currentMonthBons = activeCustomer ? bons.filter(b => b.tanggal.startsWith(selectedYearMonth)) : [];
  const totalBonsCount = currentMonthBons.length;
  const totalPages = Math.ceil(totalBonsCount / itemsPerPage);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBons = currentMonthBons.slice(startIndex, startIndex + itemsPerPage);
  const totalPiutang = currentMonthBons.filter(b => b.status === 'Open').reduce((acc, curr) => acc + (curr.omzet + curr.ongkir), 0);
  const totalTerbayar = currentMonthBons.filter(b => b.status === 'Lunas').reduce((acc, curr) => acc + (curr.omzet + curr.ongkir), 0);
  
  const currentMonthLunasBons = currentMonthBons.filter(b => b.status === 'Lunas');
  const totalOmzetLM = currentMonthLunasBons.reduce((acc, curr) => {
    return acc + curr.lines.filter(l => l.tipe === 'LM').reduce((sub, line) => sub + (line.harga_final * line.qty), 0);
  }, 0);
  const totalOmzetBR = currentMonthLunasBons.reduce((acc, curr) => {
    return acc + curr.lines.filter(l => l.tipe === 'BR').reduce((sub, line) => sub + (line.harga_final * line.qty), 0);
  }, 0);
  const totalOmzet = totalOmzetLM + totalOmzetBR;

  // Laba pakai snapshot exact per PRD §5 (bukan estimasi). Gunakan harga_modal_snapshot (0 jika bonus).
  const totalLaba = currentMonthLunasBons.reduce((acc, curr) => {
    const itemLaba = curr.lines.reduce((subAcc, line) => {
      const modal = line.harga_modal_snapshot ?? 0;
      return subAcc + ((line.harga_final - modal) * line.qty);
    }, 0);
    return acc + itemLaba;
  }, 0);

  // 6. TINDAKAN PELUNASAN (Bulk & Single)
  const handleSettleConfirmation = async () => {
    if (settleMode === 'single' && targetBonId) {
      const err = await settleTransaction(targetBonId, settleDate);
      if (err) { alert(err); return; }
      if (activeBonDetail && activeBonDetail.id === targetBonId) {
        setActiveBonDetail((prev: any) => prev ? { ...prev, status: 'Lunas', tanggal_lunas: settleDate } : null);
      }
      alert(`Bon berhasil dilunasi pada tanggal ${settleDate}!`);
    } else if (settleMode === 'bulk' && selectedCustomerId) {
      const err = await settleBulkTransactions(selectedCustomerId, selectedYearMonth, settleDate);
      if (err) { alert(err); return; }
      alert(`Semua tagihan Open bulan ini berhasil dilunasi pada tanggal ${settleDate}!`);
    }
    setShowSettleModal(false);
  };

  // 6.2 TINDAKAN EDIT PELANGGAN
  const handleSaveEditCustomer = async () => {
    if (!editCustomerForm) return;
    if (!editCustomerForm.nama.trim()) {
      alert("Nama pelanggan tidak boleh kosong!");
      return;
    }
    if (!editCustomerForm.kode.trim()) {
      alert("Kode pelanggan tidak boleh kosong!");
      return;
    }
    const isDuplicate = customers.some(
      c => c.kode.toLowerCase() === editCustomerForm.kode.trim().toLowerCase() && c.id !== editCustomerForm.id
    );
    if (isDuplicate) {
      alert("Kode pelanggan sudah digunakan oleh pelanggan lain!");
      return;
    }

    const err = await updateCustomer(editCustomerForm);
    if (err) { alert(err); return; }
    setIsEditingCustomer(false);
  };

  // 6.3 TINDAKAN TAMBAH PELANGGAN
  const handleSaveAddCustomer = async () => {
    if (!addCustomerForm) return;
    if (!addCustomerForm.nama.trim()) {
      alert("Nama pelanggan tidak boleh kosong!");
      return;
    }
    if (!addCustomerForm.kode.trim()) {
      alert("Kode pelanggan tidak boleh kosong!");
      return;
    }
    const isDuplicate = customers.some(
      c => c.kode.toLowerCase() === addCustomerForm.kode.trim().toLowerCase()
    );
    if (isDuplicate) {
      alert("Kode pelanggan sudah digunakan oleh pelanggan lain!");
      return;
    }

    const err = await addCustomer({
      kode: addCustomerForm.kode.trim(),
      nama: addCustomerForm.nama.trim(),
      diskon_lm: addCustomerForm.diskon_lm,
      diskon_br: addCustomerForm.diskon_br,
      threshold_bonus: addCustomerForm.threshold_bonus,
      telepon: addCustomerForm.telepon,
      alamat: addCustomerForm.alamat,
      deleted_at: null,
    });
    if (err) { alert(err); return; }
    setIsAddingCustomer(false);
    alert(`Pelanggan baru "${addCustomerForm.nama.trim()}" berhasil ditambahkan!`);
  };

  // Real PDF export for customer detail (piutang/transaksi per bulan) with proper layout
  const handleExportCustomerPDF = () => {
    if (!activeCustomer) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFontSize(16);
    doc.setTextColor(0, 43, 143);
    doc.text('HL FINANCE', 20, y);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text('Laporan Transaksi Pelanggan', 20, y + 6);
    y += 12;
    doc.setDrawColor(0, 43, 143);
    doc.line(20, y, pageWidth - 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Pelanggan: ${activeCustomer.nama} (${activeCustomer.kode})`, 20, y);
    y += 6;
    doc.text(`Periode: ${selectedYear}-${String(selectedMonth).padStart(2, '0')}`, 20, y);
    y += 6;
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, pageWidth - 20, y, { align: 'right' });
    y += 10;

    // Summary
    doc.setFontSize(9);
    doc.text(`Total Piutang: ${formatRp(totalPiutang)}   |   Terbayar: ${formatRp(totalTerbayar)}   |   Omzet: ${formatRp(totalOmzet)}   |   Laba est: ${formatRp(totalLaba)}`, 20, y);
    y += 8;

    // Table header
    doc.setFontSize(8);
    doc.text('Tgl', 20, y);
    doc.text('No Bon', 45, y);
    doc.text('Omzet', 90, y);
    doc.text('Ongkir', 115, y);
    doc.text('Tagihan', 140, y);
    doc.text('Status', 170, y);
    y += 4;
    doc.line(20, y, pageWidth - 20, y);
    y += 5;

    const list = currentMonthBons.slice(0, 25); // limit
    list.forEach(b => {
      const tagihan = b.omzet + b.ongkir;
      doc.text(b.tanggal.substring(5), 20, y);
      doc.text(b.nomor_bon.substring(0, 18), 45, y);
      doc.text(formatRp(b.omzet).replace('Rp ', ''), 90, y);
      doc.text(formatRp(b.ongkir).replace('Rp ', ''), 115, y);
      doc.text(formatRp(tagihan).replace('Rp ', ''), 140, y);
      doc.text(b.status === 'Lunas' ? 'LUNAS' : b.status === 'Open' ? 'PIUTANG' : 'BATAL', 170, y);
      y += 5;
      if (y > 260) { doc.addPage(); y = 20; }
    });

    y += 5;
    doc.line(20, y, pageWidth - 20, y);
    y += 8;
    doc.setFontSize(8);
    doc.text('Dokumen resmi HL Finance - otomatis', 20, y);

    doc.save(`Laporan-Pelanggan-${activeCustomer.kode}-${selectedYear}${String(selectedMonth).padStart(2,'0')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* TAMPILAN 1: DAFTAR PELANGGAN (SCROLL MODE) */}
      {!selectedCustomerId ? (
        isAddingCustomer ? (
          /* TAMPILAN 5: HALAMAN FORM TAMBAH PELANGGAN BARU (BARU - RAMAH LANSIA) */
          <div className="space-y-6 animate-fade-in">
            {/* Header Kembali */}
            <div className="flex items-center border-b border-slate-200 pb-4">
              <button
                onClick={() => setIsAddingCustomer(false)}
                className="flex items-center space-x-3 text-slate-700 hover:text-slate-900 font-black text-xl transition-colors cursor-pointer"
                style={{ minHeight: '52px' }}
              >
                <ArrowLeft size={26} className="stroke-[3]" />
                <span>Kembali ke Daftar Pelanggan</span>
              </button>
            </div>

            {/* Form Card */}
            <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-10 shadow-md space-y-8">
              <div className="flex items-center space-x-3 text-[#002B8F] border-b-2 border-slate-100 pb-5">
                <UserPlus size={28} className="stroke-[3]" />
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                  Tambah Pelanggan Baru
                </h3>
              </div>

              {addCustomerForm && (
                <div className="space-y-8">
                  <div className="grid gap-6 sm:grid-cols-2 text-lg">
                    {/* Kode Pelanggan */}
                    <div className="space-y-2.5">
                      <label htmlFor="new-cust-code" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                        Kode Pelanggan (Wajib & Unik)
                      </label>
                      <input
                        id="new-cust-code"
                        type="text"
                        maxLength={10}
                        placeholder="Contoh: HL-C07"
                        value={addCustomerForm.kode}
                        onChange={(e) => setAddCustomerForm(prev => prev ? { ...prev, kode: e.target.value } : null)}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                        style={{ minHeight: '56px' }}
                      />
                    </div>

                    {/* Nama Pelanggan */}
                    <div className="space-y-2.5">
                      <label htmlFor="new-cust-name" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                        Nama Pelanggan (Wajib)
                      </label>
                      <input
                        id="new-cust-name"
                        type="text"
                        placeholder="Contoh: Toko Berkah"
                        value={addCustomerForm.nama}
                        onChange={(e) => setAddCustomerForm(prev => prev ? { ...prev, nama: e.target.value } : null)}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                        style={{ minHeight: '56px' }}
                      />
                    </div>

                    {/* No Telepon */}
                    <div className="space-y-2.5">
                      <label htmlFor="new-cust-phone" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                        Nomor Telepon
                      </label>
                      <input
                        id="new-cust-phone"
                        type="text"
                        placeholder="Contoh: 08123456789"
                        value={addCustomerForm.telepon || ''}
                        onChange={(e) => setAddCustomerForm(prev => prev ? { ...prev, telepon: e.target.value } : null)}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                        style={{ minHeight: '56px' }}
                      />
                    </div>

                    {/* Threshold Bonus */}
                    <div className="space-y-2.5">
                      <label htmlFor="new-cust-threshold" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                        Ambang Batas Bonus (Rp)
                      </label>
                      <input
                        id="new-cust-threshold"
                        type="number"
                        value={addCustomerForm.threshold_bonus}
                        onChange={(e) => setAddCustomerForm(prev => prev ? { ...prev, threshold_bonus: Number(e.target.value) } : null)}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                        style={{ minHeight: '56px' }}
                      />
                    </div>

                    {/* Alamat (Full Width) */}
                    <div className="space-y-2.5 sm:col-span-2">
                      <label htmlFor="new-cust-address" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                        Alamat Lengkap
                      </label>
                      <textarea
                        id="new-cust-address"
                        rows={3}
                        placeholder="Contoh: Jl. Pahlawan No. 10"
                        value={addCustomerForm.alamat || ''}
                        onChange={(e) => setAddCustomerForm(prev => prev ? { ...prev, alamat: e.target.value } : null)}
                        className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all resize-none shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Diskon Setting Section */}
                  <div className="grid gap-8 sm:grid-cols-2 pt-8 border-t-2 border-slate-100">
                    {/* Diskon LM */}
                    <div className="space-y-5">
                      <h4 className="text-xl font-black text-blue-900 border-b-2 border-blue-100 pb-2.5">
                        Diskon LM (Maksimal 5 Tingkat)
                      </h4>
                      
                      {/* List of current discounts */}
                      <div className="space-y-3">
                        {addCustomerForm.diskon_lm.map((disc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl animate-fade-in">
                            <span className="font-extrabold text-blue-950 text-lg">Tingkat {idx + 1}: {disc}%</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAddCustomerForm(prev => {
                                  if (!prev) return null;
                                  const updated = [...prev.diskon_lm];
                                  updated.splice(idx, 1);
                                  return { ...prev, diskon_lm: updated };
                                });
                              }}
                              className="px-5 py-2.5 bg-rose-55 hover:bg-rose-100 text-rose-700 text-base font-extrabold rounded-xl border-2 border-rose-200 transition-colors cursor-pointer"
                              style={{ minHeight: '44px' }}
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        {addCustomerForm.diskon_lm.length === 0 && (
                          <p className="text-base font-extrabold text-slate-400 italic">Belum ada diskon LM</p>
                        )}
                      </div>

                      {/* Add new discount input */}
                      {addCustomerForm.diskon_lm.length < 5 && (
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            placeholder="Nilai diskon (0-100)"
                            value={newLmDiscountAdd}
                            onChange={(e) => setNewLmDiscountAdd(e.target.value)}
                            className="flex-1 p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-lg font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white shadow-sm"
                            style={{ minHeight: '50px' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Number(newLmDiscountAdd);
                              if (isNaN(val) || val < 0 || val > 100 || newLmDiscountAdd.trim() === '') {
                                alert("Masukkan nilai diskon antara 0 dan 100!");
                                return;
                              }
                              setAddCustomerForm(prev => {
                                if (!prev) return null;
                                return { ...prev, diskon_lm: [...prev.diskon_lm, val] };
                              });
                              setNewLmDiscountAdd('');
                            }}
                            className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-extrabold rounded-2xl shadow-md cursor-pointer transition-colors"
                            style={{ minHeight: '50px' }}
                          >
                            Tambah
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Diskon BR */}
                    <div className="space-y-5">
                      <h4 className="text-xl font-black text-emerald-950 border-b-2 border-emerald-100 pb-2.5">
                        Diskon BR (Maksimal 5 Tingkat)
                      </h4>
                      
                      {/* List of current discounts */}
                      <div className="space-y-3">
                        {addCustomerForm.diskon_br.map((disc, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl animate-fade-in">
                            <span className="font-extrabold text-emerald-950 text-lg">Tingkat {idx + 1}: {disc}%</span>
                            <button
                              type="button"
                              onClick={() => {
                                setAddCustomerForm(prev => {
                                  if (!prev) return null;
                                  const updated = [...prev.diskon_br];
                                  updated.splice(idx, 1);
                                  return { ...prev, diskon_br: updated };
                                });
                              }}
                              className="px-5 py-2.5 bg-rose-55 hover:bg-rose-100 text-rose-700 text-base font-extrabold rounded-xl border-2 border-rose-200 transition-colors cursor-pointer"
                              style={{ minHeight: '44px' }}
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                        {addCustomerForm.diskon_br.length === 0 && (
                          <p className="text-base font-extrabold text-slate-400 italic">Belum ada diskon BR</p>
                        )}
                      </div>

                      {/* Add new discount input */}
                      {addCustomerForm.diskon_br.length < 5 && (
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            placeholder="Nilai diskon (0-100)"
                            value={newBrDiscountAdd}
                            onChange={(e) => setNewBrDiscountAdd(e.target.value)}
                            className="flex-1 p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-lg font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white shadow-sm"
                            style={{ minHeight: '50px' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Number(newBrDiscountAdd);
                              if (isNaN(val) || val < 0 || val > 100 || newBrDiscountAdd.trim() === '') {
                                alert("Masukkan nilai diskon antara 0 dan 100!");
                                return;
                              }
                              setAddCustomerForm(prev => {
                                if (!prev) return null;
                                return { ...prev, diskon_br: [...prev.diskon_br, val] };
                              });
                              setNewBrDiscountAdd('');
                            }}
                            className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md cursor-pointer transition-colors"
                            style={{ minHeight: '50px' }}
                          >
                            Tambah
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-4 pt-8 border-t-2 border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomer(false)}
                      className="px-6 py-4 border-2 border-slate-300 text-slate-700 font-extrabold rounded-2xl text-lg hover:bg-slate-100 transition-all cursor-pointer"
                      style={{ minHeight: '54px' }}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAddCustomer}
                      className="px-8 py-4 bg-[#002B8F] hover:bg-[#001E66] text-white font-black rounded-2xl text-lg shadow-lg transition-all cursor-pointer"
                      style={{ minHeight: '54px' }}
                    >
                      Tambah Pelanggan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
          {/* Header Pelanggan */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pelanggan</h1>
              <span className="bg-blue-50 text-[#002B8F] text-[15px] font-extrabold px-3.5 py-1 rounded-full shadow-xs border border-blue-100/30">
                Total: {customers.length} Pelanggan
              </span>
            </div>
            
            {/* Bar Pencarian Tanpa Profil */}
            <div className="relative w-full sm:w-80 group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#002B8F] transition-colors">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari pelanggan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 transition-all shadow-xs"
                style={{ minHeight: '44px' }}
              />
            </div>
          </div>

          {/* Subheader & Tombol Tambah */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6 bg-white border-2 border-slate-200/60 rounded-2xl gap-4 shadow-xs">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Daftar Pelanggan Aktif
              </h2>
              <p className="text-sm font-semibold text-slate-500 mt-1.5 leading-relaxed">
                Kelola data diskon dan ambang batas bonus pelanggan Anda. Pelanggan berwarna oranye menandakan berhak atas jatah bonus.
              </p>
            </div>
            <button
              onClick={startAddCustomerForm}
              className="flex items-center justify-center space-x-2.5 px-6 py-3.5 bg-[#002B8F] hover:bg-[#001E66] text-white font-extrabold rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
              style={{ minHeight: '48px' }}
            >
              <UserPlus size={22} className="stroke-[2.5]" />
              <span className="text-base">Tambah Pelanggan Baru</span>
            </button>
          </div>

          {/* Tabel Pelanggan (Scroll Mode Mandiri) */}
          <div className="bg-white border-2 border-slate-200/60 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">KODE</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">NAMA PELANGGAN</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">DISKON LM</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">DISKON BR</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">AMBANG BONUS</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider text-center">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((c) => {
                      const isEligible = isEligibleForBonus(c);
                      return (
                        <tr 
                          key={c.id} 
                          className={`transition-colors hover:bg-slate-100/60 ${
                            isEligible ? 'bg-amber-50 hover:bg-amber-100/70 border-l-[6px] border-l-amber-500' : ''
                          }`}
                        >
                          <td className="py-6 px-6 font-mono font-bold text-base text-slate-700">{c.kode}</td>
                          <td className="py-6 px-6">
                            <div className="flex items-center space-x-3">
                              <span className="font-extrabold text-slate-900 text-lg">{c.nama}</span>
                              {isEligible && (
                                <span className="bg-amber-100 text-amber-900 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1 border border-amber-300 uppercase tracking-wider shadow-sm">
                                  <Award size={13} className="text-amber-600" /> Bonus Layak
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Diskon LM (Cascading Badge List) */}
                          <td className="py-6 px-6">
                            <div className="flex flex-wrap gap-1.5">
                              {c.diskon_lm.map((d, i) => (
                                <span key={i} className="bg-blue-50 text-[#002B8F] text-sm font-extrabold px-3 py-1.5 rounded-lg border-2 border-blue-200/80 shadow-xs">
                                  {d}%
                                </span>
                              ))}
                            </div>
                          </td>
                          {/* Diskon BR (Cascading Badge List) */}
                          <td className="py-6 px-6">
                            <div className="flex flex-wrap gap-1.5">
                              {c.diskon_br.map((d, i) => (
                                <span key={i} className="bg-emerald-50 text-emerald-800 text-sm font-extrabold px-3 py-1.5 rounded-lg border-2 border-emerald-200/80 shadow-xs">
                                  {d}%
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-6 px-6 font-extrabold text-slate-800 text-base">
                            Rp {c.threshold_bonus.toLocaleString('id-ID')}
                          </td>
                          <td className="py-6 px-6">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setCurrentPage(1);
                                }}
                                className="px-8 py-3 bg-[#002B8F] hover:bg-[#001E66] text-white text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center"
                                style={{ minHeight: '48px', minWidth: '100px' }}
                              >
                                Lihat
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-base font-bold text-slate-400">
                        Tidak ada data pelanggan yang cocok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )
      ) : activeBonDetail ? (
        /* TAMPILAN 3: HALAMAN DETAIL BON TRANSAKSI (BARU - RAMAH LANSIA) */
        <div className="space-y-6 animate-fade-in">
          {/* Header Kembali */}
          <div className="flex items-center border-b border-slate-200 pb-4">
            <button
              onClick={() => setActiveBonDetail(null)}
              className="flex items-center space-x-2.5 text-slate-650 hover:text-slate-900 font-extrabold text-lg transition-colors cursor-pointer"
              style={{ minHeight: '48px' }}
            >
              <ArrowLeft size={22} className="stroke-[2.5]" />
              <span>Kembali ke Transaksi Pelanggan</span>
            </button>
          </div>

          {/* Info Utama Bon */}
          <div className="bg-white border-2 border-slate-200/60 rounded-2xl p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Nomor Bon</p>
                <h2 className="text-3xl font-black text-[#002B8F] tracking-tight mt-1">
                  {activeBonDetail.nomor_bon}
                </h2>
              </div>
              <div className="scale-110 origin-top-left sm:origin-top-right pt-2">
                {renderStatusBadge(activeBonDetail.status)}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Tanggal Transaksi</p>
                <p className="font-extrabold text-slate-800 text-xl mt-1.5">
                  {new Date(activeBonDetail.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              {activeBonDetail.tanggal_lunas && (
                <div className="bg-emerald-50/50 border border-emerald-200 p-6 rounded-2xl">
                  <p className="text-sm font-bold text-emerald-600 uppercase tracking-wide">Tanggal Pelunasan</p>
                  <p className="font-extrabold text-emerald-800 text-xl mt-1.5">
                    {new Date(activeBonDetail.tanggal_lunas).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Item List & Summary */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Left side: List of items */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight pl-1">
                Rincian Barang / Produk
              </h3>
              
              <div className="space-y-4">
                {activeBonDetail.lines.map((line, i) => (
                  <div key={i} className="bg-white border-2 border-slate-200/60 rounded-2xl p-6 shadow-xs flex flex-col justify-between gap-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-xl font-black text-slate-900 leading-tight">
                          {line.productName}
                        </h4>
                        <p className="text-sm font-bold text-slate-500 mt-1.5 uppercase tracking-wider">
                          Tipe: {line.tipe} | Diskon: {line.diskon.join('% + ')}% (Cascading)
                        </p>
                      </div>
                      <span className="bg-blue-50 text-[#002B8F] text-base font-extrabold px-4 py-2 rounded-xl border border-blue-200/50 shrink-0">
                        {line.qty} barang
                      </span>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="text-slate-500 font-bold text-base">
                        Harga Satuan: <span className="text-slate-800">Rp {line.harga_final.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-sm font-bold block sm:inline mr-1">Subtotal:</span>
                        <span className="text-slate-900 text-2xl font-black">
                          Rp {(line.harga_final * line.qty).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Summary calculations */}
            <div className="bg-white border-2 border-slate-200/60 rounded-2xl p-6 shadow-xs h-fit space-y-6">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight border-b border-slate-100 pb-3">
                Ringkasan Tagihan
              </h3>
              
              <div className="space-y-4 text-base">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>Subtotal Produk:</span>
                  <span className="text-slate-800">Rp {activeBonDetail.omzet.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-500">
                  <span>Ongkos Kirim:</span>
                  <span className="text-slate-800">Rp {activeBonDetail.ongkir.toLocaleString('id-ID')}</span>
                </div>
                <div className="border-t-2 border-dashed border-slate-200 pt-4 flex flex-col space-y-2">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Total Tagihan Akhir</span>
                  <span className="text-3xl font-black text-[#002B8F] tracking-tight">
                    Rp {(activeBonDetail.omzet + activeBonDetail.ongkir).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {activeBonDetail.status === 'Open' && (
                <button
                  onClick={() => {
                      setTargetBonId(activeBonDetail.id);
                      setSettleMode('single');
                      setShowSettleModal(true);
                  }}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-md transition-all cursor-pointer text-base"
                  style={{ minHeight: '52px' }}
                >
                  <Check size={22} className="stroke-[3]" />
                  <span>Lunasi Transaksi Ini</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : isEditingCustomer ? (
        /* TAMPILAN 4: HALAMAN FORM UBAH DATA PELANGGAN (BARU - RAMAH LANSIA) */
        <div className="space-y-6 animate-fade-in">
          {/* Header Kembali */}
          <div className="flex items-center border-b border-slate-200 pb-4">
            <button
              onClick={() => setIsEditingCustomer(false)}
              className="flex items-center space-x-3 text-slate-700 hover:text-slate-900 font-black text-xl transition-colors cursor-pointer"
              style={{ minHeight: '52px' }}
            >
              <ArrowLeft size={26} className="stroke-[3]" />
              <span>Kembali ke Detail Pelanggan</span>
            </button>
          </div>

          {/* Form Card */}
          <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 md:p-10 shadow-md space-y-8">
            <div className="flex items-center space-x-3 text-[#002B8F] border-b-2 border-slate-100 pb-5">
              <Pencil size={28} className="stroke-[3]" />
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                Ubah Data Pelanggan
              </h3>
            </div>

            {editCustomerForm && (
              <div className="space-y-8">
                <div className="grid gap-6 sm:grid-cols-2 text-lg">
                  {/* Kode Pelanggan */}
                  <div className="space-y-2.5">
                    <label htmlFor="cust-code" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                      Kode Pelanggan (Wajib & Unik)
                    </label>
                    <input
                      id="cust-code"
                      type="text"
                      maxLength={10}
                      value={editCustomerForm.kode}
                      onChange={(e) => setEditCustomerForm(prev => prev ? { ...prev, kode: e.target.value } : null)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                      style={{ minHeight: '56px' }}
                    />
                  </div>

                  {/* Nama Pelanggan */}
                  <div className="space-y-2.5">
                    <label htmlFor="cust-name" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                      Nama Pelanggan (Wajib)
                    </label>
                    <input
                      id="cust-name"
                      type="text"
                      value={editCustomerForm.nama}
                      onChange={(e) => setEditCustomerForm(prev => prev ? { ...prev, nama: e.target.value } : null)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                      style={{ minHeight: '56px' }}
                    />
                  </div>

                  {/* No Telepon */}
                  <div className="space-y-2.5">
                    <label htmlFor="cust-phone" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                      Nomor Telepon
                    </label>
                    <input
                      id="cust-phone"
                      type="text"
                      value={editCustomerForm.telepon || ''}
                      onChange={(e) => setEditCustomerForm(prev => prev ? { ...prev, telepon: e.target.value } : null)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                      style={{ minHeight: '56px' }}
                    />
                  </div>

                  {/* Threshold Bonus */}
                  <div className="space-y-2.5">
                    <label htmlFor="cust-threshold" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                      Ambang Batas Bonus (Rp)
                    </label>
                    <input
                      id="cust-threshold"
                      type="number"
                      value={editCustomerForm.threshold_bonus}
                      onChange={(e) => setEditCustomerForm(prev => prev ? { ...prev, threshold_bonus: Number(e.target.value) } : null)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                      style={{ minHeight: '56px' }}
                    />
                  </div>

                  {/* Alamat (Full Width) */}
                  <div className="space-y-2.5 sm:col-span-2">
                    <label htmlFor="cust-address" className="block text-base font-extrabold text-slate-600 uppercase tracking-wide">
                      Alamat Lengkap
                    </label>
                    <textarea
                      id="cust-address"
                      rows={3}
                      value={editCustomerForm.alamat || ''}
                      onChange={(e) => setEditCustomerForm(prev => prev ? { ...prev, alamat: e.target.value } : null)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-xl font-bold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-4 focus:ring-[#002B8F]/10 focus:bg-white transition-all resize-none shadow-sm"
                    />
                  </div>
                </div>

                {/* Diskon Setting Section */}
                <div className="grid gap-8 sm:grid-cols-2 pt-8 border-t-2 border-slate-105">
                  {/* Diskon LM */}
                  <div className="space-y-5">
                    <h4 className="text-xl font-black text-blue-900 border-b-2 border-blue-105 pb-2.5">
                      Diskon LM (Maksimal 5 Tingkat)
                    </h4>
                    
                    {/* List of current discounts */}
                    <div className="space-y-3">
                      {editCustomerForm.diskon_lm.map((disc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl animate-fade-in">
                          <span className="font-extrabold text-blue-950 text-lg">Tingkat {idx + 1}: {disc}%</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditCustomerForm(prev => {
                                if (!prev) return null;
                                const updated = [...prev.diskon_lm];
                                updated.splice(idx, 1);
                                return { ...prev, diskon_lm: updated };
                              });
                            }}
                            className="px-5 py-2.5 bg-rose-55 hover:bg-rose-100 text-rose-700 text-base font-extrabold rounded-xl border-2 border-rose-200 transition-colors cursor-pointer"
                            style={{ minHeight: '44px' }}
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                      {editCustomerForm.diskon_lm.length === 0 && (
                        <p className="text-base font-extrabold text-slate-400 italic">Belum ada diskon LM</p>
                      )}
                    </div>

                    {/* Add new discount input */}
                    {editCustomerForm.diskon_lm.length < 5 && (
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          placeholder="Nilai diskon (0-100)"
                          value={newLmDiscount}
                          onChange={(e) => setNewLmDiscount(e.target.value)}
                          className="flex-1 p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-lg font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white shadow-sm"
                          style={{ minHeight: '50px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = Number(newLmDiscount);
                            if (isNaN(val) || val < 0 || val > 100 || newLmDiscount.trim() === '') {
                              alert("Masukkan nilai diskon antara 0 dan 100!");
                              return;
                            }
                            setEditCustomerForm(prev => {
                              if (!prev) return null;
                              return { ...prev, diskon_lm: [...prev.diskon_lm, val] };
                            });
                            setNewLmDiscount('');
                          }}
                          className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white text-base font-extrabold rounded-2xl shadow-md cursor-pointer transition-colors"
                          style={{ minHeight: '50px' }}
                        >
                          Tambah
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Diskon BR */}
                  <div className="space-y-5">
                    <h4 className="text-xl font-black text-emerald-950 border-b-2 border-emerald-105 pb-2.5">
                      Diskon BR (Maksimal 5 Tingkat)
                    </h4>
                    
                    {/* List of current discounts */}
                    <div className="space-y-3">
                      {editCustomerForm.diskon_br.map((disc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl animate-fade-in">
                          <span className="font-extrabold text-emerald-950 text-lg">Tingkat {idx + 1}: {disc}%</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditCustomerForm(prev => {
                                if (!prev) return null;
                                const updated = [...prev.diskon_br];
                                updated.splice(idx, 1);
                                return { ...prev, diskon_br: updated };
                              });
                            }}
                            className="px-5 py-2.5 bg-rose-55 hover:bg-rose-100 text-rose-700 text-base font-extrabold rounded-xl border-2 border-rose-200 transition-colors cursor-pointer"
                            style={{ minHeight: '44px' }}
                          >
                            Hapus
                          </button>
                        </div>
                      ))}
                      {editCustomerForm.diskon_br.length === 0 && (
                        <p className="text-base font-extrabold text-slate-400 italic">Belum ada diskon BR</p>
                      )}
                    </div>

                    {/* Add new discount input */}
                    {editCustomerForm.diskon_br.length < 5 && (
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          placeholder="Nilai diskon (0-100)"
                          value={newBrDiscount}
                          onChange={(e) => setNewBrDiscount(e.target.value)}
                          className="flex-1 p-4 bg-slate-50 border-2 border-slate-300 rounded-2xl text-lg font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white shadow-sm"
                          style={{ minHeight: '50px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = Number(newBrDiscount);
                            if (isNaN(val) || val < 0 || val > 100 || newBrDiscount.trim() === '') {
                              alert("Masukkan nilai diskon antara 0 dan 100!");
                              return;
                            }
                            setEditCustomerForm(prev => {
                              if (!prev) return null;
                              return { ...prev, diskon_br: [...prev.diskon_br, val] };
                            });
                            setNewBrDiscount('');
                          }}
                          className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold rounded-2xl shadow-md cursor-pointer transition-colors"
                          style={{ minHeight: '50px' }}
                        >
                          Tambah
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end space-x-4 pt-8 border-t-2 border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditingCustomer(false)}
                    className="px-6 py-4 border-2 border-slate-300 text-slate-700 font-extrabold rounded-2xl text-lg hover:bg-slate-100 transition-all cursor-pointer"
                    style={{ minHeight: '54px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditCustomer}
                    className="px-8 py-4 bg-[#002B8F] hover:bg-[#001E66] text-white font-black rounded-2xl text-lg shadow-lg transition-all cursor-pointer"
                    style={{ minHeight: '54px' }}
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAMPILAN 2: HALAMAN DETAIL PELANGGAN (BILA TOMBOL "LIHAT" DIKLIK) */
        <div className="space-y-6 animate-fade-in">
          {/* Header Kembali & Aksi */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
            <button
              onClick={() => setSelectedCustomerId(null)}
              className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-bold text-base transition-colors"
              style={{ minHeight: '48px' }}
            >
              <ArrowLeft size={20} />
              <span>Kembali ke Daftar</span>
            </button>
            
            <div className="flex items-center space-x-3.5">
              <button
                onClick={() => {
                  setSettleMode('bulk');
                  setShowSettleModal(true);
                }}
                className="flex items-center space-x-2.5 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md transition-all cursor-pointer text-base"
                style={{ minHeight: '48px' }}
              >
                <CheckSquare size={20} />
                <span>Lunasi Semua (Bulan Ini)</span>
              </button>
              
              <button
                onClick={handleExportCustomerPDF}
                className="flex items-center space-x-2.5 px-6 py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-extrabold rounded-xl transition-all cursor-pointer text-base"
                style={{ minHeight: '48px' }}
              >
                <FileDown size={20} />
                <span>Unduh PDF</span>
              </button>
            </div>
          </div>

          {/* Info Customer Card */}
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-white border-2 border-slate-200/60 rounded-2xl p-6 shadow-xs md:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {activeCustomer?.nama}
                    </h2>
                    <span className="bg-slate-100 text-slate-700 text-xs font-mono font-bold px-2.5 py-1 rounded">
                      KODE: {activeCustomer?.kode}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (activeCustomer) {
                      setEditCustomerForm({ ...activeCustomer });
                      setIsEditingCustomer(true);
                    }
                  }}
                  className="px-5 py-2.5 border-2 border-slate-300 hover:border-slate-400 text-slate-700 text-sm font-extrabold rounded-xl bg-white hover:bg-slate-50 shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2 shrink-0"
                  style={{ minHeight: '44px' }}
                >
                  <Pencil size={16} className="text-slate-500" />
                  <span>Ubah Data</span>
                </button>
              </div>
              
              {activeCustomer && (activeCustomer.telepon || activeCustomer.alamat) && (
                <div className="text-sm font-semibold text-slate-500 space-y-2 pt-1">
                  {activeCustomer.telepon && (
                    <div className="flex items-center space-x-2">
                      <Phone size={16} className="text-slate-400" />
                      <span className="text-slate-500">No. Telp:</span>
                      <span className="text-slate-700 font-bold">{activeCustomer.telepon}</span>
                    </div>
                  )}
                  {activeCustomer.alamat && (
                    <div className="flex items-start space-x-2">
                      <MapPin size={16} className="text-slate-400 mt-0.5" />
                      <span className="text-slate-500 shrink-0">Alamat:</span>
                      <span className="text-slate-700 font-bold">{activeCustomer.alamat}</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Diskon LM (Cascading)</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {activeCustomer?.diskon_lm.map((d, i) => (
                      <span key={i} className="bg-blue-50 text-[#002B8F] text-xs font-extrabold px-2 py-0.5 rounded border border-blue-100/50">
                        {d}%
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Diskon BR (Cascading)</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {activeCustomer?.diskon_br.map((d, i) => (
                      <span key={i} className="bg-emerald-50 text-emerald-800 text-xs font-extrabold px-2 py-0.5 rounded border border-emerald-100/50">
                        {d}%
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Threshold & Bonus Progress */}
            {activeCustomer && (
              <div className={`border-2 rounded-2xl p-6 shadow-xs flex flex-col justify-between ${
                isEligibleForBonus(activeCustomer) 
                  ? 'bg-amber-50/50 border-amber-200' 
                  : 'bg-white border-slate-200/60'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Status Jatah Bonus</span>
                  <Award size={20} className={isEligibleForBonus(activeCustomer) ? 'text-amber-600' : 'text-slate-300'} />
                </div>
                <div className="my-3">
                  <p className="text-[13px] font-bold text-slate-500">Ambang Batas: Rp {activeCustomer.threshold_bonus.toLocaleString('id-ID')}</p>
                  <p className="text-[24px] font-extrabold text-slate-900 mt-1">
                    {Math.floor(activeCustomer.accumulated_omzet / activeCustomer.threshold_bonus) - activeCustomer.bonus_claimed} Jatah
                  </p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${isEligibleForBonus(activeCustomer) ? 'bg-amber-500' : 'bg-[#002B8F]'}`} 
                    style={{ 
                      width: `${Math.min(100, ((activeCustomer.accumulated_omzet % activeCustomer.threshold_bonus) / activeCustomer.threshold_bonus) * 100)}%` 
                    }}
                  ></div>
                </div>
                <p className="text-[11px] font-bold text-slate-500 mt-2 text-right">
                  Sisa Akumulasi: Rp {(activeCustomer.accumulated_omzet % activeCustomer.threshold_bonus).toLocaleString('id-ID')}
                </p>
              </div>
            )}
          </div>

          {/* Month Filter & Summary Bulanan */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Summary Transaksi Bulanan</h3>
              
              {/* Year & Month Dropdown Filters without Icons */}
              <div className="flex items-center space-x-3">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-white border-2 border-slate-200 px-4 py-2 rounded-xl text-sm font-extrabold text-slate-700 outline-none focus:border-[#002B8F] min-h-[44px] cursor-pointer shadow-xs"
                >
                  {monthsList.map((m) => {
                    const isFutureMonth = selectedYear === currentYear && m.value > currentMonthNum;
                    if (isFutureMonth) return null;
                    return (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => handleYearChange(Number(e.target.value))}
                  className="bg-white border-2 border-slate-200 px-4 py-2 rounded-xl text-sm font-extrabold text-slate-700 outline-none focus:border-[#002B8F] min-h-[44px] cursor-pointer shadow-xs"
                >
                  {yearsList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-6 sm:grid-cols-4">
              {/* Total Piutang Card (Rose/Red Theme) */}
              <div className="bg-rose-50/80 border-2 border-rose-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-center min-h-[156px] transition-all">
                <span className="text-sm font-extrabold uppercase tracking-wider text-rose-600">Total Piutang</span>
                <p className="text-[26px] font-black text-rose-750 tracking-tight mt-2">
                  Rp {totalPiutang.toLocaleString('id-ID')}
                </p>
              </div>

              {/* Sudah Dibayar Card (Emerald/Green Theme) */}
              <div className="bg-emerald-50/80 border-2 border-emerald-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-center min-h-[156px] transition-all">
                <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-600">Sudah Dibayar</span>
                <p className="text-[26px] font-black text-emerald-800 tracking-tight mt-2">
                  Rp {totalTerbayar.toLocaleString('id-ID')}
                </p>
              </div>

              {/* Total Omzet Card (Blue/Navy Theme with LM/BR Breakdown) */}
              <div className="bg-blue-50/80 border-2 border-blue-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between min-h-[156px] transition-all">
                <div className="text-[#002B8F]">
                  <span className="text-sm font-extrabold uppercase tracking-wider">Total Omzet</span>
                  <p className="text-[26px] font-black tracking-tight mt-1">
                    Rp {totalOmzet.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="text-[14px] font-extrabold text-slate-500 mt-2.5 border-t border-blue-200/60 pt-2.5 shrink-0 space-y-0.5">
                  <div className="flex justify-between">
                    <span>LM:</span>
                    <span className="text-slate-800">Rp {totalOmzetLM.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BR:</span>
                    <span className="text-slate-800">Rp {totalOmzetBR.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>

              {/* Laba HL Card (Purple Theme) */}
              <div className="bg-purple-50/80 border-2 border-purple-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-center min-h-[156px] transition-all">
                <span className="text-sm font-extrabold uppercase tracking-wider text-purple-600">Laba HL</span>
                <p className="text-[26px] font-black text-purple-800 tracking-tight mt-2">
                  Rp {totalLaba.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
          </div>
          {/* Tabel Transaksi dengan Paginasi 20 Item (Wajib PRD) */}
          <div className="bg-white border-2 border-slate-200/60 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider pl-6">Tanggal</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">Nomor Bon</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">Total Tagihan</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider pr-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedBons.map((bon) => (
                    <tr key={bon.id} className="transition-colors hover:bg-slate-100/60">
                      <td className="py-6 px-6 pl-6 font-bold text-slate-700 text-base">
                        {new Date(bon.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="py-6 px-6 font-extrabold text-[#002B8F] text-lg">{bon.nomor_bon}</td>
                      <td className="py-6 px-6 font-extrabold text-slate-900 text-base">
                        Rp {(bon.omzet + bon.ongkir).toLocaleString('id-ID')}
                      </td>
                      <td className="py-6 px-6">
                        {renderStatusBadge(bon.status)}
                      </td>
                      <td className="py-6 px-6 pr-6">
                        <div className="flex items-center justify-center space-x-3">
                          <button
                            onClick={() => setActiveBonDetail(bon)}
                            className="flex items-center justify-center space-x-2 px-4 py-2.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#002B8F] text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                            style={{ minHeight: '48px', minWidth: '125px' }}
                          >
                            <Eye size={18} className="text-[#002B8F] stroke-[2.5]" />
                            <span>Lihat Detail</span>
                          </button>
                          
                          {bon.status === 'Open' ? (
                            <button
                              onClick={() => {
                                  setTargetBonId(bon.id);
                                  setSettleMode('single');
                                  setShowSettleModal(true);
                              }}
                              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
                              style={{ minHeight: '48px', minWidth: '125px' }}
                            >
                              <Check size={18} className="text-white stroke-[3]" />
                              <span>Bayar Lunas</span>
                            </button>
                          ) : bon.status === 'Lunas' ? (
                            <button
                              disabled
                              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 text-sm font-bold rounded-xl cursor-not-allowed"
                              style={{ minHeight: '48px', minWidth: '125px' }}
                            >
                              <Check size={18} className="text-slate-450 stroke-[3]" />
                              <span>Sudah Lunas</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-slate-100 border border-slate-200 text-slate-400 text-sm font-bold rounded-xl cursor-not-allowed"
                              style={{ minHeight: '48px', minWidth: '125px' }}
                            >
                              <XCircle size={18} className="text-slate-400 stroke-[2.5]" />
                              <span>Batal</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginasi Footer Wajib (20 item per page) */}
            <div className="bg-slate-50/50 border-t border-slate-200 p-5 flex items-center justify-between">
              <span className="text-base font-bold text-slate-600">
                Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, totalBonsCount)} dari {totalBonsCount} Bon
              </span>
              <div className="flex items-center space-x-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="w-12 h-12 border-2 border-slate-200 bg-white rounded-xl flex items-center justify-center text-slate-600 font-extrabold hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-12 h-12 font-extrabold rounded-xl flex items-center justify-center text-base cursor-pointer ${
                      page === currentPage 
                        ? 'bg-[#002B8F] text-white shadow-md' 
                        : 'border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="w-12 h-12 border-2 border-slate-200 bg-white rounded-xl flex items-center justify-center text-slate-600 font-extrabold hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL PELUNASAN (Bulk & Single) */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3 text-emerald-600">
              <CheckSquare size={26} />
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Konfirmasi Pelunasan
              </h3>
            </div>
            
            <p className="text-sm font-semibold text-slate-500 leading-relaxed">
              {settleMode === 'bulk' 
                ? 'Semua transaksi berstatus "Open" pada bulan Juni 2026 untuk pelanggan ini akan diubah statusnya menjadi Lunas.'
                : 'Transaksi terpilih akan diubah statusnya menjadi Lunas secara permanen.'}
            </p>

            <div className="space-y-2">
              <label htmlFor="settle-date" className="block text-sm font-bold text-slate-500 uppercase tracking-wide">
                Tanggal Pelunasan
              </label>
              <input
                id="settle-date"
                type="date"
                value={settleDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSettleDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#002B8F]"
                style={{ minHeight: '44px' }}
              />
            </div>

            <div className="flex items-center justify-end space-x-3.5 pt-2">
              <button
                onClick={() => setShowSettleModal(false)}
                className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                Batal
              </button>
              <button
                onClick={handleSettleConfirmation}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer"
                style={{ minHeight: '44px' }}
              >
                Konfirmasi Lunas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
