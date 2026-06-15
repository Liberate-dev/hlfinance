import { supabase } from './supabase';
import {
  computeCustomerStats,
  mapBon,
  mapCustomer,
  mapLine,
  mapProduct,
} from './mappers';
import type { Bon, BonLine, Customer, Produk } from '../store/useStore';

export type DataBundle = {
  customers: Customer[];
  products: Produk[];
  transactions: Bon[];
};

export async function fetchAllData(): Promise<{ data?: DataBundle; error?: string }> {
  const [custRes, prodRes, txRes, lineRes] = await Promise.all([
    supabase.from('customers').select('*').order('nama'),
    supabase.from('products').select('*').order('nama'),
    supabase
      .from('transactions')
      .select('*, customers(nama)')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('transaction_lines')
      .select('*, products(nama)'),
  ]);

  if (custRes.error) return { error: custRes.error.message };
  if (prodRes.error) return { error: prodRes.error.message };
  if (txRes.error) return { error: txRes.error.message };
  if (lineRes.error) return { error: lineRes.error.message };

  const linesByTx = new Map<string, BonLine[]>();
  for (const row of lineRes.data ?? []) {
    const mapped = mapLine(row);
    const existing = linesByTx.get(row.transaction_id) ?? [];
    existing.push(mapped);
    linesByTx.set(row.transaction_id, existing);
  }

  const transactions = (txRes.data ?? []).map((tx) =>
    mapBon(tx, linesByTx.get(tx.id) ?? [])
  );

  const customers = (custRes.data ?? []).map((c) =>
    mapCustomer(c, computeCustomerStats(c.id, transactions))
  );

  return {
    data: {
      customers,
      products: (prodRes.data ?? []).map(mapProduct),
      transactions,
    },
  };
}

export async function insertCustomer(
  input: Omit<Customer, 'id' | 'accumulated_omzet' | 'bonus_claimed'>
): Promise<{ data?: Customer; error?: string }> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      kode: input.kode.trim(),
      nama: input.nama.trim(),
      diskon_lm: input.diskon_lm,
      diskon_br: input.diskon_br,
      threshold_bonus: input.threshold_bonus,
      telepon: input.telepon ?? null,
      alamat: input.alamat ?? null,
      deleted_at: null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: mapCustomer(data, { accumulated_omzet: 0, bonus_claimed: 0 }) };
}

export async function updateCustomerRow(
  customer: Customer
): Promise<{ data?: Customer; error?: string }> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      kode: customer.kode.trim(),
      nama: customer.nama.trim(),
      diskon_lm: customer.diskon_lm,
      diskon_br: customer.diskon_br,
      threshold_bonus: customer.threshold_bonus,
      telepon: customer.telepon ?? null,
      alamat: customer.alamat ?? null,
    })
    .eq('id', customer.id)
    .select()
    .single();

  if (error) return { error: error.message };
  return {
    data: mapCustomer(data, {
      accumulated_omzet: customer.accumulated_omzet,
      bonus_claimed: customer.bonus_claimed,
    }),
  };
}

export async function softDeleteCustomer(id: string): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('soft_delete_customer', { p_id: id });
  if (error) {
    return {
      error: isAdminMigrationMissingError(error.message)
        ? 'Migrasi aturan hapus belum dijalankan. Jalankan supabase/sql-editor/10_delete_rules.sql.'
        : error.message,
    };
  }
  const result = data as { success?: boolean; error?: string };
  if (!result?.success) {
    return { error: result?.error ?? 'Gagal menghapus pelanggan.' };
  }
  return {};
}

export async function insertProduct(
  input: Omit<Produk, 'id'>
): Promise<{ data?: Produk; error?: string }> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      kode: input.kode.trim(),
      nama: input.nama.trim(),
      tipe: input.tipe,
      harga_modal: input.harga_modal,
      harga_base: input.harga_base,
      deleted_at: null,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: mapProduct(data) };
}

export async function updateProductRow(
  product: Produk
): Promise<{ data?: Produk; error?: string }> {
  const { data, error } = await supabase
    .from('products')
    .update({
      kode: product.kode.trim(),
      nama: product.nama.trim(),
      tipe: product.tipe,
      harga_modal: product.harga_modal,
      harga_base: product.harga_base,
    })
    .eq('id', product.id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data: mapProduct(data) };
}

export async function softDeleteProduct(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  return error ? { error: error.message } : {};
}

function linesToRpcPayload(lines: BonLine[]) {
  return lines.map((l) => ({
    product_id: l.productId,
    qty: l.qty,
    line_id: l.line_id ?? undefined,
  }));
}

export async function createBon(bon: Bon): Promise<{ data?: Bon; error?: string }> {
  const { data, error } = await supabase.rpc('create_bon', {
    p_nomor_bon: bon.nomor_bon,
    p_tanggal: bon.tanggal,
    p_customer_id: bon.customer_id,
    p_ongkir: bon.ongkir,
    p_deskripsi: bon.deskripsi ?? null,
    p_is_bonus: bon.is_bonus ?? false,
    p_bonus_count: bon.bonus_count ?? 0,
    p_status: bon.status,
    p_lines: linesToRpcPayload(bon.lines),
  });

  if (error) return { error: error.message };

  const bundle = await fetchAllData();
  if (bundle.error) return { error: bundle.error };
  const created = bundle.data!.transactions.find((t) => t.id === data.id);
  return created ? { data: created } : { error: 'Bon dibuat tetapi tidak ditemukan.' };
}

