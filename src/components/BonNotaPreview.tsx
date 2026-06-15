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
  return 'PIUTANG';
}

function LineRow({
  no,
  name,
  tipe,
  qty,
  unitPrice,
  lineTotal,
  shaded,
}: {
  no: number;
  name: string;
  tipe: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  shaded?: boolean;
}) {
  return (
    <tr className={shaded ? 'bg-slate-50' : ''}>
      <td className="p-2 border-b border-slate-100">{no}</td>
      <td className="p-2 border-b border-slate-100 font-medium">{name}</td>
      <td className="p-2 border-b border-slate-100 text-center font-bold text-xs">{tipe}</td>
      <td className="p-2 border-b border-slate-100 text-center">{qty}</td>
      <td className="p-2 border-b border-slate-100 text-right font-mono text-xs whitespace-nowrap">
        {formatRpDisplay(unitPrice)}
      </td>
      <td className="p-2 border-b border-slate-100 text-right font-mono font-bold text-xs whitespace-nowrap">
        {formatRpDisplay(lineTotal)}
      </td>
    </tr>
  );
}

function LineCard({
  no,
  name,
  tipe,
  qty,
  unitPrice,
  lineTotal,
}: {
  no: number;
  name: string;
  tipe: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}) {
  return (
    <div className="border-2 border-slate-200 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="text-xs font-bold text-slate-400 uppercase">Baris {no}</span>
          <p className="font-bold text-slate-900 text-base mt-1 leading-snug break-words">{name}</p>
        </div>
        <span className="shrink-0 bg-blue-50 text-[#002B8F] text-xs font-black px-2.5 py-1 rounded-lg border border-blue-200">
          {tipe}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase">Qty</p>
          <p className="font-black text-slate-900 text-lg mt-0.5">{qty}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase">Harga Satuan</p>
          <p className="font-mono font-bold text-slate-800 text-sm mt-0.5 leading-tight">{formatRpDisplay(unitPrice)}</p>
        </div>
        <div className="col-span-2 pt-1 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-500 uppercase">Jumlah</p>
          <p className="font-mono font-black text-[#002B8F] text-lg mt-0.5">{formatRpDisplay(lineTotal)}</p>
        </div>
      </div>
    </div>
  );
}

export default function BonNotaPreview({ data }: BonNotaPreviewProps) {
  const grandTotal = data.omzet + data.ongkir;

  return (
    <div className="w-full max-w-[720px] mx-auto bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden text-slate-800">
      <div className="bg-[#002B8F] text-white px-4 sm:px-6 py-4 flex justify-between items-start gap-4">
        <div>
          <div className="text-xl font-extrabold tracking-tight">HL FINANCE</div>
          <div className="text-[11px] text-blue-100 mt-0.5">Manajemen Penjualan & Piutang</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold uppercase tracking-wider">Nota Penjualan</div>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 border-b border-slate-200 text-sm">
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

      <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
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

      <div className="px-4 sm:px-6 py-4">
        {/* Mobile: kartu per baris agar tidak terpotong */}
        <div className="md:hidden space-y-3">
          {data.lines.map((line, idx) => (
            <LineCard
              key={idx}
              no={idx + 1}
              name={line.productName}
              tipe={line.tipe}
              qty={line.qty}
              unitPrice={line.harga_final_unit}
              lineTotal={line.harga_final_unit * line.qty}
            />
          ))}
          {data.ongkir > 0 && (
            <LineCard
              no={data.lines.length + 1}
              name="Ongkos Kirim"
              tipe="—"
              qty={1}
              unitPrice={data.ongkir}
              lineTotal={data.ongkir}
            />
          )}
        </div>

        {/* Desktop: tabel lengkap */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[520px]">
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
                <LineRow
                  key={idx}
                  no={idx + 1}
                  name={line.productName}
                  tipe={line.tipe}
                  qty={line.qty}
                  unitPrice={line.harga_final_unit}
                  lineTotal={line.harga_final_unit * line.qty}
                  shaded={idx % 2 === 1}
                />
              ))}
              {data.ongkir > 0 && (
                <LineRow
                  no={data.lines.length + 1}
                  name="Ongkos Kirim"
                  tipe="—"
                  qty={1}
                  unitPrice={data.ongkir}
                  lineTotal={data.ongkir}
                  shaded
                />
              )}
            </tbody>
          </table>
        </div>

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

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 text-xs text-slate-500">
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