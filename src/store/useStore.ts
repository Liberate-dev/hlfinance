import { create } from 'zustand';
import * as api from '../lib/dataService';

export interface Customer {
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
  deleted_at: string | null;
}

export interface Produk {
  id: string;
  kode: string;
  nama: string;
  tipe: 'LM' | 'BR';
  harga_modal: number;
  harga_base: number;
  deleted_at: string | null;
}

export interface BonLine {
  line_id?: string;
  productId?: string;
  productName: string;
  tipe: 'LM' | 'BR';
  tipe_snapshot: 'LM' | 'BR';
  qty: number;
  harga_base: number;
  harga_base_snapshot: number;
  diskon: number[];
  diskon_terapan_snapshot: number[];
  harga_final: number;
  harga_final_unit: number;
  harga_modal_snapshot: number;
}

export interface Bon {
  id: string;
  nomor_bon: string;
  tanggal: string;
  customer_id: string;
  customerName: string;
  ongkir: number;
  omzet: number;
  status: 'Open' | 'Lunas' | 'Cancelled';
  tanggal_lunas?: string;
  locked_at?: string;
  deskripsi?: string;
  is_bonus?: boolean;
  bonus_count?: number;
  lines: BonLine[];
}

interface StoreState {
  customers: Customer[];
  products: Produk[];
  transactions: Bon[];
  isLoading: boolean;
  isHydrated: boolean;
  dataError: string | null;

  fetchAllData: () => Promise<string | null>;
  refreshAfterMutation: () => Promise<string | null>;

  addCustomer: (customer: Omit<Customer, 'id' | 'accumulated_omzet' | 'bonus_claimed'>) => Promise<string | null>;
  updateCustomer: (customer: Customer) => Promise<string | null>;
  deleteCustomer: (id: string) => Promise<string | null>;

  addProduct: (product: Omit<Produk, 'id'>) => Promise<string | null>;
  updateProduct: (product: Produk) => Promise<string | null>;
  deleteProduct: (id: string) => Promise<string | null>;

  addTransaction: (transaction: Bon) => Promise<string | null>;
  updateTransaction: (transaction: Bon) => Promise<string | null>;
  cancelTransaction: (id: string) => Promise<string | null>;
  deleteTransaction: (id: string) => Promise<string | null>;
  settleTransaction: (id: string, date: string) => Promise<string | null>;
  settleBulkTransactions: (customerId: string, yearMonth: string, date: string) => Promise<string | null>;

  showAddCustomer: boolean;
  setShowAddCustomer: (show: boolean) => void;
}

async function reload(set: (fn: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) => void) {
  const result = await api.fetchAllData();
  if (result.error) {
    set({ dataError: result.error, isHydrated: true, isLoading: false });
    return result.error;
  }
  set({
    customers: result.data!.customers,
    products: result.data!.products,
    transactions: result.data!.transactions,
    dataError: null,
    isHydrated: true,
    isLoading: false,
  });
  return null;
}

export const useStore = create<StoreState>((set, get) => ({
  customers: [],
  products: [],
  transactions: [],
  isLoading: false,
  isHydrated: false,
  dataError: null,

  fetchAllData: async () => {
    set({ isLoading: true, dataError: null });
    return reload(set);
  },

  refreshAfterMutation: async () => reload(set),

  addCustomer: async (cust) => {
    const { error } = await api.insertCustomer(cust);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  updateCustomer: async (updated) => {
    const { error } = await api.updateCustomerRow(updated);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  deleteCustomer: async (id) => {
    const { error } = await api.softDeleteCustomer(id);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  addProduct: async (prod) => {
    const { error } = await api.insertProduct(prod);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  updateProduct: async (updated) => {
    const { error } = await api.updateProductRow(updated);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  deleteProduct: async (id) => {
    const { error } = await api.softDeleteProduct(id);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  addTransaction: async (tx) => {
    const { error } = await api.createBon(tx);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  updateTransaction: async (updated) => {
    const { error } = await api.updateBonOpen(updated);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  cancelTransaction: async (id) => {
    const { error } = await api.cancelBon(id);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  deleteTransaction: async (id) => {
    const tx = get().transactions.find((t) => t.id === id);
    if (tx && tx.status !== 'Open') return 'Hanya bon Open yang dapat dihapus.';
    const { error } = await api.deleteBonOpen(id);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  settleTransaction: async (id, date) => {
    const { error } = await api.settleBon(id, date);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  settleBulkTransactions: async (customerId, yearMonth, date) => {
    const { error } = await api.settleBonBulk(customerId, yearMonth, date);
    if (error) return error;
    return get().refreshAfterMutation();
  },

  showAddCustomer: false,
  setShowAddCustomer: (show) => set({ showAddCustomer: show }),
}));