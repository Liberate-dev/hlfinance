import { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Plus,
  Pencil,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  PenLine,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produk {
  id: string;
  kode: string;
  nama: string;
  tipe: 'LM' | 'BR';
  harga_modal: number; // internal only — never shown to customer
  harga_base: number;
  deleted_at: string | null;
}

type ViewMode = 'list' | 'add' | 'edit';
type KodeMode = 'otomatis' | 'manual';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

const ITEMS_PER_PAGE = 20;

/** Generate next available code like LM-006 or BR-003 */
const generateKode = (tipe: 'LM' | 'BR', existing: Produk[]): string => {
  const prefix = tipe;
  const nums = existing
    .filter(p => p.kode.startsWith(prefix + '-') && p.deleted_at === null)
    .map(p => parseInt(p.kode.replace(prefix + '-', ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

/*
const MOCK_PRODUK: Produk[] = [
  { id: 'p-1',  kode: 'LM-001', nama: 'Antam Logam Mulia 10g',      tipe: 'LM', harga_modal: 9800000,   harga_base: 11500000,  deleted_at: null },
  { id: 'p-2',  kode: 'BR-001', nama: 'Cincin Berlian Klasik 2g',   tipe: 'BR', harga_modal: 3200000,   harga_base: 4250000,   deleted_at: null },
  { id: 'p-3',  kode: 'BR-002', nama: 'Kalung Rantai Hong Kong 5g', tipe: 'BR', harga_modal: 5500000,   harga_base: 6800000,   deleted_at: null },
  { id: 'p-4',  kode: 'LM-002', nama: 'Antam Logam Mulia 25g',      tipe: 'LM', harga_modal: 24000000,  harga_base: 28500000,  deleted_at: null },
  { id: 'p-5',  kode: 'LM-003', nama: 'Antam Logam Mulia 50g',      tipe: 'LM', harga_modal: 47500000,  harga_base: 56000000,  deleted_at: null },
  { id: 'p-6',  kode: 'BR-003', nama: 'Gelang Emas 18K 5g',         tipe: 'BR', harga_modal: 4200000,   harga_base: 5500000,   deleted_at: null },
  { id: 'p-7',  kode: 'BR-004', nama: 'Anting Mutiara Premium',     tipe: 'BR', harga_modal: 1800000,   harga_base: 2400000,   deleted_at: null },
  { id: 'p-8',  kode: 'LM-004', nama: 'Antam Logam Mulia 5g',       tipe: 'LM', harga_modal: 5000000,   harga_base: 5900000,   deleted_at: null },
  { id: 'p-9',  kode: 'BR-005', nama: 'Cincin Polos Emas 22K',      tipe: 'BR', harga_modal: 2100000,   harga_base: 2800000,   deleted_at: null },
  { id: 'p-10', kode: 'LM-005', nama: 'Antam Logam Mulia 100g',     tipe: 'LM', harga_modal: 94000000,  harga_base: 110000000, deleted_at: null },
];
*/

import { useStore } from '../store/useStore';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProdukPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useStore();
  const produkList = products; // alias for compatibility
  const [searchQuery, setSearchQuery] = useState('');
  const [tipeFilter, setTipeFilter] = useState<'SEMUA' | 'LM' | 'BR'>('SEMUA');
  const [currentPage, setCurrentPage] = useState(1);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editTarget, setEditTarget] = useState<Produk | null>(null);

  // Form fields
  const [formNama, setFormNama] = useState('');
  const [formTipe, setFormTipe] = useState<'LM' | 'BR'>('LM');
  const [formHargaBase, setFormHargaBase] = useState(0);
  const [formHargaModal, setFormHargaModal] = useState(0);
  const [kodeMode, setKodeMode] = useState<KodeMode>('otomatis');
  const [formKodeManual, setFormKodeManual] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const activeProduk = produkList.filter(p => p.deleted_at === null);

  const filtered = activeProduk.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchSearch = p.nama.toLowerCase().includes(q) || p.kode.toLowerCase().includes(q);
    const matchTipe = tipeFilter === 'SEMUA' || p.tipe === tipeFilter;
    return matchSearch && matchTipe;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const countLM = activeProduk.filter(p => p.tipe === 'LM').length;
  const countBR = activeProduk.filter(p => p.tipe === 'BR').length;

  // Computed auto-kode (updates live as tipe changes)
  const autoKode = generateKode(formTipe, produkList);
  const effectiveKode = kodeMode === 'otomatis' ? autoKode : formKodeManual;

  // ── Open forms ────────────────────────────────────────────────────────────────

  const openAdd = () => {
    setFormNama('');
    setFormTipe('LM');
    setFormHargaBase(0);
    setFormHargaModal(0);
    setKodeMode('otomatis');
    setFormKodeManual('');
    setEditTarget(null);
    setViewMode('add');
  };

  const openEdit = (p: Produk) => {
    setFormNama(p.nama);
    setFormTipe(p.tipe);
    setFormHargaBase(p.harga_base);
    setFormHargaModal(p.harga_modal);
    setKodeMode('manual');
    setFormKodeManual(p.kode);
    setEditTarget(p);
    setViewMode('edit');
  };

  const backToList = () => { setViewMode('list'); setEditTarget(null); };

  // ── Validation ────────────────────────────────────────────────────────────────

  const validateForm = (isEdit: boolean): string | null => {
    const kode = effectiveKode.trim();
    if (!kode) return 'Kode produk wajib diisi.';
    if (kode.length > 10) return 'Kode produk terlalu panjang (maksimal 10 karakter).';
    if (!/^[a-zA-Z0-9-_]+$/.test(kode)) return 'Kode produk hanya boleh berisi huruf dan angka.';
    if (!formNama.trim()) return 'Nama produk wajib diisi.';
    if (formHargaBase < 0) return 'Harga jual tidak boleh negatif.';
    if (formHargaModal < 0) return 'Harga modal tidak boleh negatif.';
    const dup = activeProduk.some(p =>
      p.kode.toLowerCase() === kode.toLowerCase() && (!isEdit || p.id !== editTarget?.id)
    );
    if (dup) return `Kode "${kode}" sudah dipakai produk lain. Silakan pilih kode yang berbeda.`;
    return null;
  };

  // ── Save handlers ─────────────────────────────────────────────────────────────

  const handleSaveAdd = async () => {
    const err = validateForm(false);
    if (err) { alert(err); return; }
    const saveErr = await addProduct({
      kode: effectiveKode.trim(),
      nama: formNama.trim(),
      tipe: formTipe,
      harga_modal: formHargaModal,
      harga_base: formHargaBase,
      deleted_at: null,
    });
    if (saveErr) { alert(saveErr); return; }
    showSuccess(`Produk "${formNama.trim()}" berhasil ditambahkan!`);
    backToList();
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const err = validateForm(true);
    if (err) { alert(err); return; }
    const saveErr = await updateProduct({
      ...editTarget,
      kode: effectiveKode.trim(),
      nama: formNama.trim(),
      tipe: formTipe,
      harga_modal: formHargaModal,
      harga_base: formHargaBase
    });
    if (saveErr) { alert(saveErr); return; }
    showSuccess(`Produk "${formNama.trim()}" berhasil disimpan!`);
    backToList();
  };

  const handleSoftDelete = async (id: string) => {
    const err = await deleteProduct(id);
    if (err) { alert(err); return; }
    setConfirmDeleteId(null);
    showSuccess('Produk berhasil dihapus. Data transaksi lama tetap tersimpan.');
  };

  // When tipe changes in add mode, regenerate auto kode
  const handleTipeChange = (t: 'LM' | 'BR') => {
    setFormTipe(t);
  };

  // ─── FORM VIEW ────────────────────────────────────────────────────────────────

  const renderForm = () => (
    <div className="space-y-6 animate-fade-in">

      {/* ── Back ── */}
      <div className="flex items-center border-b border-slate-200 pb-4">
        <button
          onClick={backToList}
          className="flex items-center gap-2 text-slate-600 hover:text-[#002B8F] font-bold text-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={22} className="stroke-[2.5]" />
          <span>Kembali ke Daftar Produk</span>
        </button>
      </div>

      {/* ── Card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Card header */}
        <div className={`px-7 py-5 flex items-center gap-3 ${viewMode === 'add' ? 'bg-[#002B8F]' : 'bg-slate-700'}`}>
          {viewMode === 'add'
            ? <Plus size={28} className="text-white stroke-[2.5]" />
            : <Pencil size={28} className="text-white stroke-[2.5]" />}
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {viewMode === 'add' ? 'Tambah Produk Baru' : 'Ubah Data Produk'}
            </h2>
            <p className="text-white/80 font-medium text-sm mt-0.5">
              {viewMode === 'add' ? 'Isi detail produk di bawah ini untuk membuat produk baru' : `Mengubah: ${editTarget?.nama}`}
            </p>
          </div>
        </div>

        <div className="p-8 space-y-6">

          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Tipe Produk */}
            <div className="space-y-2">
              <label className="block text-base font-bold text-slate-700">
                Jenis / Tipe Produk
              </label>
              <p className="text-sm text-slate-500">
                Pilih jenis produk untuk menentukan penomoran kode otomatis dan kategori.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {(['LM', 'BR'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTipeChange(t)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-base font-extrabold transition-all cursor-pointer ${
                      formTipe === t
                        ? t === 'LM'
                          ? 'bg-[#002B8F] text-white border-[#002B8F] shadow-sm'
                          : 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                    style={{ minHeight: '52px' }}
                  >
                    <span>{t === 'LM' ? 'LM' : 'BR'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Kode Produk */}
            <div className="space-y-2">
              <label className="block text-base font-bold text-slate-700">
                Kode Produk
              </label>
              <div className="flex gap-2.5 mb-2">
                <button
                  type="button"
                  onClick={() => setKodeMode('otomatis')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                    kodeMode === 'otomatis'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Wand2 size={16} />
                  Otomatis
                </button>
                <button
                  type="button"
                  onClick={() => setKodeMode('manual')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                    kodeMode === 'manual'
                      ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <PenLine size={16} />
                  Isi sendiri
                </button>
              </div>

              {kodeMode === 'otomatis' ? (
                <div className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
                  <Wand2 size={24} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-blue-600 uppercase tracking-wide">Kode Otomatis</p>
                    <p className="text-xl font-bold text-[#002B8F] font-mono leading-none mt-0.5">{autoKode}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    id="kode-manual"
                    type="text"
                    maxLength={10}
                    placeholder={`Contoh: ${formTipe}-006`}
                    value={formKodeManual}
                    onChange={e => setFormKodeManual(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm font-mono"
                    style={{ minHeight: '48px' }}
                  />
                  <div className="flex justify-between items-center text-sm text-slate-500 font-medium px-1">
                    <span>Maksimal 10 karakter (huruf & angka)</span>
                    <span>{formKodeManual.length}/10</span>
                  </div>
                </div>
              )}
            </div>

            {/* Nama Produk */}
            <div className="space-y-2 md:col-span-2">
              <label htmlFor="prod-nama" className="block text-base font-bold text-slate-700">
                Nama Produk
              </label>
              <input
                id="prod-nama"
                type="text"
                placeholder="Contoh: Antam Logam Mulia 10g"
                value={formNama}
                onChange={e => setFormNama(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                style={{ minHeight: '48px' }}
              />
            </div>

            {/* Harga Jual */}
            <div className="space-y-2">
              <label htmlFor="prod-base" className="block text-base font-bold text-slate-700">
                Harga Jual ke Pelanggan (Rp)
              </label>
              <input
                id="prod-base"
                type="number"
                min={0}
                placeholder="0"
                value={formHargaBase || ''}
                onChange={e => setFormHargaBase(Math.max(0, Number(e.target.value)))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 focus:bg-white transition-all shadow-sm"
                style={{ minHeight: '48px' }}
              />
              {formHargaBase > 0 && (
                <p className="text-sm font-bold text-[#002B8F] px-1">{formatRp(formHargaBase)}</p>
              )}
            </div>

            {/* Harga Modal */}
            <div className="space-y-2">
              <label htmlFor="prod-modal" className="block text-base font-bold text-slate-700">
                Harga Modal / Biaya Beli (Rp) <span className="text-sm text-amber-600 font-semibold">(Rahasia)</span>
              </label>
              <input
                id="prod-modal"
                type="number"
                min={0}
                placeholder="0"
                value={formHargaModal || ''}
                onChange={e => setFormHargaModal(Math.max(0, Number(e.target.value)))}
                className="w-full px-4 py-3 bg-amber-50/50 border border-amber-200 rounded-xl text-base font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 focus:bg-white transition-all shadow-sm"
                style={{ minHeight: '48px' }}
              />
              {formHargaModal > 0 && (
                <p className="text-sm font-bold text-amber-700 px-1">{formatRp(formHargaModal)}</p>
              )}
            </div>

          </div>

          {/* Margin preview */}
          {formHargaBase > 0 && formHargaModal > 0 && (
            <div className={`p-4 rounded-xl border ${
              formHargaBase >= formHargaModal
                ? 'bg-emerald-50 border-emerald-100'
                : 'bg-rose-50 border-rose-100'
            }`}>
              <p className={`text-xs font-bold uppercase tracking-wide ${formHargaBase >= formHargaModal ? 'text-emerald-600' : 'text-rose-600'}`}>
                Estimasi Keuntungan Kotor per Unit
              </p>
              <p className={`text-lg font-extrabold mt-0.5 ${formHargaBase >= formHargaModal ? 'text-emerald-800' : 'text-rose-800'}`}>
                {formatRp(formHargaBase - formHargaModal)}
                <span className="text-sm font-bold ml-2">
                  ({formHargaBase > 0 ? (((formHargaBase - formHargaModal) / formHargaBase) * 100).toFixed(1) : 0}%)
                </span>
              </p>
            </div>
          )}

          {/* Ringkasan */}
          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Ringkasan Data Produk</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-sm">
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <span className="text-slate-400 font-semibold block">Kode</span>
                <span className="font-mono font-bold text-slate-800 block mt-0.5">{effectiveKode || '—'}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                <span className="text-slate-400 font-semibold block">Tipe</span>
                <span className={`font-bold block mt-0.5 ${formTipe === 'LM' ? 'text-[#002B8F]' : 'text-emerald-700'}`}>{formTipe}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 sm:col-span-2">
                <span className="text-slate-400 font-semibold block">Nama</span>
                <span className="font-bold text-slate-800 block mt-0.5 truncate">{formNama || '—'}</span>
              </div>
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-2.5 sm:col-span-2">
                <span className="text-blue-500 font-semibold block">Harga Jual</span>
                <span className="font-bold text-[#002B8F] block mt-0.5">{formHargaBase > 0 ? formatRp(formHargaBase) : '—'}</span>
              </div>
              <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 sm:col-span-2">
                <span className="text-amber-600 font-semibold block">Harga Modal (Rahasia)</span>
                <span className="font-bold text-amber-800 block mt-0.5">{formHargaModal > 0 ? formatRp(formHargaModal) : '—'}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={backToList}
              className="px-6 py-2.5 border border-slate-300 text-slate-600 hover:text-slate-800 font-bold rounded-xl text-base hover:bg-slate-50 transition-all cursor-pointer text-center"
              style={{ minHeight: '46px' }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={viewMode === 'add' ? handleSaveAdd : handleSaveEdit}
              className="px-8 py-2.5 bg-[#002B8F] hover:bg-[#001E66] text-white font-bold rounded-xl text-base shadow-sm hover:shadow transition-all cursor-pointer text-center"
              style={{ minHeight: '46px' }}
            >
              {viewMode === 'add' ? 'Tambah Produk' : 'Simpan Perubahan'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );

  // ─── LIST VIEW ────────────────────────────────────────────────────────────────

  const renderList = () => (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Produk</h1>
          <span className="bg-blue-50 text-[#002B8F] text-base font-extrabold px-3.5 py-1 rounded-full border border-blue-100">
            {activeProduk.length} Produk Aktif
          </span>
        </div>
        <div className="relative w-full sm:w-80 group">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 group-focus-within:text-[#002B8F] transition-colors">
            <Search size={20} />
          </span>
          <input
            type="text"
            placeholder="Cari nama atau kode produk..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-base font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#002B8F] focus:ring-2 focus:ring-[#002B8F]/10 transition-all"
            style={{ minHeight: '48px' }}
          />
        </div>
      </div>

      {/* Stats + Add button */}
      <div className="flex flex-col md:flex-row md:items-stretch gap-4">
        <div className="grid grid-cols-3 gap-4 flex-1">
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 flex flex-col justify-center">
            <p className="text-sm font-extrabold text-slate-400 uppercase tracking-wider">Total Produk</p>
            <p className="text-4xl font-black text-slate-900 mt-1">{activeProduk.length}</p>
          </div>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 flex flex-col justify-center">
            <p className="text-sm font-extrabold text-blue-500 uppercase tracking-wider">Tipe LM — Logam Mulia</p>
            <p className="text-4xl font-black text-[#002B8F] mt-1">{countLM}</p>
          </div>
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 flex flex-col justify-center">
            <p className="text-sm font-extrabold text-emerald-600 uppercase tracking-wider">Tipe BR — Barang</p>
            <p className="text-4xl font-black text-emerald-700 mt-1">{countBR}</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#002B8F] hover:bg-[#001E66] text-white font-extrabold text-base rounded-xl shadow-md transition-all cursor-pointer shrink-0"
          style={{ minHeight: '48px' }}
        >
          <Plus size={20} className="stroke-[2.5]" />
          <span>Tambah Produk Baru</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-3 flex-wrap">
        {(['SEMUA', 'LM', 'BR'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTipeFilter(t); setCurrentPage(1); }}
            className={`px-6 py-3 rounded-xl font-extrabold text-base border-2 transition-all cursor-pointer ${
              tipeFilter === t
                ? t === 'LM' ? 'bg-[#002B8F] text-white border-[#002B8F]'
                  : t === 'BR' ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
            style={{ minHeight: '48px' }}
          >
            {t === 'SEMUA' ? `Semua (${activeProduk.length})`
              : t === 'LM' ? `LM (${countLM})`
              : `BR (${countBR})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr>
                <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">Kode</th>
                <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">Nama Produk</th>
                <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">Jenis</th>
                <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider">Harga Jual</th>
                <th className="py-5 px-6 text-sm font-extrabold text-slate-500 uppercase tracking-wider text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.length > 0 ? paginated.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-5 px-6 font-mono font-bold text-base text-slate-600">{p.kode}</td>
                  <td className="py-5 px-6">
                    <span className="font-extrabold text-slate-900 text-lg">{p.nama}</span>
                  </td>
                  <td className="py-5 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-base font-black border-2 ${
                      p.tipe === 'LM'
                        ? 'bg-blue-50 text-[#002B8F] border-blue-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {p.tipe === 'LM' ? 'LM' : 'BR'}
                    </span>
                  </td>
                  <td className="py-5 px-6 font-extrabold text-[#002B8F] text-lg">
                    {formatRp(p.harga_base)}
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex items-center gap-2 px-5 py-3 border-2 border-slate-300 hover:border-[#002B8F] hover:bg-blue-50 text-slate-700 hover:text-[#002B8F] font-extrabold text-base rounded-xl transition-all cursor-pointer"
                        style={{ minHeight: '48px', minWidth: '100px' }}
                      >
                        <Pencil size={16} /> Ubah
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        className="flex items-center gap-2 px-5 py-3 border-2 border-rose-200 hover:bg-rose-50 text-rose-600 font-extrabold text-base rounded-xl transition-all cursor-pointer"
                        style={{ minHeight: '48px', minWidth: '100px' }}
                      >
                        <Trash2 size={16} /> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <Package size={56} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-xl font-extrabold text-slate-400">Tidak ada produk yang cocok.</p>
                    <p className="text-base font-semibold text-slate-300 mt-1">Coba ubah kata pencarian atau filter tipe.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="bg-slate-50 border-t-2 border-slate-200 p-5 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-base font-bold text-slate-600">
              Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} dari {filtered.length} produk
            </span>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}
                className="w-12 h-12 border-2 border-slate-200 bg-white rounded-xl font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center justify-center">
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))
                .map(pg => (
                  <button key={pg} onClick={() => setCurrentPage(pg)}
                    className={`w-12 h-12 font-extrabold rounded-xl flex items-center justify-center cursor-pointer ${
                      pg === currentPage ? 'bg-[#002B8F] text-white shadow-md' : 'border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}>
                    {pg}
                  </button>
                ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}
                className="w-12 h-12 border-2 border-slate-200 bg-white rounded-xl font-extrabold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer flex items-center justify-center">
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── DELETE MODAL ─────────────────────────────────────────────────────────────

  const renderDeleteModal = () => {
    const target = produkList.find(p => p.id === confirmDeleteId);
    if (!target) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-100 rounded-2xl shrink-0">
              <Trash2 size={32} className="text-rose-600" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">Hapus Produk?</h3>
              <p className="text-base font-semibold text-slate-500 mt-1">{target.kode} — {target.nama}</p>
            </div>
          </div>
          <div className="p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-lg font-extrabold text-amber-900">Apa yang terjadi setelah dihapus?</p>
              <p className="text-base font-semibold text-amber-800 leading-relaxed">
                Produk tidak bisa dipilih di transaksi baru.<br />
                Semua catatan transaksi lama <strong>tetap aman</strong> dan tidak berubah.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setConfirmDeleteId(null)}
              className="flex-1 py-4 border-2 border-slate-300 text-slate-700 font-extrabold rounded-2xl text-lg hover:bg-slate-100 cursor-pointer"
              style={{ minHeight: '56px' }}>
              Batal
            </button>
            <button onClick={() => handleSoftDelete(target.id)}
              className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl text-lg shadow-md cursor-pointer"
              style={{ minHeight: '56px' }}>
              Ya, Hapus
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── TOAST ────────────────────────────────────────────────────────────────────

  const renderToast = () => successMsg ? (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-700 text-white px-6 py-4 rounded-2xl shadow-2xl font-extrabold text-lg">
      <CheckCircle2 size={24} className="shrink-0" />
      {successMsg}
    </div>
  ) : null;

  // ─── MAIN ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {(viewMode === 'add' || viewMode === 'edit') ? renderForm() : renderList()}
      {confirmDeleteId && renderDeleteModal()}
      {renderToast()}
    </div>
  );
}
