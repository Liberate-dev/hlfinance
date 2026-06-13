import type { BonPdfInput } from '../lib/bonPdf';
import { formatDateDisplay, formatRpDisplay } from '../lib/bonPdf';

interface BonNotaPreviewProps {
  data: BonPdfInput;
}

function statusBadge(status: BonPdfInput['status']) {
  if (status === 'Lunas') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'Cancelled') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-amber-100 text-amber-900 border-amber-200';
}

function statusText(status: BonPdfInput['status']) {
  if (status === 'Lunas') return 'LUNAS';
  if (status === 'Cancelled') return 'DIBATALKAN';
  return 'PIUTANG (OPEN)';
}

export default function BonNotaPreview({ data }: BonNotaPreviewProps) {
  const grandTotal = data.omzet + data.ongkir;

  return (
    <div className="w-full max-w-[720px] mx-auto bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden text-slate-800">
      <div className="bg-[#002B8F] text-white px-6 py-4 flex justify-between items-start gap-4">
        <div>
          <div className="text-xl font-extrabold tracking-tight">HL FINANCE</div>
          <div className="text-[11px] text-blue-100 mt-0.5">Manajemen Penjualan & Piutang</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold uppercase tracking-wider">Nota Penjualan</div>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border-b border-slate-200 text-sm">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">Nomor Bon</div>
          <div className="font-mono font-bold text-slate-900 mt-0.5">{data.nomor_bon || '—'}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">Tanggal</div>
          <div className="font-semibold mt-0.5">{formatDateDisplay(data.tanggal)}</div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase">Status</div>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${statusBadge(data.status)}`}>
            {statusText(data.status)}
          </span>
        </div>
      </div>

      <div className="px-6 py-4 border-b border-slate-100">
        <div className="text-[10px] font-bold text-slate-400 uppercase">Kepada Yth.</div>
        <div className="text-lg font-extrabold text-[#002B8F] mt-1">{data.customerName || '—'}</div>
        {data.customerAlamat && (
          <div className="text-sm text-slate-500 mt-1">{data.customerAlamat}</div>
        )}
        {data.is_bonus && (
          <div className="text-xs font-bold text-amber-700 mt-2">
            Bon Bonus — {data.bonus_count || 1} jatah (produk gratis)
          </div>
        )}
      </div>

      <div className="px-6 py-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#002B8F] text-white text-[11px] uppercase">
              <th className="p-2 text-left w-8">No</th>
              <th className="p-2 text-left">Nama Produk</th>
              <th className="p-2 text-center w-12">Tipe</th>
              <th className="p-2 text-center w-10">Qty</th>
              <th className="p-2 text-right w-28">Harga Satuan</th>
              <th className="p-2 text-right w-28">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line, idx) => (
              <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                <td className="p-2 border-b border-slate-100">{idx + 1}</td>
                <td className="p-2 border-b border-slate-100 font-medium">{line.productName}</td>
                <td className="p-2 border-b border-slate-100 text-center font-bold text-xs">{line.tipe}</td>
                <td className="p-2 border-b border-slate-100 text-center">{line.qty}</td>
                <td className="p-2 border-b border-slate-100 text-right font-mono text-xs">{formatRpDisplay(line.harga_final_unit)}</td>
                <td className="p-2 border-b border-slate-100 text-right font-mono font-bold text-xs">
                  {formatRpDisplay(line.harga_final_unit * line.qty)}
                </td>
              </tr>
            ))}
            {data.ongkir > 0 && (
              <tr className="bg-slate-50">
                <td className="p-2 border-b border-slate-100">{data.lines.length + 1}</td>
                <td className="p-2 border-b border-slate-100 font-medium">Ongkos Kirim</td>
                <td className="p-2 border-b border-slate-100 text-center">—</td>
                <td className="p-2 border-b border-slate-100 text-center">1</td>
                <td className="p-2 border-b border-slate-100 text-right font-mono text-xs">{formatRpDisplay(data.ongkir)}</td>
                <td className="p-2 border-b border-slate-100 text-right font-mono font-bold text-xs">{formatRpDisplay(data.ongkir)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal Omzet</span>
              <span className="font-mono font-semibold">{formatRpDisplay(data.omzet)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Ongkos Kirim</span>
              <span className="font-mono font-semibold">{formatRpDisplay(data.ongkir)}</span>
            </div>
            <div className="flex justify-between items-center bg-[#002B8F] text-white rounded-lg px-3 py-2 font-bold">
              <span>TOTAL TAGIHAN</span>
              <span className="font-mono text-base">{formatRpDisplay(grandTotal)}</span>
            </div>
          </div>
        </div>

        {data.deskripsi?.trim() && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
            <span className="font-bold text-slate-500">Catatan: </span>
            <span className="text-slate-700">{data.deskripsi}</span>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-slate-500">
          <div>
            <div className="font-semibold">Penerima,</div>
            <div className="border-b border-slate-300 mt-10 mb-1" />
            <div>( tanda tangan )</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">Hormat Kami,</div>
            <div className="border-b border-slate-300 mt-10 mb-1" />
            <div>HL Finance</div>
          </div>
        </div>
      </div>
    </div>
  );
}