export async function updateBonOpen(bon: Bon): Promise<{ data?: Bon; error?: string }> {
  const { data, error } = await supabase.rpc('update_bon_open', {
    p_transaction_id: bon.id,
    p_nomor_bon: bon.nomor_bon,
    p_tanggal: bon.tanggal,
    p_customer_id: bon.customer_id,
    p_ongkir: bon.ongkir,
    p_deskripsi: bon.deskripsi ?? null,
    p_status: bon.status,
    p_lines: linesToRpcPayload(bon.lines),
  });

  if (error) return { error: error.message };

  const bundle = await fetchAllData();
  if (bundle.error) return { error: bundle.error };
  const updated = bundle.data!.transactions.find((t) => t.id === data.id);
  return updated ? { data: updated } : { error: 'Bon diperbarui tetapi tidak ditemukan.' };
}

export async function cancelBon(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('cancel_bon', { p_transaction_id: id });
  return error ? { error: error.message } : {};
}

export async function deleteBonOpen(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('delete_bon_open', { p_transaction_id: id });
  return error ? { error: error.message } : {};
}

export async function settleBon(
  id: string,
  date: string
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('settle_bon', {
    p_transaction_id: id,
    p_date: date,
  });
  return error ? { error: error.message } : {};
}

export async function settleBonBulk(
  customerId: string,
  yearMonth: string,
  date: string
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('settle_bon_bulk', {
    p_customer_id: customerId,
    p_year_month: yearMonth,
    p_date: date,
  });
  return error ? { error: error.message } : {};
}

export async function checkLoginAllowed(email: string): Promise<{ allowed: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('check_login_allowed', { p_email: email });
  if (error) return { allowed: false, error: error.message };
  return { allowed: data?.allowed ?? true, error: data?.error };
}

export async function resetLoginAttempts(email: string): Promise<void> {
  await supabase.rpc('reset_login_attempts', { p_email: email });
}

export type AdminSettings = {
  recovery_clue: string;
  has_recovery_code: boolean;
};

const ADMIN_MIGRATION_HINT =
  'Migrasi admin belum dijalankan. Buka Supabase Dashboard → SQL Editor, lalu jalankan isi file supabase/sql-editor/08_admin_settings.sql.';

export function isAdminMigrationMissingError(message: string): boolean {
  return message.includes('schema cache') || message.includes('Could not find the function');
}

function formatAdminRpcError(message: string): string {
  return isAdminMigrationMissingError(message) ? ADMIN_MIGRATION_HINT : message;
}

export async function getRecoveryClue(): Promise<{ clue?: string; error?: string }> {
  const { data, error } = await supabase.rpc('get_recovery_clue');
  if (error) return { error: formatAdminRpcError(error.message) };
  return { clue: (data as string) ?? '' };
}

export async function getAdminSettings(): Promise<{ data?: AdminSettings; error?: string }> {
  const { data, error } = await supabase.rpc('get_admin_settings');
  if (error) return { error: formatAdminRpcError(error.message) };
  const row = data as { recovery_clue?: string; has_recovery_code?: boolean };
  return {
    data: {
      recovery_clue: row.recovery_clue ?? '',
      has_recovery_code: !!row.has_recovery_code,
    },
  };
}

export async function updateRecoverySettings(
  clue: string,
  code?: string
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('update_recovery_settings', {
    p_clue: clue,
    p_code: code?.trim() ? code.trim() : null,
  });
  return error ? { error: formatAdminRpcError(error.message) } : {};
}

export async function resetPasswordWithRecovery(
  code: string,
  newPassword: string
): Promise<{ email?: string; error?: string }> {
  const { data, error } = await supabase.rpc('reset_password_with_recovery', {
    p_code: code.trim(),
    p_new_password: newPassword,
  });
  if (error) return { error: formatAdminRpcError(error.message) };
  const result = data as { success?: boolean; email?: string; error?: string };
  if (!result?.success) return { error: result?.error ?? 'Gagal mereset kata sandi.' };
  return { email: result.email };
}

export async function restoreCustomer(id: string): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('restore_customer', { p_id: id });
  if (error) return { error: formatAdminRpcError(error.message) };
  const result = data as { success?: boolean; error?: string };
  if (!result?.success) return { error: result?.error ?? 'Gagal memulihkan pelanggan.' };
  return {};
}

export async function restoreProduct(id: string): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('restore_product', { p_id: id });
  if (error) return { error: formatAdminRpcError(error.message) };
  const result = data as { success?: boolean; error?: string };
  if (!result?.success) return { error: result?.error ?? 'Gagal memulihkan produk.' };
  return {};
}

export async function restoreTransaction(id: string): Promise<{ error?: string }> {
  const { data, error } = await supabase.rpc('restore_transaction', { p_id: id });
  if (error) return { error: formatAdminRpcError(error.message) };
  const result = data as { success?: boolean; error?: string };
  if (!result?.success) return { error: result?.error ?? 'Gagal memulihkan bon.' };
  return {};
}