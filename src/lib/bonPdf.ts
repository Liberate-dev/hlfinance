import jsPDF from 'jspdf';
import type { Bon } from '../store/useStore';

const BRAND = { r: 0, g: 43, b: 143 };
const MARGIN = 15;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const ROW_H = 7;

export interface BonPdfInput {
  nomor_bon: string;
  tanggal: string;
  customerName: string;
  customerAlamat?: string;
  status: 'Open' | 'Lunas' | 'Cancelled';
  tanggal_lunas?: string;
  is_bonus?: boolean;
  bonus_count?: number;
  deskripsi?: string;
  ongkir: number;
  omzet: number;
  lines: {
    productName: string;
    tipe: 'LM' | 'BR';
    qty: number;
    harga_final_unit: number;
  }[];
}

function formatRpPdf(n: number): string {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

function formatDatePdf(dateStr?: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

function statusLabel(status: BonPdfInput['status']): string {
  if (status === 'Lunas') return 'LUNAS';
  if (status === 'Cancelled') return 'DIBATALKAN';
  return 'PIUTANG';
}

export function bonToPdfInput(bon: Bon, customerAlamat?: string): BonPdfInput {
  return {
    nomor_bon: bon.nomor_bon,
    tanggal: bon.tanggal,
    customerName: bon.customerName,
    customerAlamat,
    status: bon.status,
    tanggal_lunas: bon.tanggal_lunas,
    is_bonus: bon.is_bonus,
    bonus_count: bon.bonus_count,
    deskripsi: bon.deskripsi,
    ongkir: bon.ongkir,
    omzet: bon.omzet,
    lines: bon.lines.map((l) => ({
      productName: l.productName,
      tipe: l.tipe_snapshot || l.tipe,
      qty: l.qty,
      harga_final_unit: l.harga_final_unit ?? l.harga_final,
    })),
  };
}

function drawTableHeader(doc: jsPDF, y: number): number {
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('NO', MARGIN + 2, y + 4.8);
  doc.text('NAMA PRODUK', MARGIN + 12, y + 4.8);
  doc.text('TIPE', MARGIN + 88, y + 4.8);
  doc.text('QTY', MARGIN + 100, y + 4.8);
  doc.text('HARGA SATUAN', MARGIN + 112, y + 4.8);
  doc.text('JUMLAH', MARGIN + 158, y + 4.8);
  return y + ROW_H;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 265) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export function generateBonPdf(data: BonPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 0;

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, PAGE_W, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('HL FINANCE', MARGIN, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Manajemen Penjualan & Piutang', MARGIN, 17);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NOTA PENJUALAN', PAGE_W - MARGIN, 12, { align: 'right' });

  y = 34;

  doc.setDrawColor(210, 214, 220);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(MARGIN, y, CONTENT_W, 20, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('NOMOR BON', MARGIN + 4, y + 6);
  doc.text('TANGGAL', MARGIN + 72, y + 6);
  doc.text('STATUS', MARGIN + 128, y + 6);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(data.nomor_bon, MARGIN + 4, y + 12);
  doc.text(formatDatePdf(data.tanggal), MARGIN + 72, y + 12);
  doc.text(statusLabel(data.status), MARGIN + 128, y + 12);

  if (data.status === 'Lunas' && data.tanggal_lunas) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Tgl. pelunasan: ${formatDatePdf(data.tanggal_lunas)}`, MARGIN + 72, y + 17);
  }

  y += 28;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('KEPADA YTH.', MARGIN, y);
  y += 5;
  doc.setFontSize(12);
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text(data.customerName, MARGIN, y);
  y += 5;

  if (data.customerAlamat) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const addr = doc.splitTextToSize(data.customerAlamat, CONTENT_W);
    doc.text(addr, MARGIN, y);
    y += addr.length * 4.2;
  }

  if (data.is_bonus) {
    y += 2;
    doc.setFontSize(8);
    doc.setTextColor(161, 98, 7);
    doc.text(`Bon Bonus — ${data.bonus_count || 1} jatah (produk gratis)`, MARGIN, y);
    y += 5;
  }

  y += 4;
  y = drawTableHeader(doc, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  data.lines.forEach((line, idx) => {
    y = ensureSpace(doc, y, ROW_H + 2);
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, y + ROW_H, MARGIN + CONTENT_W, y + ROW_H);

    const subtotal = line.harga_final_unit * line.qty;
    doc.setFontSize(8);
    doc.text(String(idx + 1), MARGIN + 2, y + 4.8);
    doc.text(doc.splitTextToSize(line.productName, 72)[0] || line.productName, MARGIN + 12, y + 4.8);
    doc.text(line.tipe, MARGIN + 88, y + 4.8);
    doc.text(String(line.qty), MARGIN + 100, y + 4.8);
    doc.text(formatRpPdf(line.harga_final_unit), MARGIN + 112, y + 4.8);
    doc.text(formatRpPdf(subtotal), MARGIN + 158, y + 4.8);
    y += ROW_H;
  });

  if (data.ongkir > 0) {
    y = ensureSpace(doc, y, ROW_H + 2);
    doc.setFillColor(248, 250, 252);
    doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
    doc.line(MARGIN, y + ROW_H, MARGIN + CONTENT_W, y + ROW_H);
    doc.text(String(data.lines.length + 1), MARGIN + 2, y + 4.8);
    doc.text('Ongkos Kirim', MARGIN + 12, y + 4.8);
    doc.text('—', MARGIN + 88, y + 4.8);
    doc.text('1', MARGIN + 100, y + 4.8);
    doc.text(formatRpPdf(data.ongkir), MARGIN + 112, y + 4.8);
    doc.text(formatRpPdf(data.ongkir), MARGIN + 158, y + 4.8);
    y += ROW_H;
  }

  y += 6;
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 95, y, PAGE_W - MARGIN, y);
  y += 8;

  const labelX = MARGIN + 100;
  const valueX = PAGE_W - MARGIN;
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal Omzet', labelX, y);
  doc.text(formatRpPdf(data.omzet), valueX, y, { align: 'right' });
  y += 6;
  doc.text('Ongkos Kirim', labelX, y);
  doc.text(formatRpPdf(data.ongkir), valueX, y, { align: 'right' });
  y += 8;

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.roundedRect(labelX - 3, y - 4, PAGE_W - MARGIN - labelX + 3, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL TAGIHAN', labelX, y + 2.5);
  doc.text(formatRpPdf(data.omzet + data.ongkir), valueX, y + 2.5, { align: 'right' });
  y += 18;

  if (data.deskripsi?.trim()) {
    y = ensureSpace(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Catatan:', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    const notes = doc.splitTextToSize(data.deskripsi.trim(), CONTENT_W - 18);
    doc.text(notes, MARGIN + 16, y);
    y += notes.length * 4 + 8;
  }

  const sigY = Math.max(y + 10, 235);
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Penerima,', MARGIN, sigY);
  doc.text('Hormat Kami,', PAGE_W - MARGIN - 45, sigY);
  doc.setDrawColor(148, 163, 184);
  doc.line(MARGIN, sigY + 16, MARGIN + 55, sigY + 16);
  doc.line(PAGE_W - MARGIN - 55, sigY + 16, PAGE_W - MARGIN, sigY + 16);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('( tanda tangan )', MARGIN, sigY + 20);
  doc.text('HL Finance', PAGE_W - MARGIN - 55, sigY + 20);

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Dokumen sah — HL Finance · Cash Basis · Tanpa PPN',
    PAGE_W / 2,
    287,
    { align: 'center' }
  );

  return doc;
}

export function downloadBonPdf(data: BonPdfInput): void {
  const safeName = data.nomor_bon.replace(/[^A-Za-z0-9_-]+/g, '-');
  generateBonPdf(data).save(`Bon-${safeName}.pdf`);
}

export function formatRpDisplay(n: number): string {
  return formatRpPdf(n);
}

export function formatDateDisplay(dateStr?: string): string {
  return formatDatePdf(dateStr);
}