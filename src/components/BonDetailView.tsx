import type { ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { Bon } from '../store/useStore';
import { bonToPdfInput } from '../lib/bonPdf';
import BonNotaPreview from './BonNotaPreview';

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

interface BonDetailViewProps {
  bon: Bon;
  customerAlamat?: string;
  footerActions?: ReactNode;
}

export default function BonDetailView({ bon, customerAlamat, footerActions }: BonDetailViewProps) {
  const isLunas = bon.status === 'Lunas';
  const isCancelled = bon.status === 'Cancelled';
  const totalTagihan = bon.omzet + bon.ongkir;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden p-6 md:p-8 space-y-6">
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
          <h2 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{bon.nomor_bon}</h2>
          <p className="text-sm font-semibold text-slate-500">
            Tanggal Dibuat: {formatDate(bon.tanggal)}
          </p>
          {isLunas && bon.tanggal_lunas && (
            <p className="text-sm font-bold text-emerald-700">
              Tanggal Pelunasan: {formatDate(bon.tanggal_lunas)}
            </p>
          )}
        </div>

        <div className="text-right space-y-1">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wide block">Pelanggan</span>
          <span className="text-xl font-extrabold text-slate-900 block">{bon.customerName}</span>
          {bon.is_bonus && (
            <span className="inline-block bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300 uppercase tracking-wider">
              🎁 Redempton Bonus ({bon.bonus_count || 1} Jatah)
            </span>
          )}
        </div>
      </div>

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
              {bon.lines.map((l, i) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        <div className="space-y-2">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wide block">Catatan Tambahan</span>
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-semibold text-slate-700 min-h-[80px]">
            {bon.deskripsi || 'Tidak ada catatan tambahan untuk transaksi ini.'}
          </div>
        </div>

        <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-5 space-y-3.5">
          <div className="flex justify-between items-center text-slate-700 text-[16px] font-bold">
            <span>Total Omzet Produk:</span>
            <span className="font-mono font-black text-slate-900 text-[18px]">{formatRp(bon.omzet)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-700 text-[16px] font-bold">
            <span>Biaya Kirim (Ongkir):</span>
            <span className="font-mono font-black text-slate-900 text-[18px]">{formatRp(bon.ongkir)}</span>
          </div>
          <div className="border-t-2 border-slate-200 pt-3.5 flex justify-between items-center text-slate-950 font-black">
            <span className="text-[18px]">Total Tagihan:</span>
            <span className="font-mono text-[28px] text-[#002B8F] tracking-tight">{formatRp(totalTagihan)}</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 space-y-3">
        <div className="text-sm font-bold text-slate-600">Nota Penjualan (format cetak)</div>
        <BonNotaPreview data={bonToPdfInput(bon, customerAlamat)} />
      </div>

      {footerActions}

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
              Bon batal tidak masuk omzet atau piutang. Jika perlu disembunyikan sepenuhnya, gunakan menu Pencatatan Bon untuk menghapus (bisa dipulihkan lewat Admin).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}