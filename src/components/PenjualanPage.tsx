import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { Customer, Bon, BonLine } from '../store/useStore';
import { 
  Search, Plus, Receipt, 
  Trash2, Check, AlertTriangle, ArrowLeft,
  Edit3, Printer, CheckCircle2, XCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${d} ${months[m]} ${y}`;
  }
  return dateString;
};

const formatDateMockup = (dateString: string) => {
  if (!dateString) return { dayMonth: '—', year: '' };
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return {
      dayMonth: `${d} ${months[m]}`,
      year: y
    };
  }
  return { dayMonth: dateString, year: '' };
};

const formatNomorBonMockup = (nomor: string) => {
  const lastHyphen = nomor.lastIndexOf('-');
  if (lastHyphen !== -1) {
    const part1 = nomor.substring(0, lastHyphen + 1);
    const part2 = nomor.substring(lastHyphen + 1);
    return (
      <div className="font-mono leading-tight">
        <div className="text-[14px] font-semibold text-blue-800/70">{part1}</div>
        <div className="text-[17px] font-black text-blue-900">{part2}</div>
      </div>
    );
  }
  const lastSlash = nomor.lastIndexOf('/');
  if (lastSlash !== -1) {
    const part1 = nomor.substring(0, lastSlash + 1);
    const part2 = nomor.substring(lastSlash + 1);
    return (
      <div className="font-mono leading-tight">
        <div className="text-[14px] font-semibold text-blue-800/70">{part1}</div>
        <div className="text-[17px] font-black text-blue-900">{part2}</div>
      </div>
    );
  }
  return <div className="font-mono font-black text-blue-900 text-[17px]">{nomor}</div>;
};

const formatTotalTagihanMockup = (num: number) => {
  const str = num.toLocaleString('id-ID');
  return (
    <div className="font-black text-slate-950 leading-none">
      <div className="text-slate-400 font-bold text-[11px] tracking-wider uppercase mb-1">Rp</div>
      <div className="text-[25px] font-black tracking-tight text-slate-950">{str}</div>
    </div>
  );
};

const getCurrentMonthYearLabel = () => {
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const d = new Date();
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
};

const calculateFinalPrice = (base: number, discounts: number[]) => {
  let val = base;
  discounts.forEach(d => {
    val = val * (1 - d / 100);
  });
  return Math.round(val);
};

const ITEMS_PER_PAGE = 20;

export default function PenjualanPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthNum = today.getMonth() + 1;
  const todayDateStr = today.toISOString().split('T')[0];

  const { 
    transactions, 
    customers, 
    products, 
    addTransaction, 
    updateTransaction, 
    cancelTransaction, 
    deleteTransaction,
    settleTransaction 
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'semua' | 'bulan-ini'>('semua');
  const [filterStatus, setFilterStatus] = useState<'semua' | 'Lunas' | 'Open' | 'Cancelled'>('semua');
  const [filterTipe, setFilterTipe] = useState<'semua' | 'biasa' | 'bonus'>('semua');
  const [filterMonth, setFilterMonth] = useState<string>('semua');
  const [filterYear, setFilterYear] = useState<string>('semua');
  const [currentPage, setCurrentPage] = useState(1);

  // Navigation states
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<Bon | null>(null);
  const [selectedBon, setSelectedBon] = useState<Bon | null>(null);

  // Form states
  const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [formNomorBon, setFormNomorBon] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formOngkir, setFormOngkir] = useState(0);
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formIsBonus, setFormIsBonus] = useState(false);
  const [formBonusCount, setFormBonusCount] = useState(1);
  const [formStatus, setFormStatus] = useState<'Open' | 'Lunas'>('Open');
  const [formLines, setFormLines] = useState<{
    productId: string;
    qty: number;
    line_id?: string;
  }[]>([]);

  // Settle Modal state
  const [settleTargetId, setSettleTargetId] = useState<string | null>(null);
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);

  // Cancel Modal state
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  // Delete Modal state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Success Notification
  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // ── Derived Data ─────────────────────────────────────────────────────────────
  
  const currentMonthYear = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })(); // e.g. "2026-06"
  
  const filtered = transactions.filter(t => {
    const q = searchQuery.toLowerCase();
    const cust = customers.find(c => c.id === t.customer_id);
    const custCode = cust ? cust.kode.toLowerCase() : '';

    const matchSearch = t.nomor_bon.toLowerCase().includes(q) || 
                        t.customerName.toLowerCase().includes(q) ||
                        custCode.includes(q);

    const matchMode = filterMode === 'semua' || t.tanggal.startsWith(currentMonthYear);
    const matchStatus = filterStatus === 'semua' || t.status === filterStatus;
    const matchTipe = filterTipe === 'semua' || (filterTipe === 'bonus' ? t.is_bonus : !t.is_bonus);
    
    const parts = t.tanggal.split('-');
    const matchMonth = filterMonth === 'semua' || parts[1] === filterMonth;
    const matchYear = filterYear === 'semua' || parts[0] === filterYear;

    return matchSearch && matchMode && matchStatus && matchTipe && matchMonth && matchYear;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const activeCustomers = customers.filter(c => c.deleted_at === null);
  const activeProducts = products.filter(p => p.deleted_at === null);

  const selectedCustomer = customers.find(c => c.id === formCustomerId);
  
  // Calculate bonus eligibility for selected customer
  const getBonusAvailable = (c: Customer) => {
    const total = Math.floor(c.accumulated_omzet / c.threshold_bonus);
    return Math.max(0, total - c.bonus_claimed);
  };

  const bonusAvailable = selectedCustomer ? getBonusAvailable(selectedCustomer) : 0;

  // ── Actions ──────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setFormTanggal(new Date().toISOString().split('T')[0]);
    // Auto generate suggestion for nomor_bon
    setFormNomorBon(`BON-${Date.now().toString().slice(-6)}`);
    setFormCustomerId('');
    setFormOngkir(0);
    setFormDeskripsi('');
    setFormIsBonus(false);
    setFormBonusCount(1);
    setFormStatus('Open');
    setFormLines([{ productId: '', qty: 1 }]);
    setEditTarget(null);
    setViewMode('add');
  };

  const openEdit = (t: Bon) => {
    setFormTanggal(t.tanggal);
    setFormNomorBon(t.nomor_bon);
    setFormCustomerId(t.customer_id);
    setFormOngkir(t.ongkir);
    setFormDeskripsi(t.deskripsi || '');
    setFormIsBonus(!!t.is_bonus);
    setFormBonusCount(t.bonus_count || 1);
    setFormStatus(t.status === 'Lunas' ? 'Lunas' : 'Open');
    setFormLines(t.lines.map(l => ({ productId: l.productId || '', qty: l.qty, line_id: l.line_id })));
    setEditTarget(t);
    setViewMode('edit');
  };

  const handleAddLine = () => {
    setFormLines([...formLines, { productId: '', qty: 1 }]);
  };

  const handleRemoveLine = (idx: number) => {
    setFormLines(formLines.filter((_, i) => i !== idx));
  };

  const handleLineProductChange = (idx: number, prodId: string) => {
    const updated = [...formLines];
    updated[idx].productId = prodId;
    setFormLines(updated);
  };

  const handleLineQtyChange = (idx: number, val: number) => {
    const updated = [...formLines];
    updated[idx].qty = Math.max(1, val);
    setFormLines(updated);
  };

  // Live calculation of form totals
  const getFormCalculations = () => {
    let omzet = 0;
    const computedLines = formLines.map(line => {
      const prod = products.find(p => p.id === line.productId);
      if (!prod) return null;

      const basePrice = prod.harga_base;
      const appliedDiscounts = selectedCustomer
        ? prod.tipe === 'LM' 
          ? selectedCustomer.diskon_lm 
          : selectedCustomer.diskon_br
        : [];
      
      const finalPrice = formIsBonus ? 0 : calculateFinalPrice(basePrice, appliedDiscounts);
      const subtotal = finalPrice * line.qty;
      omzet += subtotal;

      return {
        productName: prod.nama,
        tipe: prod.tipe,
        tipe_snapshot: prod.tipe,
        qty: line.qty,
        harga_base: basePrice,
        harga_base_snapshot: basePrice,
        diskon: appliedDiscounts,
        diskon_terapan_snapshot: appliedDiscounts,
        harga_final: finalPrice,
        harga_final_unit: finalPrice,
        harga_modal_snapshot: formIsBonus ? 0 : prod.harga_modal,
      };
    }).filter(Boolean);

    return {
      lines: computedLines,
      omzet,
      ongkir: formOngkir,
      grandTotal: omzet + formOngkir
    };
  };

  const formCalcs = getFormCalculations();

  const handleSave = async () => {
    if (!formNomorBon.trim()) { alert('Nomor Bon wajib diisi.'); return; }
    if (!formCustomerId) { alert('Pelanggan wajib dipilih.'); return; }
    if (formLines.some(l => !l.productId)) { alert('Semua baris produk harus dipilih.'); return; }

    const isEdit = viewMode === 'edit';

    const dup = transactions.some(t =>
      t.nomor_bon.toLowerCase() === formNomorBon.trim().toLowerCase() &&
      (!isEdit || t.id !== editTarget?.id)
    );
    if (dup) {
      alert(`Nomor Bon "${formNomorBon}" sudah terdaftar di sistem. Harap gunakan nomor lain.`);
      return;
    }

    const customer = customers.find(c => c.id === formCustomerId)!;

    const finalLines: BonLine[] = formLines.map(line => {
      const prod = products.find(p => p.id === line.productId)!;
      const appliedDiscounts = prod.tipe === 'LM' ? customer.diskon_lm : customer.diskon_br;
      const modal = formIsBonus ? 0 : prod.harga_modal;
      const finalUnit = formIsBonus ? 0 : calculateFinalPrice(prod.harga_base, appliedDiscounts);

      return {
        line_id: line.line_id,
        productId: prod.id,
        productName: prod.nama,
        tipe: prod.tipe,
        tipe_snapshot: prod.tipe,
        qty: line.qty,
        harga_base: prod.harga_base,
        harga_base_snapshot: prod.harga_base,
        diskon: appliedDiscounts,
        diskon_terapan_snapshot: appliedDiscounts,
        harga_final: finalUnit,
        harga_final_unit: finalUnit,
        harga_modal_snapshot: modal
      };
    });

    const omzet = finalLines.reduce((sum, l) => sum + (l.harga_final * l.qty), 0);

    const newBon: Bon = {
      id: isEdit ? editTarget!.id : '',
      nomor_bon: formNomorBon.trim(),
      tanggal: formTanggal,
      customer_id: formCustomerId,
      customerName: customer.nama,
      ongkir: formOngkir,
      omzet,
      status: formIsBonus ? 'Lunas' : formStatus,
      tanggal_lunas: formIsBonus ? formTanggal : (formStatus === 'Lunas' ? formTanggal : undefined),
      locked_at: formIsBonus || formStatus === 'Lunas' ? new Date().toISOString() : undefined,
      deskripsi: formDeskripsi || undefined,
      is_bonus: formIsBonus,
      bonus_count: formIsBonus ? formBonusCount : undefined,
      lines: finalLines
    };

    const err = isEdit ? await updateTransaction(newBon) : await addTransaction(newBon);
    if (err) {
      alert(err);
      return;
    }

    if (isEdit) {
      showToast(`Transaksi "${newBon.nomor_bon}" berhasil diperbarui!`);
      const updated = useStore.getState().transactions.find(t => t.id === editTarget?.id);
      if (updated) setSelectedBon(updated);
    } else {
      showToast(`Transaksi "${newBon.nomor_bon}" berhasil disimpan!`);
      setSelectedBon(null);
    }

    setViewMode('list');
    setEditTarget(null);
  };

  const confirmSettle = async () => {
    if (!settleTargetId) return;
    const err = await settleTransaction(settleTargetId, settleDate);
    if (err) { alert(err); return; }
    setSettleTargetId(null);
    showToast('Bon berhasil dilunasi!');
    const updated = useStore.getState().transactions.find(t => t.id === selectedBon?.id);
    if (updated) setSelectedBon(updated);
  };

  const confirmCancel = async () => {
    if (!cancelTargetId) return;
    const err = await cancelTransaction(cancelTargetId);
    if (err) { alert(err); return; }
    setCancelTargetId(null);
    showToast('Bon berhasil dibatalkan.');
    const updated = useStore.getState().transactions.find(t => t.id === selectedBon?.id);
    if (updated) setSelectedBon(updated);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    const err = await deleteTransaction(deleteTargetId);
    if (err) { alert(err); return; }
    setDeleteTargetId(null);
    setSelectedBon(null);
    showToast('Bon berhasil dihapus.');
  };

  // Helper to create PDF from canvas with proper sizing to match preview aspect (no extra white space, fills the "page" like the form)
  const createPdfFromCanvas = (canvas, fileName) => {
    const imgData = canvas.toDataURL('image/png');
    const aspect = canvas.width / canvas.height;
    const pdfWidth = 210; // mm A4 width
    const pdfHeight = pdfWidth / aspect;
    const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH, undefined, 'NONE');
    pdf.save(fileName);
  };

  // Helper to always generate nice PDF matching the preview layout (using temp offscreen div if no visible preview)
  const generateNotaPDF = (bon) => {
    const temp = document.createElement('div');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    temp.style.top = '-9999px';
    temp.style.width = '620px';
    temp.style.fontFamily = 'system-ui, sans-serif';
    // copy the exact structure from the visible preview to make canvas identical

    const lines = bon.lines || [];
    const hasOngkir = bon.ongkir > 0;

    let dataRows = '';
    lines.forEach(l => {
      const sub = l.harga_final * l.qty;
      dataRows += `<tr class="even:bg-gray-50"><td class="border border-gray-700 text-center p-1 font-medium">${l.qty}</td><td class="border border-gray-700 p-1">${l.productName}</td><td class="border border-gray-700 text-right p-1 font-mono">${formatRp(l.harga_final)}</td><td class="border border-gray-700 text-right p-1 font-mono font-bold">${formatRp(sub)}</td></tr>`;
    });
    if (hasOngkir) {
      dataRows += `<tr><td class="border border-gray-700 text-center p-1">1</td><td class="border border-gray-700 p-1">Ongkos Kirim (pass-through)</td><td class="border border-gray-700 text-right p-1 font-mono">${formatRp(bon.ongkir)}</td><td class="border border-gray-700 text-right p-1 font-mono">${formatRp(bon.ongkir)}</td></tr>`;
    }

    const total = bon.omzet + bon.ongkir;

    temp.innerHTML = `
      <div class="bg-white border-2 border-gray-500 p-3 text-[9px] leading-snug shadow-md" style="width: 620px; font-family: system-ui, sans-serif;">
        <div class="flex justify-between items-start border-b border-gray-300 pb-1 mb-1">
          <div class="text-left">
            <div class="text-[14px] font-bold tracking-wider" style="font-family: Georgia, serif;">HL Finance</div>
            <div class="text-[7px] text-gray-600">Manajemen Penjualan & Piutang Internal</div>
          </div>
          <div class="border border-gray-500 p-1 text-[7px] w-36 leading-tight bg-gray-50">
            Tanggal : ${bon.tanggal}<br/>
            Kepada Yth : ${bon.customerName}
          </div>
        </div>
        <div class="text-[8px] font-mono mb-1">Nota No. : ${bon.nomor_bon}</div>
        <table class="w-full border-2 border-gray-700 text-[8px]">
          <thead>
            <tr class="bg-gray-900 text-white">
              <th class="border border-gray-700 p-1 text-center w-14 font-bold">Banyaknya</th>
              <th class="border border-gray-700 p-1 font-bold">Nama Produk/Treatment</th>
              <th class="border border-gray-700 p-1 text-right w-16 font-bold">@ Harga</th>
              <th class="border border-gray-700 p-1 text-right w-16 font-bold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${dataRows}
          </tbody>
        </table>
        <div class="flex justify-between items-end mt-2 text-[8px]">
          <div class="text-left">
            Tanda Terima<br/>
            <div class="border-b-2 border-gray-700 w-20 mt-1"></div>
          </div>
          <div class="text-left">
            Kasir<br/>
            <div class="border-b-2 border-gray-700 w-20 mt-1"></div>
          </div>
          <div class="border-2 border-gray-700 bg-gray-100 px-2 py-1 text-right text-[9px] font-black">
            TOTAL<br/>${formatRp(total)}
          </div>
        </div>
        <div class="text-[6px] text-gray-500 text-right mt-1">Catatan: Barang yang sudah dibeli tidak dapat dikembalikan. Sistem HL Finance (Cash Basis).</div>
      </div>
    `;

    document.body.appendChild(temp);

    html2canvas(temp, { scale: 4, backgroundColor: '#ffffff' }).then(canvas => {
      createPdfFromCanvas(canvas, `Nota-${bon.nomor_bon || 'bon'}.pdf`);
      document.body.removeChild(temp);
    }).catch(e => {
      console.error('PDF capture failed', e);
      document.body.removeChild(temp);
      doManualPDF(bon);
    });
  };

  const handlePrint = (bon) => {
    const el = document.getElementById('nota-preview-bon') || document.getElementById('nota-preview-detail');
    if (el) {
      html2canvas(el, { scale: 4, backgroundColor: '#ffffff' }).then(canvas => {
        createPdfFromCanvas(canvas, `Nota-${bon.nomor_bon || 'bon'}.pdf`);
      }).catch(() => generateNotaPDF(bon));
      return;
    }
    generateNotaPDF(bon);
  };

  const doManualPDF = (bon: Bon) => {
    // kept as last resort, but now rarely used
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFillColor(0, 43, 143);
    doc.rect(15, y - 5, pageWidth - 30, 18, 'F');
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.text('HL FINANCE', 20, y + 3);
    doc.setFontSize(8);
    doc.text('Pencatatan Transaksi & Piutang Internal', 20, y + 9);
    doc.setTextColor(0);
    doc.text(`No: ${bon.nomor_bon}`, pageWidth - 20, y, { align: 'right' });
    doc.text(`${formatDate(bon.tanggal)} | ${bon.status}`, pageWidth - 20, y + 5, { align: 'right' });
    y += 20;

    doc.setFontSize(10);
    doc.text('Kepada Pelanggan:', 20, y);
    y += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(bon.customerName, 20, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
    if (bon.deskripsi) {
      doc.setFontSize(9);
      doc.text(`Catatan: ${bon.deskripsi}`, 20, y);
      y += 5;
    }
    y += 3;

    doc.setFontSize(8);
    doc.setFillColor(240, 244, 249);
    doc.rect(15, y - 4, pageWidth - 30, 7, 'F');
    doc.text('Produk', 17, y);
    doc.text('Tipe', 85, y);
    doc.text('Qty', 105, y);
    doc.text('Harga Final', 125, y);
    doc.text('Subtotal', 165, y);
    y += 6;
    doc.setDrawColor(200);
    doc.line(15, y, pageWidth - 15, y);
    y += 4;

    bon.lines.forEach((l) => {
      const sub = l.harga_final * l.qty;
      doc.text(l.productName.substring(0, 28), 17, y);
      doc.text(l.tipe, 85, y);
      doc.text(String(l.qty), 105, y);
      doc.text(formatRp(l.harga_final).replace('Rp ', ''), 125, y);
      doc.text(formatRp(sub).replace('Rp ', ''), 165, y);
      y += 5;
      if (y > 250) { doc.addPage(); y = 20; }
    });

    y += 3;
    doc.line(15, y, pageWidth - 15, y);
    y += 6;

    doc.setFontSize(9);
    doc.text('Omzet Transaksi:', 125, y);
    doc.text(formatRp(bon.omzet), 165, y, { align: 'right' });
    y += 5;
    doc.text('Ongkir (pass-through):', 125, y);
    doc.text(formatRp(bon.ongkir), 165, y, { align: 'right' });
    y += 5;
    doc.setFontSize(11);
    doc.setTextColor(0, 43, 143);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL TAGIHAN:', 125, y);
    doc.text(formatRp(bon.omzet + bon.ongkir), 165, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 10;

    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text('Dokumen sah - Sistem HL Finance (Cash Basis)', 20, y);

    doc.save(`BON-${bon.nomor_bon.replace(/[^A-Za-z0-9]/g, '')}.pdf`);
  };

  const renderList = () => (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Pencatatan Bon</h1>
          <p className="text-slate-500 text-base font-semibold mt-1">
            Catat dan kelola bon penjualan pelanggan
          </p>
        </div>
      </div>

      {/* Ringkasan Transaksi & Detailed Filters */}
      <div className="bg-white border-2 border-slate-200/60 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-extrabold text-slate-900">Ringkasan Transaksi</h3>
              {filterMode === 'bulan-ini' && (
                <span className="bg-[#e8f0fe] text-[#002B8F] border border-blue-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                  Periode: {getCurrentMonthYearLabel()}
                </span>
              )}
            </div>
            <div className="flex gap-2.5 mt-3">
              <button
                onClick={() => {
                  setFilterMode('semua');
                  setFilterMonth('semua');
                  setFilterYear('semua');
                  setCurrentPage(1);
                }}
                className={`px-6 py-2 rounded-full font-bold text-sm border transition-all cursor-pointer ${
                  filterMode === 'semua'
                    ? 'bg-[#e8f0fe] text-[#002B8F] border-blue-200 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
                style={{ minHeight: '40px' }}
              >
                Semua
              </button>
              <button
                onClick={() => {
                  setFilterMode('bulan-ini');
                  const d = new Date();
                  setFilterMonth(String(d.getMonth() + 1).padStart(2, '0'));
                  setFilterYear(String(d.getFullYear()));
                  setCurrentPage(1);
                }}
                className={`px-6 py-2 rounded-full font-bold text-sm border transition-all cursor-pointer ${
                  filterMode === 'bulan-ini'
                    ? 'bg-[#e8f0fe] text-[#002B8F] border-blue-200 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
                style={{ minHeight: '40px' }}
              >
                Bulan Ini
              </button>
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-3 px-6 py-3.5 bg-[#002B8F] hover:bg-[#001E66] text-white font-extrabold text-base rounded-2xl shadow-md transition-all cursor-pointer shrink-0"
            style={{ minHeight: '48px' }}
          >
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#002B8F] shrink-0 font-bold">
              <Plus size={16} className="stroke-[3.5]" />
            </div>
            <span>Buat Bon Baru</span>
          </button>
        </div>

        {/* Detailed Filters (Search, Status, Tipe, Bulan, Tahun) */}
        <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-4 items-end text-sm font-bold text-slate-700">
          {/* Search Box */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[280px]">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cari Transaksi</label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-[#002B8F] transition-colors">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Cari nomor bon atau nama pelanggan..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#002B8F] focus:bg-white focus:ring-2 focus:ring-[#002B8F]/10 transition-all"
                style={{ minHeight: '42px' }}
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Status Pembayaran</label>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value as any); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl outline-none focus:border-[#002B8F] min-h-[42px] cursor-pointer"
            >
              <option value="semua">Semua Status</option>
              <option value="Lunas">Lunas</option>
              <option value="Open">Piutang</option>
              <option value="Cancelled">Batal</option>
            </select>
          </div>

          {/* Tipe Filter */}
          <div className="flex flex-col gap-1.5 min-w-[145px]">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tipe Transaksi</label>
            <select
              value={filterTipe}
              onChange={e => { setFilterTipe(e.target.value as any); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl outline-none focus:border-[#002B8F] min-h-[42px] cursor-pointer"
            >
              <option value="semua">Semua Tipe</option>
              <option value="biasa">Penjualan Biasa</option>
              <option value="bonus">Transaksi Bonus</option>
            </select>
          </div>

          {/* Bulan Filter */}
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Bulan</label>
            <select
              value={filterMonth}
              onChange={e => {
                setFilterMonth(e.target.value);
                setFilterMode('semua');
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl outline-none focus:border-[#002B8F] min-h-[42px] cursor-pointer"
            >
              <option value="semua">Semua Bulan</option>
              {[
                { v: '01', l: 'Januari', num: 1 },
                { v: '02', l: 'Februari', num: 2 },
                { v: '03', l: 'Maret', num: 3 },
                { v: '04', l: 'April', num: 4 },
                { v: '05', l: 'Mei', num: 5 },
                { v: '06', l: 'Juni', num: 6 },
                { v: '07', l: 'Juli', num: 7 },
                { v: '08', l: 'Agustus', num: 8 },
                { v: '09', l: 'September', num: 9 },
                { v: '10', l: 'Oktober', num: 10 },
                { v: '11', l: 'November', num: 11 },
                { v: '12', l: 'Desember', num: 12 }
              ].map(m => {
                const isFuture = filterYear === currentYear.toString() && m.num > currentMonthNum;
                if (isFuture) return null;
                return <option key={m.v} value={m.v}>{m.l}</option>;
              })}
            </select>
          </div>

          {/* Tahun Filter */}
          <div className="flex flex-col gap-1.5 min-w-[100px]">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tahun</label>
            <select
              value={filterYear}
              onChange={e => {
                const yr = e.target.value;
                setFilterYear(yr);
                setFilterMode('semua');
                setCurrentPage(1);
                if (yr === currentYear.toString() && filterMonth !== 'semua' && parseInt(filterMonth, 10) > currentMonthNum) {
                  setFilterMonth('semua');
                }
              }}
              className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl outline-none focus:border-[#002B8F] min-h-[42px] cursor-pointer"
            >
              <option value="semua">Semua Tahun</option>
              {Array.from({ length: currentYear - 2023 + 1 }, (_, i) => 2023 + i).map(yr => (
                <option key={yr} value={yr.toString()}>{yr}</option>
              ))}
            </select>
          </div>
          
          {/* Reset Filters button */}
          {(filterStatus !== 'semua' || filterTipe !== 'semua' || filterMonth !== 'semua' || filterYear !== 'semua') && (
            <button
              onClick={() => {
                setFilterStatus('semua');
                setFilterTipe('semua');
                setFilterMonth('semua');
                setFilterYear('semua');
                setFilterMode('semua');
                setCurrentPage(1);
              }}
              className="px-4 py-2 border-2 border-slate-350 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-sm cursor-pointer transition-colors"
              style={{ minHeight: '42px' }}
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table view */}
      <div className="bg-white border-2 border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-[#f0f4f9] border-b border-slate-200">
              <tr>
                <th className="py-5 px-6 text-[17px] font-black text-slate-800 uppercase tracking-wide" style={{ width: '140px' }}>Tanggal</th>
                <th className="py-5 px-6 text-[17px] font-black text-slate-800 uppercase tracking-wide" style={{ width: '190px' }}>Nomor Bon</th>
                <th className="py-5 px-6 text-[17px] font-black text-slate-800 uppercase tracking-wide">Nama Pelanggan</th>
                <th className="py-5 px-6 text-[17px] font-black text-slate-800 uppercase tracking-wide" style={{ width: '180px' }}>Total Tagihan</th>
                <th className="py-5 px-6 text-[17px] font-black text-slate-800 uppercase tracking-wide text-center" style={{ width: '160px' }}>Status</th>
                <th className="py-5 px-6 text-[17px] font-black text-slate-800 uppercase tracking-wide text-center" style={{ width: '140px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? paginated.map(t => {
                const isLunas = t.status === 'Lunas';
                const isCancelled = t.status === 'Cancelled';
                const dateObj = formatDateMockup(t.tanggal);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-6 px-6 font-bold text-[19px] text-slate-900 leading-tight">
                      <div>{dateObj.dayMonth}</div>
                      <div className="text-slate-400 font-bold text-[14px] mt-0.5">{dateObj.year}</div>
                    </td>
                    <td className="py-6 px-6">
                      {formatNomorBonMockup(t.nomor_bon)}
                    </td>
                    <td className="py-6 px-6">
                      <span className="font-black text-slate-900 text-[20px] tracking-tight">{t.customerName}</span>
                      {t.is_bonus && (
                        <span className="ml-2 bg-amber-50 text-amber-800 text-[12px] font-black px-3 py-1 rounded-full border border-amber-200 uppercase tracking-wider">
                          🎁 BONUS
                        </span>
                      )}
                    </td>
                    <td className="py-6 px-6">
                      {formatTotalTagihanMockup(t.omzet + t.ongkir)}
                    </td>
                    <td className="py-6 px-6 text-center">
                      <div className="flex justify-center">
                        {isLunas ? (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[15px] font-black shadow-2xs">
                            <Check size={16} className="stroke-[3.5]" />
                            <span>Lunas</span>
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-full text-[15px] font-black shadow-2xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600" style={{ backgroundColor: '#c5221f' }} />
                            <span>Batal</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[15px] font-black shadow-2xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span>Piutang</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-6 px-6">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => setSelectedBon(t)}
                          className="w-28 py-3 bg-white border-2 border-[#002B8F] text-[#002B8F] hover:bg-blue-50 font-black text-[15px] rounded-xl transition-all cursor-pointer leading-tight text-center shadow-xs"
                          style={{ minHeight: '42px' }}
                        >
                          Lihat Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Receipt size={56} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-xl font-extrabold text-slate-400">Tidak ada transaksi ditemukan.</p>
                    <p className="text-base font-semibold text-slate-300 mt-1">Cari dengan nomor bon atau pelanggan lainnya.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {filtered.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 p-5 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-sm font-bold text-slate-600">
              Menampilkan {filtered.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} dari {filtered.length} transaksi
            </span>
            <div className="flex items-center gap-2">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
                className="w-10 h-10 border border-slate-200 bg-white rounded-xl font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center justify-center"
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
                .map(pg => (
                  <button 
                    key={pg} 
                    onClick={() => setCurrentPage(pg)}
                    className={`w-10 h-10 font-extrabold rounded-xl flex items-center justify-center cursor-pointer ${
                      pg === currentPage ? 'bg-[#002B8F] text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pg}
                  </button>
                ))}
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
                className="w-10 h-10 border border-slate-200 bg-white rounded-xl font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center justify-center"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );

  // ─── FORM VIEW (ADD / EDIT) ──────────────────────────────────────────────────

  const renderForm = () => {
    const isEdit = viewMode === 'edit';
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back button */}
        <div className="flex items-center border-b border-slate-200 pb-4">
          <button
            onClick={() => { setViewMode('list'); setEditTarget(null); }}
            className="flex items-center gap-2 text-slate-600 hover:text-[#002B8F] font-bold text-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={22} className="stroke-[2.5]" />
            <span>Kembali ke Daftar Transaksi</span>
          </button>
        </div>

        {/* Card Form */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className={`px-7 py-5 flex items-center gap-3 ${isEdit ? 'bg-slate-700' : 'bg-[#002B8F]'}`}>
            <Receipt size={28} className="text-white" />
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isEdit ? 'Ubah Bon Transaksi' : 'Catat Bon Transaksi Baru'}
              </h2>
              <p className="text-white/80 font-medium text-sm mt-0.5">
                {isEdit ? `Mengubah transaksi: ${editTarget?.nomor_bon}` : 'Isi kolom di bawah ini untuk menyimpan transaksi baru'}
              </p>
            </div>
          </div>

          <div className="p-8 space-y-6">
            
            {/* Top row elements */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Tanggal */}
              <div className="space-y-2">
                <label htmlFor="tx-date" className="block text-base font-bold text-slate-700">Tanggal Bon</label>
                <input
                  id="tx-date"
                  type="date"
                  value={formTanggal}
                  max={todayDateStr}
                  onChange={e => setFormTanggal(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                  style={{ minHeight: '48px' }}
                />
              </div>

              {/* Nomor Bon */}
              <div className="space-y-2">
                <label htmlFor="tx-nomor" className="block text-base font-bold text-slate-700">Nomor Bon</label>
                <input
                  id="tx-nomor"
                  type="text"
                  placeholder="Contoh: BON-001/26"
                  value={formNomorBon}
                  onChange={e => setFormNomorBon(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                  style={{ minHeight: '48px' }}
                />
              </div>

              {/* Pelanggan */}
              <div className="space-y-2">
                <label htmlFor="tx-customer" className="block text-base font-bold text-slate-700">Pilih Pelanggan</label>
                <select
                  id="tx-customer"
                  value={formCustomerId}
                  onChange={e => {
                    setFormCustomerId(e.target.value);
                    setFormIsBonus(false); // Reset bonus toggle when customer changes
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                  style={{ minHeight: '48px' }}
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {activeCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.kode} - {c.nama}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Bonus Section (Notifikasi & Toggle) */}
            {selectedCustomer && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-800">
                      Informasi Diskon & Bonus: {selectedCustomer.nama}
                    </h4>
                    <p className="text-sm font-semibold text-slate-500 mt-0.5">
                      Diskon LM: <strong className="text-blue-800 font-bold">{selectedCustomer.diskon_lm.length > 0 ? selectedCustomer.diskon_lm.join('% + ') + '%' : '0%'}</strong> | 
                      Diskon BR: <strong className="text-emerald-700 font-bold">{selectedCustomer.diskon_br.length > 0 ? selectedCustomer.diskon_br.join('% + ') + '%' : '0%'}</strong>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Ambang Batas Bonus: {formatRp(selectedCustomer.threshold_bonus)} | Total Omzet Lunas: {formatRp(selectedCustomer.accumulated_omzet)}
                    </p>
                  </div>

                  {/* Bonus Available Warning Badge */}
                  {bonusAvailable > 0 ? (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                      <AlertTriangle size={20} className="shrink-0 text-amber-600" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide">JATAH BONUS LAYAK</p>
                        <p className="text-sm font-bold">{bonusAvailable} Jatah Bonus Tersedia</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-400 bg-slate-200/50 border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider">
                      Belum layak bonus
                    </span>
                  )}
                </div>

                {/* Bonus Redeem Option */}
                {bonusAvailable > 0 && (
                  <div className="flex items-center gap-4 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                    <label className="flex items-center gap-2 text-base font-extrabold text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsBonus}
                        onChange={e => {
                          const val = e.target.checked;
                          setFormIsBonus(val);
                          if (val) {
                            setFormStatus('Lunas'); // Automatically locks to Lunas when is_bonus is ON
                          }
                        }}
                        className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                      />
                      Aktifkan Pencairan Bon Bonus (Barang Gratis)
                    </label>

                    {formIsBonus && (
                      <div className="flex items-center gap-2 shrink-0">
                        <label className="text-xs font-bold text-amber-800">Jumlah Jatah yang Ditukar:</label>
                        <select
                          value={formBonusCount}
                          onChange={e => setFormBonusCount(Number(e.target.value))}
                          className="px-2 py-1 bg-white border border-amber-200 rounded-lg text-sm font-bold text-amber-900 focus:outline-none"
                        >
                          {Array.from({ length: bonusAvailable }, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num} Jatah</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Line items section */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Daftar Barang Belanjaan</h3>
                <button
                  type="button"
                  onClick={handleAddLine}
                  disabled={!formCustomerId}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:border-[#002B8F] hover:bg-blue-50 text-slate-600 hover:text-[#002B8F] font-bold text-sm rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus size={16} />
                  Tambah Produk
                </button>
              </div>

              {/* Table of items inside form */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <tr>
                      <th className="p-3">Pilih Produk</th>
                      <th className="p-3 text-center">Tipe</th>
                      <th className="p-3 text-right">Harga Base</th>
                      <th className="p-3 text-center">Diskon Terapan</th>
                      <th className="p-3 text-right">Harga Final</th>
                      <th className="p-3 text-center" style={{ width: '150px' }}>Qty</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-center" style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formLines.map((line, idx) => {
                      const selectedProd = products.find(p => p.id === line.productId);
                      const basePrice = selectedProd ? selectedProd.harga_base : 0;
                      const type = selectedProd ? selectedProd.tipe : '—';
                      
                      const discounts = selectedCustomer && selectedProd
                        ? selectedProd.tipe === 'LM' 
                          ? selectedCustomer.diskon_lm 
                          : selectedCustomer.diskon_br
                        : [];

                      const finalUnit = formIsBonus ? 0 : calculateFinalPrice(basePrice, discounts);
                      const subtotal = finalUnit * line.qty;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            <select
                              value={line.productId}
                              onChange={e => handleLineProductChange(idx, e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#002B8F]"
                            >
                              <option value="">-- Pilih Produk --</option>
                              {activeProducts.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.kode} - {p.nama}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-black ${
                              type === 'LM' ? 'bg-blue-50 text-[#002B8F]' : type === 'BR' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-400'
                            }`}>
                              {type}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-medium">{formatRp(basePrice)}</td>
                          <td className="p-3 text-center text-xs font-bold text-slate-500">
                            {discounts.length > 0 ? discounts.map(d => `${d}%`).join(' + ') : '—'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-blue-900">{formatRp(finalUnit)}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1 min-w-[100px]">
                              <button
                                type="button"
                                onClick={() => handleLineQtyChange(idx, line.qty - 1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold rounded-md transition-all cursor-pointer text-sm select-none active:scale-[0.9]"
                                style={{ minWidth: '28px', minHeight: '28px' }}
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={line.qty}
                                onChange={e => handleLineQtyChange(idx, Number(e.target.value))}
                                className="w-8 h-7 px-0 py-0 bg-[#002B8F] text-white font-black rounded-md text-center text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleLineQtyChange(idx, line.qty + 1)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold rounded-md transition-all cursor-pointer text-sm select-none active:scale-[0.9]"
                                style={{ minWidth: '28px', minHeight: '28px' }}
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">{formatRp(subtotal)}</td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {formLines.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                          Belum ada produk ditambahkan. Klik tombol "+ Tambah Produk" di atas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom calculation fields & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
              
              {/* Status & Shipping Cost */}
              <div className="space-y-4">
                {/* Status Bon */}
                <div className="space-y-2">
                  <label htmlFor="tx-status" className="block text-base font-bold text-slate-700">Status Pembayaran</label>
                  {formIsBonus ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-bold">
                      <CheckCircle2 size={18} />
                      <span>LUNAS (Transaksi Bonus otomatis berstatus Lunas)</span>
                    </div>
                  ) : (
                    <select
                      id="tx-status"
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                      style={{ minHeight: '48px' }}
                    >
                      <option value="Open">Piutang</option>
                      <option value="Lunas">Lunas (Sudah Bayar)</option>
                    </select>
                  )}
                </div>

                {/* Ongkos Kirim */}
                <div className="space-y-2">
                  <label htmlFor="tx-shipping" className="block text-base font-bold text-slate-700">Biaya Ongkos Kirim (Rp)</label>
                  <input
                    id="tx-shipping"
                    type="number"
                    min={0}
                    value={formOngkir || ''}
                    onChange={e => setFormOngkir(Math.max(0, Number(e.target.value)))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                    style={{ minHeight: '48px' }}
                  />
                </div>

                {/* Deskripsi */}
                <div className="space-y-2">
                  <label htmlFor="tx-desc" className="block text-base font-bold text-slate-700">Catatan / Deskripsi (Opsional)</label>
                  <textarea
                    id="tx-desc"
                    rows={2}
                    placeholder="Tuliskan catatan tambahan transaksi di sini..."
                    value={formDeskripsi}
                    onChange={e => setFormDeskripsi(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all resize-none shadow-sm"
                  />
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                <h4 className="text-base font-black text-slate-800 uppercase tracking-wide">Ringkasan Nilai Bon</h4>
                
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-slate-700 text-[16px] font-bold">
                    <span>Omzet Produk (Setelah Diskon):</span>
                    <span className="font-mono font-black text-slate-900 text-[18px]">{formatRp(formCalcs.omzet)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 text-[16px] font-bold">
                    <span>Biaya Kirim (Ongkir):</span>
                    <span className="font-mono font-black text-slate-900 text-[18px]">{formatRp(formCalcs.ongkir)}</span>
                  </div>
                  <div className="border-t-2 border-slate-200 pt-3.5 flex justify-between items-center text-slate-950 font-black">
                    <span className="text-[18px]">Total Tagihan:</span>
                    <span className="font-mono text-[28px] text-[#002B8F] tracking-tight">{formatRp(formCalcs.grandTotal)}</span>
                  </div>
                </div>

                {formIsBonus && (
                  <p className="text-xs text-amber-700 font-bold bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                    * Produk ini bernilai Rp 0 pada omzet karena ditukarkan dengan akumulasi bonus yang dimiliki pelanggan.
                  </p>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => { setViewMode('list'); setEditTarget(null); }}
                    className="px-5 py-2.5 border border-slate-300 text-slate-600 hover:text-slate-800 font-bold rounded-xl text-sm hover:bg-slate-100 transition-all cursor-pointer"
                    style={{ minHeight: '42px' }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-6 py-2.5 bg-[#002B8F] hover:bg-[#001E66] text-white font-bold rounded-xl text-sm shadow-sm hover:shadow transition-all cursor-pointer"
                    style={{ minHeight: '42px' }}
                  >
                    {isEdit ? 'Simpan Perubahan' : 'Simpan Bon Baru'}
                  </button>
                </div>
              </div>

            </div>

            {/* Live Preview Nota - format seperti contoh image, auto dari input, user bisa edit bebas via form di atas */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-600">Preview Nota (auto input, preview real-time, edit via form)</span>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('nota-preview-bon');
                    if (el) {
                      html2canvas(el, { scale: 4, backgroundColor: '#ffffff' }).then(canvas => {
                        const imgData = canvas.toDataURL('image/png');
                        const aspect = canvas.width / canvas.height;
                        const pdfWidth = 210;
                        const pdfHeight = pdfWidth / aspect;
                        const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
                        const pageW = pdf.internal.pageSize.getWidth();
                        const pageH = pdf.internal.pageSize.getHeight();
                        pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH, undefined, 'NONE');
                        pdf.save(`Nota-Preview-${formNomorBon || 'baru'}.pdf`);
                      });
                    }
                  }}
                  className="text-xs px-3 py-1 border border-slate-300 hover:bg-slate-100 rounded font-bold cursor-pointer"
                >
                  Unduh PDF (exact dari preview)
                </button>
              </div>
              <div className="flex justify-center bg-gray-50 p-3 rounded">
                <div id="nota-preview-bon" className="bg-white border-2 border-gray-500 p-3 text-[9px] leading-snug shadow-md" style={{width: '620px', fontFamily: 'system-ui, sans-serif'}}>
                  <div className="flex justify-between items-start border-b border-gray-300 pb-1 mb-1">
                    <div className="text-left">
                      <div className="text-[14px] font-bold tracking-wider" style={{fontFamily: 'Georgia, serif'}}>HL Finance</div>
                      <div className="text-[7px] text-gray-600">Manajemen Penjualan & Piutang Internal</div>
                    </div>
                    <div className="border border-gray-500 p-1 text-[7px] w-36 leading-tight bg-gray-50">
                      Tanggal : {formTanggal}<br/>
                      Kepada Yth : {selectedCustomer ? selectedCustomer.nama : ''}{selectedCustomer?.alamat ? ', ' + selectedCustomer.alamat.substring(0,25) : ''}
                    </div>
                  </div>
                  <div className="text-[8px] font-mono mb-1">Nota No. : {formNomorBon}</div>
                  <table className="w-full border-2 border-gray-700 text-[8px]">
                    <thead>
                      <tr className="bg-gray-900 text-white">
                        <th className="border border-gray-700 p-1 text-center w-14 font-bold">Banyaknya</th>
                        <th className="border border-gray-700 p-1 font-bold">Nama Produk/Treatment</th>
                        <th className="border border-gray-700 p-1 text-right w-16 font-bold">@ Harga</th>
                        <th className="border border-gray-700 p-1 text-right w-16 font-bold">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formCalcs.lines || []).filter(Boolean).map((l: any, idx) => (
                        <tr key={idx} className="even:bg-gray-50">
                          <td className="border border-gray-700 text-center p-1 font-medium">{l.qty}</td>
                          <td className="border border-gray-700 p-1">{l.productName}</td>
                          <td className="border border-gray-700 text-right p-1 font-mono">{formatRp(l.harga_final)}</td>
                          <td className="border border-gray-700 text-right p-1 font-mono font-bold">{formatRp(l.harga_final * l.qty)}</td>
                        </tr>
                      ))}
                      {formOngkir > 0 && (
                        <tr>
                          <td className="border border-gray-700 text-center p-1">1</td>
                          <td className="border border-gray-700 p-1">Ongkos Kirim (pass-through)</td>
                          <td className="border border-gray-700 text-right p-1 font-mono">{formatRp(formOngkir)}</td>
                          <td className="border border-gray-700 text-right p-1 font-mono">{formatRp(formOngkir)}</td>
                        </tr>
                      )}
                      {Array.from({length: Math.max(0, 5 - (formCalcs.lines || []).length - (formOngkir > 0 ? 1 : 0))}).map((_,i) => (
                        <tr key={'e'+i}>
                          <td className="border border-gray-700 p-1 h-5"></td>
                          <td className="border border-gray-700 p-1"></td>
                          <td className="border border-gray-700 p-1"></td>
                          <td className="border border-gray-700 p-1"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between items-end mt-2 text-[8px]">
                    <div className="text-left">
                      Tanda Terima<br/>
                      <div className="border-b-2 border-gray-700 w-20 mt-1"></div>
                    </div>
                    <div className="text-left">
                      Kasir<br/>
                      <div className="border-b-2 border-gray-700 w-20 mt-1"></div>
                    </div>
                    <div className="border-2 border-gray-700 bg-gray-100 px-2 py-1 text-right text-[9px] font-black">
                      TOTAL<br/>{formatRp(formCalcs.grandTotal)}
                    </div>
                  </div>
                  <div className="text-[6px] text-gray-500 text-right mt-1">Catatan: Barang yang sudah dibeli tidak dapat dikembalikan. Sistem HL Finance (Cash Basis).</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    );
  };

  // ─── DETAIL VIEW MODAL ────────────────────────────────────────────────────────

  const renderDetail = () => {
    if (!selectedBon) return null;
    const isLunas = selectedBon.status === 'Lunas';
    const isCancelled = selectedBon.status === 'Cancelled';
    const totalTagihan = selectedBon.omzet + selectedBon.ongkir;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 flex-wrap gap-3">
          <button
            onClick={() => setSelectedBon(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-[#002B8F] font-bold text-lg transition-colors cursor-pointer"
          >
            <ArrowLeft size={22} className="stroke-[2.5]" />
            <span>Kembali ke Daftar Transaksi</span>
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={() => handlePrint(selectedBon)}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:border-slate-500 hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-xl cursor-pointer"
              style={{ minHeight: '38px' }}
            >
              <Printer size={16} />
              Cetak PDF / Bon
            </button>
            {!isLunas && !isCancelled && (
              <>
                <button
                  onClick={() => openEdit(selectedBon)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm rounded-xl cursor-pointer"
                  style={{ minHeight: '38px' }}
                >
                  <Edit3 size={16} />
                  Ubah Bon
                </button>
                <button
                  onClick={() => setCancelTargetId(selectedBon.id)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-sm rounded-xl cursor-pointer"
                  style={{ minHeight: '38px' }}
                >
                  <XCircle size={16} />
                  Batalkan
                </button>
                <button
                  onClick={() => setDeleteTargetId(selectedBon.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl cursor-pointer"
                  style={{ minHeight: '38px' }}
                >
                  <Trash2 size={16} />
                  Hapus
                </button>
                <button
                  onClick={() => {
                    setSettleTargetId(selectedBon.id);
                    setSettleDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl cursor-pointer"
                  style={{ minHeight: '38px' }}
                >
                  <Check size={16} />
                  Lunasi
                </button>
              </>
            )}
          </div>
        </div>

        {/* Invoice Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
          
          {/* Top Info Banner */}
          <div className="flex justify-between border-b border-slate-100 pb-5 items-start flex-wrap gap-4">
            <div className="space-y-1">
              <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-black border uppercase tracking-wider ${
                isLunas
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isCancelled
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isLunas ? 'Lunas' : isCancelled ? 'Batal' : 'Piutang'}
              </span>
              <h2 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{selectedBon.nomor_bon}</h2>
              <p className="text-sm font-semibold text-slate-500">
                Tanggal Dibuat: {formatDate(selectedBon.tanggal)}
              </p>
              {isLunas && selectedBon.tanggal_lunas && (
                <p className="text-sm font-bold text-emerald-700">
                  Tanggal Pelunasan: {formatDate(selectedBon.tanggal_lunas)}
                </p>
              )}
            </div>

            <div className="text-right space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Pelanggan</span>
              <span className="text-xl font-extrabold text-slate-900 block">{selectedBon.customerName}</span>
              {selectedBon.is_bonus && (
                <span className="inline-block bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">
                  🎁 Redempton Bonus ({selectedBon.bonus_count || 1} Jatah)
                </span>
              )}
            </div>
          </div>

          {/* Lines items table */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">Rincian Barang / Produk</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                  <tr>
                    <th className="p-3">Nama Produk</th>
                    <th className="p-3 text-center">Tipe</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Harga Base</th>
                    <th className="p-3 text-center">Diskon</th>
                    <th className="p-3 text-right">Harga Final</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {selectedBon.lines.map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50/20">
                      <td className="p-3 font-semibold text-slate-900">{l.productName}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-black ${
                          l.tipe === 'LM' ? 'bg-blue-50 text-[#002B8F]' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          {l.tipe}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold">{l.qty} barang</td>
                      <td className="p-3 text-right font-mono">{formatRp(l.harga_base)}</td>
                      <td className="p-3 text-center text-xs font-bold text-slate-500">
                        {l.diskon.length > 0 ? l.diskon.map(d => `${d}%`).join(' + ') : '—'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-900">{formatRp(l.harga_final)}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-950">{formatRp(l.harga_final * l.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing summary & Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            {/* Left col: Deskripsi */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Catatan Tambahan</span>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-semibold text-slate-700 min-h-[80px]">
                {selectedBon.deskripsi || 'Tidak ada catatan tambahan untuk transaksi ini.'}
              </div>
            </div>

            {/* Right col: Totals */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 space-y-3.5">
              <div className="flex justify-between items-center text-slate-700 text-[16px] font-bold">
                <span>Total Omzet Produk:</span>
                <span className="font-mono font-black text-slate-900 text-[18px]">{formatRp(selectedBon.omzet)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 text-[16px] font-bold">
                <span>Biaya Kirim (Ongkir):</span>
                <span className="font-mono font-black text-slate-900 text-[18px]">{formatRp(selectedBon.ongkir)}</span>
              </div>
              <div className="border-t-2 border-slate-200 pt-3.5 flex justify-between items-center text-slate-950 font-black">
                <span className="text-[18px]">Total Tagihan:</span>
                <span className="font-mono text-[28px] text-[#002B8F] tracking-tight">{formatRp(totalTagihan)}</span>
              </div>
            </div>
          </div>

          {/* Preview Nota in Detail - larger, exact format for PDF capture */}
          <div className="pt-4 border-t border-slate-100">
            <div className="text-sm font-bold text-slate-600 mb-2">Format Nota (untuk cetak, match preview form)</div>
            <div className="flex justify-center bg-gray-50 p-3 rounded">
              <div id="nota-preview-detail" className="bg-white border-2 border-gray-500 p-3 text-[9px] leading-snug shadow-md" style={{width: '620px', fontFamily: 'system-ui, sans-serif'}}>
                <div className="flex justify-between items-start border-b border-gray-300 pb-1 mb-1">
                  <div className="text-left">
                    <div className="text-[14px] font-bold tracking-wider" style={{fontFamily: 'Georgia, serif'}}>HL Finance</div>
                    <div className="text-[7px] text-gray-600">Manajemen Penjualan & Piutang Internal</div>
                  </div>
                  <div className="border border-gray-500 p-1 text-[7px] w-36 leading-tight bg-gray-50">
                    Tanggal : {selectedBon.tanggal}<br/>
                    Kepada Yth : {selectedBon.customerName}
                  </div>
                </div>
                <div className="text-[8px] font-mono mb-1">Nota No. : {selectedBon.nomor_bon}</div>
                <table className="w-full border-2 border-gray-700 text-[8px]">
                  <thead>
                    <tr className="bg-gray-900 text-white">
                      <th className="border border-gray-700 p-1 text-center w-14 font-bold">Banyaknya</th>
                      <th className="border border-gray-700 p-1 font-bold">Nama Produk/Treatment</th>
                      <th className="border border-gray-700 p-1 text-right w-16 font-bold">@ Harga</th>
                      <th className="border border-gray-700 p-1 text-right w-16 font-bold">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedBon.lines || []).map((l, idx) => (
                      <tr key={idx} className="even:bg-gray-50">
                        <td className="border border-gray-700 text-center p-1 font-medium">{l.qty}</td>
                        <td className="border border-gray-700 p-1">{l.productName}</td>
                        <td className="border border-gray-700 text-right p-1 font-mono">{formatRp(l.harga_final)}</td>
                        <td className="border border-gray-700 text-right p-1 font-mono font-bold">{formatRp(l.harga_final * l.qty)}</td>
                      </tr>
                    ))}
                    {selectedBon.ongkir > 0 && (
                      <tr>
                        <td className="border border-gray-700 text-center p-1">1</td>
                        <td className="border border-gray-700 p-1">Ongkos Kirim (pass-through)</td>
                        <td className="border border-gray-700 text-right p-1 font-mono">{formatRp(selectedBon.ongkir)}</td>
                        <td className="border border-gray-700 text-right p-1 font-mono">{formatRp(selectedBon.ongkir)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="flex justify-between items-end mt-2 text-[8px]">
                  <div className="text-left">
                    Tanda Terima<br/>
                    <div className="border-b-2 border-gray-700 w-20 mt-1"></div>
                  </div>
                  <div className="text-left">
                    Kasir<br/>
                    <div className="border-b-2 border-gray-700 w-20 mt-1"></div>
                  </div>
                  <div className="border-2 border-gray-700 bg-gray-100 px-2 py-1 text-right text-[9px] font-black">
                    TOTAL<br/>{formatRp(selectedBon.omzet + selectedBon.ongkir)}
                  </div>
                </div>
                <div className="text-[6px] text-gray-500 text-right mt-1">Catatan: Barang yang sudah dibeli tidak dapat dikembalikan. Sistem HL Finance (Cash Basis).</div>
              </div>
            </div>
          </div>

          {/* Readonly disclaimer */}
          {isLunas && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-950">Transaksi ini sudah Lunas dan Terkunci</p>
                <p className="mt-0.5 leading-relaxed text-emerald-800">
                  Berdasarkan aturan bisnis, transaksi berstatus Lunas bersifat permanen dan tidak dapat diubah kembali (Read-Only) untuk menjaga akurasi laporan keuangan.
                </p>
              </div>
            </div>
          )}
          {isCancelled && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-slate-600 text-xs font-semibold">
              <XCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-slate-900">Transaksi ini Dibatalkan</p>
                <p className="mt-0.5 leading-relaxed text-slate-500">
                  Transaksi berstatus Cancelled disimpan untuk riwayat audit internal dan dikecualikan dari perhitungan Omzet dan Laba aktif.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  // ─── MAIN RENDER ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {(viewMode === 'add' || viewMode === 'edit') 
        ? renderForm() 
        : selectedBon 
          ? renderDetail() 
          : renderList()}

      {/* Settle Date Modal */}
      {settleTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <Check size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Konfirmasi Pelunasan</h3>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="settle-date-input" className="block text-sm font-bold text-slate-600">
                Pilih Tanggal Pembayaran/Pelunasan
              </label>
              <input
                id="settle-date-input"
                type="date"
                value={settleDate}
                max={todayDateStr}
                onChange={e => setSettleDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                style={{ minHeight: '44px' }}
              />
              <p className="text-xs text-slate-400">
                Omzet, laba, dan akumulasi bonus akan diakui terhitung pada tanggal pelunasan ini (Cash Basis).
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                onClick={() => setSettleTargetId(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 hover:text-slate-800 font-bold rounded-xl text-sm"
              >
                Batal
              </button>
              <button 
                onClick={confirmSettle}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm"
              >
                Lunasi Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Batalkan Transaksi?</h3>
            </div>
            
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin membatalkan Bon ini? Transaksi yang dibatalkan tidak akan dihitung ke omzet atau piutang, dan statusnya menjadi permanen **Batal (Cancelled)**.
            </p>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                onClick={() => setCancelTargetId(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 hover:text-slate-800 font-bold rounded-xl text-sm"
              >
                Kembali
              </button>
              <button 
                onClick={confirmCancel}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Hapus Transaksi?</h3>
            </div>
            
            <p className="text-sm font-medium text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus Bon ini secara permanen dari database? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 hover:text-slate-800 font-bold rounded-xl text-sm"
              >
                Batal
              </button>
              <button 
                onClick={confirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast message */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#002B8F] text-white px-5 py-3 rounded-xl shadow-2xl font-bold text-sm">
          <CheckCircle2 size={18} className="shrink-0" />
          {toastMsg}
        </div>
      )}
    </div>
  );
}
