import type { Bon, BonLine, Customer, Produk } from '../store/useStore';

type DbCustomer = {
  id: string;
  kode: string;
  nama: string;
  diskon_lm: number[];
  diskon_br: number[];
  threshold_bonus: number;
  telepon: string | null;
  alamat: string | null;
  deleted_at: string | null;
};

type DbProduct = {
  id: string;
  kode: string;
  nama: string;
  tipe: 'LM' | 'BR';
  harga_modal: number;
  harga_base: number;
  deleted_at: string | null;
};

type DbTransaction = {
  id: string;
  nomor_bon: string;
  tanggal: string;
  customer_id: string;
  ongkir: number;
  omzet: number;
  is_bonus: boolean;
  bonus_count: number;
  status: 'Open' | 'Lunas' | 'Cancelled';
  tanggal_lunas: string | null;
  locked_at: string | null;
  deskripsi: string | null;
  customers?: { nama: string } | { nama: string }[] | null;
};

type DbLine = {
  id: string;
  transaction_id: string;
  product_id: string | null;
  qty: number;
  tipe_snapshot: 'LM' | 'BR';
  harga_modal_snapshot: number;
  harga_base_snapshot: number;
  diskon_terapan_snapshot: number[];
  harga_final_unit: number;
  products?: { nama: string } | { nama: string }[] | null;
};

export function mapCustomer(row: DbCustomer, stats?: { accumulated_omzet: number; bonus_claimed: number }): Customer {
  return {
    id: row.id,
    kode: row.kode,
    nama: row.nama,
    diskon_lm: Array.isArray(row.diskon_lm) ? row.diskon_lm : [],
    diskon_br: Array.isArray(row.diskon_br) ? row.diskon_br : [],
    threshold_bonus: Number(row.threshold_bonus),
    telepon: row.telepon ?? undefined,
    alamat: row.alamat ?? undefined,
    deleted_at: row.deleted_at,
    accumulated_omzet: stats?.accumulated_omzet ?? 0,
    bonus_claimed: stats?.bonus_claimed ?? 0,
  };
}

export function mapProduct(row: DbProduct): Produk {
  return {
    id: row.id,
    kode: row.kode,
    nama: row.nama,
    tipe: row.tipe,
    harga_modal: Number(row.harga_modal),
    harga_base: Number(row.harga_base),
    deleted_at: row.deleted_at,
  };
}

function customerNameFromJoin(customers: DbTransaction['customers']): string {
  if (!customers) return '';
  if (Array.isArray(customers)) return customers[0]?.nama ?? '';
  return customers.nama ?? '';
}

function productNameFromJoin(products: DbLine['products']): string {
  if (!products) return '';
  if (Array.isArray(products)) return products[0]?.nama ?? '';
  return products.nama ?? '';
}

export function mapLine(row: DbLine): BonLine {
  const discounts = Array.isArray(row.diskon_terapan_snapshot) ? row.diskon_terapan_snapshot : [];
  const finalUnit = Number(row.harga_final_unit);
  return {
    line_id: row.id,
    productId: row.product_id ?? undefined,
    productName: productNameFromJoin(row.products),
    tipe: row.tipe_snapshot,
    tipe_snapshot: row.tipe_snapshot,
    qty: row.qty,
    harga_base: Number(row.harga_base_snapshot),
    harga_base_snapshot: Number(row.harga_base_snapshot),
    diskon: discounts,
    diskon_terapan_snapshot: discounts,
    harga_final: finalUnit,
    harga_final_unit: finalUnit,
    harga_modal_snapshot: Number(row.harga_modal_snapshot),
  };
}

export function mapBon(tx: DbTransaction, lines: BonLine[]): Bon {
  return {
    id: tx.id,
    nomor_bon: tx.nomor_bon,
    tanggal: tx.tanggal,
    customer_id: tx.customer_id,
    customerName: customerNameFromJoin(tx.customers),
    ongkir: Number(tx.ongkir),
    omzet: Number(tx.omzet),
    status: tx.status,
    tanggal_lunas: tx.tanggal_lunas ?? undefined,
    locked_at: tx.locked_at ?? undefined,
    deskripsi: tx.deskripsi ?? undefined,
    is_bonus: tx.is_bonus,
    bonus_count: tx.bonus_count > 0 ? tx.bonus_count : undefined,
    lines,
  };
}

export function computeCustomerStats(
  customerId: string,
  transactions: Bon[]
): { accumulated_omzet: number; bonus_claimed: number } {
  let accumulated_omzet = 0;
  let bonus_claimed = 0;
  for (const tx of transactions) {
    if (tx.customer_id !== customerId || tx.status !== 'Lunas') continue;
    accumulated_omzet += tx.omzet;
    if (tx.is_bonus) bonus_claimed += tx.bonus_count ?? 1;
  }
  return { accumulated_omzet, bonus_claimed };
}