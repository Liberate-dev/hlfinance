import { create } from 'zustand';

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
  harga_modal: number; // internal only
  harga_base: number;
  deleted_at: string | null;
}

export interface BonLine {
  productId?: string;
  productName: string;
  tipe: 'LM' | 'BR';
  qty: number;
  harga_base: number;
  diskon: number[];
  harga_final: number;
  harga_modal_snapshot?: number;
}

export interface Bon {
  id: string;
  nomor_bon: string;
  tanggal: string;
  customer_id: string;
  customerName: string;
  ongkir: number;
  omzet: number; // Σ (harga_final * qty)
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
  
  // Customer Actions
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;

  // Product Actions
  addProduct: (product: Produk) => void;
  updateProduct: (product: Produk) => void;
  deleteProduct: (id: string) => void;

  // Transaction Actions
  addTransaction: (transaction: Bon) => void;
  updateTransaction: (transaction: Bon) => void;
  cancelTransaction: (id: string) => void;
  deleteTransaction: (id: string) => void;
  settleTransaction: (id: string, date: string) => void;
  settleBulkTransactions: (customerId: string, yearMonth: string, date: string) => void;
}

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    kode: 'HL-C01',
    nama: 'Toko Jaya Abadi',
    diskon_lm: [20, 20, 10],
    diskon_br: [20],
    threshold_bonus: 10000000,
    accumulated_omzet: 25000000,
    bonus_claimed: 0,
    telepon: '0812-3456-7890',
    alamat: 'Jl. Melati No. 45, Jakarta Selatan',
    deleted_at: null
  },
  {
    id: 'cust-2',
    kode: 'HL-C02',
    nama: 'Maju Sejahtera CV',
    diskon_lm: [40],
    diskon_br: [30],
    threshold_bonus: 15000000,
    accumulated_omzet: 15000000,
    bonus_claimed: 1,
    telepon: '0821-9876-5432',
    alamat: 'Ruko Baru No. 88, Blok C, Tangerang',
    deleted_at: null
  },
  {
    id: 'cust-3',
    kode: 'HL-C03',
    nama: 'Bintang Pratama',
    diskon_lm: [30, 15],
    diskon_br: [25],
    threshold_bonus: 20000000,
    accumulated_omzet: 50000000,
    bonus_claimed: 0,
    telepon: '0813-1111-2222',
    alamat: 'Jl. Sudirman Kav. 21, Jakarta Pusat',
    deleted_at: null
  },
  {
    id: 'cust-4',
    kode: 'HL-C04',
    nama: 'Sumber Utama',
    diskon_lm: [40],
    diskon_br: [30],
    threshold_bonus: 10000000,
    accumulated_omzet: 8000000,
    bonus_claimed: 0,
    telepon: '0819-3333-4444',
    alamat: 'Jl. Industri Gg. 3 No. 12, Bekasi',
    deleted_at: null
  },
  {
    id: 'cust-5',
    kode: 'HL-C05',
    nama: 'Toko Berkah Mandiri',
    diskon_lm: [25, 10],
    diskon_br: [15],
    threshold_bonus: 12000000,
    accumulated_omzet: 30000000,
    bonus_claimed: 1,
    telepon: '0852-5555-6666',
    alamat: 'Jl. Pahlawan No. 7, Surabaya',
    deleted_at: null
  },
  {
    id: 'cust-6',
    kode: 'HL-C06',
    nama: 'Sinar Baru Retail',
    diskon_lm: [35],
    diskon_br: [20, 10],
    threshold_bonus: 10000000,
    accumulated_omzet: 5000000,
    bonus_claimed: 0,
    telepon: '0811-7777-8888',
    alamat: 'Komp. BSD Sektor 5, Serpong',
    deleted_at: null
  },
  {
    id: 'cust-7',
    kode: 'HL-8821',
    nama: 'Abadi Karoseri',
    diskon_lm: [20, 10],
    diskon_br: [15],
    threshold_bonus: 10000000,
    accumulated_omzet: 24500000,
    bonus_claimed: 0,
    telepon: '0812-8821-8821',
    alamat: 'Jl. Industri Abadi No. 12, Bekasi',
    deleted_at: null
  },
  {
    id: 'cust-8',
    kode: 'HL-9012',
    nama: 'Sentra Plastik',
    diskon_lm: [25],
    diskon_br: [20],
    threshold_bonus: 12000000,
    accumulated_omzet: 18200000,
    bonus_claimed: 0,
    telepon: '0813-9012-9012',
    alamat: 'Ruko Sentra Plastik Kav. 45, Tangerang',
    deleted_at: null
  },
  {
    id: 'cust-9',
    kode: 'HL-7723',
    nama: 'Mitra Sejahtera',
    diskon_lm: [30, 10],
    diskon_br: [25],
    threshold_bonus: 15000000,
    accumulated_omzet: 52900000,
    bonus_claimed: 0,
    telepon: '0815-7723-7723',
    alamat: 'Kawasan Industri Mitra C-10, Karawang',
    deleted_at: null
  }
];

const INITIAL_PRODUCTS: Produk[] = [
  { id: 'p-1',  kode: 'LM-001', nama: 'Antam Logam Mulia 10g',      tipe: 'LM', harga_modal: 9800000,   harga_base: 11500000,  deleted_at: null },
  { id: 'p-2',  kode: 'BR-001', nama: 'Cincin Berlian Klasik 2g',   tipe: 'BR', harga_modal: 3200000,   harga_base: 4250000,   deleted_at: null },
  { id: 'p-3',  kode: 'BR-002', nama: 'Kalung Rantai Hong Kong 5g', tipe: 'BR', harga_modal: 5500000,   harga_base: 6800000,   deleted_at: null },
  { id: 'p-4',  kode: 'LM-002', nama: 'Antam Logam Mulia 25g',      tipe: 'LM', harga_modal: 24000000,  harga_base: 28500000,  deleted_at: null },
  { id: 'p-5',  kode: 'LM-003', nama: 'Antam Logam Mulia 50g',      tipe: 'LM', harga_modal: 47500000,  harga_base: 56000000,  deleted_at: null },
  { id: 'p-6',  kode: 'BR-003', nama: 'Gelang Emas 18K 5g',         tipe: 'BR', harga_modal: 4200000,   harga_base: 5500000,   deleted_at: null },
  { id: 'p-7',  kode: 'BR-004', nama: 'Anting Mutiara Premium',     tipe: 'BR', harga_modal: 1800000,   harga_base: 2400000,   deleted_at: null },
  { id: 'p-8',  kode: 'LM-004', nama: 'Antam Logam Mulia 5g',       tipe: 'LM', harga_modal: 5000000,   harga_base: 5900000,   deleted_at: null },
  { id: 'p-9',  kode: 'BR-005', nama: 'Cincin Polos Emas 22K',      tipe: 'BR', harga_modal: 2100000,   harga_base: 2800000,   deleted_at: null },
  { id: 'p-10', kode: 'LM-005', nama: 'Antam Logam Mulia 100g',     tipe: 'LM', harga_modal: 94000000,  harga_base: 110000000, deleted_at: null }
];

const generateNov2024Mock = (): Bon[] => {
  const txs: Bon[] = [];
  
  // Abadi Karoseri (cust-7) - 12 Kali, total omzet 24.500.000, all Lunas
  const omz7 = 24500000;
  const baseOmz7 = Math.floor(omz7 / 12);
  for (let i = 1; i <= 12; i++) {
    const currentOmz = i === 12 ? omz7 - (baseOmz7 * 11) : baseOmz7;
    const modal = Math.round(currentOmz * 0.7);
    const day = String(i * 2).padStart(2, '0');
    txs.push({
      id: `bon-nov-7-${i}`,
      nomor_bon: `BON-2024-11-7-${i.toString().padStart(3, '0')}`,
      tanggal: `2024-11-${day}`,
      customer_id: 'cust-7',
      customerName: 'Abadi Karoseri',
      ongkir: 0,
      omzet: currentOmz,
      status: 'Lunas',
      tanggal_lunas: `2024-11-${day}`,
      locked_at: `2024-11-${day}T00:00:00.000Z`,
      lines: [
        { productId: 'p-1', productName: 'Antam Logam Mulia 10g', tipe: 'LM', qty: 1, harga_base: currentOmz, diskon: [], harga_final: currentOmz, harga_modal_snapshot: modal }
      ]
    });
  }

  // Sentra Plastik (cust-8) - 8 Kali, total omzet 18.200.000
  // Last transaction is Open (8.000.000 + 150.000 shipping = 8.150.000), others Lunas (10.200.000)
  const lunasOmz8 = 10200000;
  const baseOmz8 = Math.floor(lunasOmz8 / 7);
  for (let i = 1; i <= 7; i++) {
    const currentOmz = i === 7 ? lunasOmz8 - (baseOmz8 * 6) : baseOmz8;
    const modal = Math.round(currentOmz * 0.7);
    const day = String(i * 3).padStart(2, '0');
    txs.push({
      id: `bon-nov-8-${i}`,
      nomor_bon: `BON-2024-11-8-${i.toString().padStart(3, '0')}`,
      tanggal: `2024-11-${day}`,
      customer_id: 'cust-8',
      customerName: 'Sentra Plastik',
      ongkir: 0,
      omzet: currentOmz,
      status: 'Lunas',
      tanggal_lunas: `2024-11-${day}`,
      locked_at: `2024-11-${day}T00:00:00.000Z`,
      lines: [
        { productId: 'p-6', productName: 'Gelang Emas 18K 5g', tipe: 'BR', qty: 1, harga_base: currentOmz, diskon: [], harga_final: currentOmz, harga_modal_snapshot: modal }
      ]
    });
  }
  // Open transaction
  txs.push({
    id: `bon-nov-8-8`,
    nomor_bon: `BON-2024-11-8-008`,
    tanggal: '2024-11-28',
    customer_id: 'cust-8',
    customerName: 'Sentra Plastik',
    ongkir: 150000,
    omzet: 8000000,
    status: 'Open',
    lines: [
      { productId: 'p-2', productName: 'Cincin Berlian Klasik 2g', tipe: 'BR', qty: 1, harga_base: 8000000, diskon: [], harga_final: 8000000, harga_modal_snapshot: 5600000 }
    ]
  });

  // Mitra Sejahtera (cust-9) - 22 Kali, total omzet 52.900.000, all Lunas
  const omz9 = 52900000;
  const baseOmz9 = Math.floor(omz9 / 22);
  for (let i = 1; i <= 22; i++) {
    const currentOmz = i === 22 ? omz9 - (baseOmz9 * 21) : baseOmz9;
    const modal = Math.round(currentOmz * 0.7);
    const day = String(Math.min(30, Math.floor(i * 1.3) + 1)).padStart(2, '0');
    txs.push({
      id: `bon-nov-9-${i}`,
      nomor_bon: `BON-2024-11-9-${i.toString().padStart(3, '0')}`,
      tanggal: `2024-11-${day}`,
      customer_id: 'cust-9',
      customerName: 'Mitra Sejahtera',
      ongkir: 0,
      omzet: currentOmz,
      status: 'Lunas',
      tanggal_lunas: `2024-11-${day}`,
      locked_at: `2024-11-${day}T00:00:00.000Z`,
      lines: [
        { productId: 'p-4', productName: 'Antam Logam Mulia 25g', tipe: 'LM', qty: 1, harga_base: currentOmz, diskon: [], harga_final: currentOmz, harga_modal_snapshot: modal }
      ]
    });
  }

  // Fill the gap of 145.250.000 total Lunas omzet
  // 145.250.000 - 24.500.000 - 10.200.000 - 52.900.000 = 57.650.000 Lunas omzet
  // Laba total Nov 2024 should be 42.800.000.
  // Set modal snapshot such that: total omzet lunas (145.250.000) - total modal (102.450.000) = 42.800.000 laba.
  // Modals for cust-7 (17.150.000) + cust-8 (7.140.000) + cust-9 (37.030.000) = 61.320.000.
  // Modals for gap = 102.450.000 - 61.320.000 = 41.130.000.
  txs.push({
    id: 'bon-nov-gap-1',
    nomor_bon: 'BON-2024-11-GAP-001',
    tanggal: '2024-11-15',
    customer_id: 'cust-1',
    customerName: 'Warung Mak Ijah',
    ongkir: 0,
    omzet: 30000000,
    status: 'Lunas',
    tanggal_lunas: '2024-11-15',
    locked_at: '2024-11-15T00:00:00.000Z',
    lines: [
      { productId: 'p-5', productName: 'Antam Logam Mulia 50g', tipe: 'LM', qty: 1, harga_base: 30000000, diskon: [], harga_final: 30000000, harga_modal_snapshot: 21000000 }
    ]
  });

  txs.push({
    id: 'bon-nov-gap-2',
    nomor_bon: 'BON-2024-11-GAP-002',
    tanggal: '2024-11-20',
    customer_id: 'cust-1',
    customerName: 'Warung Mak Ijah',
    ongkir: 0,
    omzet: 27650000,
    status: 'Lunas',
    tanggal_lunas: '2024-11-20',
    locked_at: '2024-11-20T00:00:00.000Z',
    lines: [
      { productId: 'p-3', productName: 'Kalung Rantai Hong Kong 5g', tipe: 'BR', qty: 1, harga_base: 27650000, diskon: [], harga_final: 27650000, harga_modal_snapshot: 20130000 }
    ]
  });

  return txs;
};

const INITIAL_TRANSACTIONS: Bon[] = [
  ...generateNov2024Mock(),
  {
    id: 'bon-1',
    nomor_bon: 'BON-001/JA/06/26',
    tanggal: '2026-06-01',
    customer_id: 'cust-1',
    customerName: 'Toko Jaya Abadi',
    ongkir: 50000,
    omzet: 5456000, // calculated from line items: (1728000 * 2) + (400000 * 5)
    status: 'Open',
    lines: [
      { productId: 'p-1', productName: 'Antam Logam Mulia 10g', tipe: 'LM', qty: 2, harga_base: 3000000, diskon: [20, 20, 10], harga_final: 1728000, harga_modal_snapshot: 980000 },
      { productId: 'p-2', productName: 'Cincin Berlian Klasik 2g', tipe: 'BR', qty: 5, harga_base: 500000, diskon: [20], harga_final: 400000, harga_modal_snapshot: 320000 }
    ]
  },
  {
    id: 'bon-2',
    nomor_bon: 'BON-002/JA/06/26',
    tanggal: '2026-06-03',
    customer_id: 'cust-1',
    customerName: 'Toko Jaya Abadi',
    ongkir: 75000,
    omzet: 4416000, // (1152000 * 3) + (480000 * 2)
    status: 'Lunas',
    tanggal_lunas: '2026-06-05',
    locked_at: '2026-06-05T00:00:00.000Z',
    lines: [
      { productId: 'p-3', productName: 'Antam Logam Mulia 25g', tipe: 'LM', qty: 3, harga_base: 2000000, diskon: [20, 20, 10], harga_final: 1152000, harga_modal_snapshot: 1000000 },
      { productId: 'p-6', productName: 'Gelang Emas 18K 5g', tipe: 'BR', qty: 2, harga_base: 600000, diskon: [20], harga_final: 480000, harga_modal_snapshot: 420000 }
    ]
  },
  {
    id: 'bon-3',
    nomor_bon: 'BON-003/JA/06/26',
    tanggal: '2026-06-05',
    customer_id: 'cust-1',
    customerName: 'Toko Jaya Abadi',
    ongkir: 0,
    omzet: 2400000, // 480000 * 5
    status: 'Open',
    lines: [
      { productId: 'p-6', productName: 'Gelang Emas 18K 5g', tipe: 'BR', qty: 5, harga_base: 600000, diskon: [20], harga_final: 480000, harga_modal_snapshot: 420000 }
    ]
  },
  {
    id: 'bon-4',
    nomor_bon: 'BON-004/JA/06/26',
    tanggal: '2026-06-08',
    customer_id: 'cust-1',
    customerName: 'Toko Jaya Abadi',
    ongkir: 100000,
    omzet: 1728000,
    status: 'Cancelled',
    lines: [
      { productId: 'p-1', productName: 'Antam Logam Mulia 10g', tipe: 'LM', qty: 1, harga_base: 3000000, diskon: [20, 20, 10], harga_final: 1728000, harga_modal_snapshot: 980000 }
    ]
  },
  // Add some mock data to show exactly what's in the user's screenshot
  {
    id: 'bon-scr-1',
    nomor_bon: 'BON-2023-001',
    tanggal: '2023-10-24',
    customer_id: 'cust-5',
    customerName: 'Siti Aminah', // Add mock customer
    ongkir: 0,
    omzet: 1250000,
    status: 'Lunas',
    tanggal_lunas: '2023-10-24',
    locked_at: '2023-10-24T00:00:00.000Z',
    lines: [
      { productId: 'p-2', productName: 'Cincin Berlian Klasik 2g', tipe: 'BR', qty: 1, harga_base: 1250000, diskon: [], harga_final: 1250000, harga_modal_snapshot: 1000000 }
    ]
  },
  {
    id: 'bon-scr-2',
    nomor_bon: 'BON-2023-002',
    tanggal: '2023-10-23',
    customer_id: 'cust-4',
    customerName: 'Budi Santoso', // Add mock customer
    ongkir: 25000,
    omzet: 850000,
    status: 'Open',
    lines: [
      { productId: 'p-6', productName: 'Gelang Emas 18K 5g', tipe: 'BR', qty: 1, harga_base: 850000, diskon: [], harga_final: 850000, harga_modal_snapshot: 700000 }
    ]
  },
  {
    id: 'bon-scr-3',
    nomor_bon: 'BON-2023-003',
    tanggal: '2023-10-22',
    customer_id: 'cust-1',
    customerName: 'Warung Mak Ijah',
    ongkir: 50000,
    omzet: 3370000,
    status: 'Open',
    lines: [
      { productId: 'p-5', productName: 'Antam Logam Mulia 50g', tipe: 'LM', qty: 1, harga_base: 3370000, diskon: [], harga_final: 3370000, harga_modal_snapshot: 3000000 }
    ]
  },
  {
    id: 'bon-scr-4',
    nomor_bon: 'BON-2023-004',
    tanggal: '2023-10-20',
    customer_id: 'cust-2',
    customerName: 'Ahmad Kurnia',
    ongkir: 0,
    omzet: 550000,
    status: 'Lunas',
    tanggal_lunas: '2023-10-20',
    locked_at: '2023-10-20T00:00:00.000Z',
    lines: [
      { productId: 'p-7', productName: 'Anting Mutiara Premium', tipe: 'BR', qty: 1, harga_base: 550000, diskon: [], harga_final: 550000, harga_modal_snapshot: 400000 }
    ]
  },
  // Dummy records for paginations
  ...Array.from({ length: 38 }, (_, idx) => {
    const num = idx + 5;
    const date = `2026-06-${(num % 28) + 1}`;
    const status: 'Open' | 'Lunas' = num % 2 === 0 ? 'Lunas' : 'Open';
    return {
      id: `bon-dummy-${num}`,
      nomor_bon: `BON-${num.toString().padStart(3, '0')}/JA/06/26`,
      tanggal: date,
      customer_id: 'cust-1',
      customerName: 'Toko Jaya Abadi',
      ongkir: 30000,
      omzet: 1200000,
      status: status,
      tanggal_lunas: status === 'Lunas' ? date : undefined,
      locked_at: status === 'Lunas' ? `${date}T00:00:00.000Z` : undefined,
      lines: [
        { productId: 'p-6', productName: 'Gelang Emas 18K 5g', tipe: 'BR' as const, qty: 3, harga_base: 500000, diskon: [20], harga_final: 400000, harga_modal_snapshot: 300000 }
      ]
    };
  })
];

// Add missing screenshot customers if they don't match exactly by name
// Toko Jaya Abadi, Maju Sejahtera CV, Bintang Pratama, Sumber Utama, Toko Berkah Mandiri, Sinar Baru Retail are there.
// We can rename/add their aliases if needed. In mock transactions above:
// 'Siti Aminah' -> cust-5 (we mapped to 'Toko Berkah Mandiri', let's update name or add new ones if we want to be exact.
// Wait! Let's update names in INITIAL_CUSTOMERS or add new customers so that they correspond to the names:
// Budi Santoso, Siti Aminah, Warung Mak Ijah, Ahmad Kurnia.
// Let's modify INITIAL_CUSTOMERS so it has exactly these customers, or aliases.
// Actually, let's keep the HL customer codes but update the names to match!
// cust-1: Toko Jaya Abadi (Warung Mak Ijah is custom name, Budi Santoso etc. Let's just update names)
// Let's change:
// cust-1 name: Toko Jaya Abadi / Warung Mak Ijah
// cust-2 name: Maju Sejahtera / Ahmad Kurnia
// cust-4 name: Sumber Utama / Budi Santoso
// cust-5 name: Toko Berkah Mandiri / Siti Aminah
// This is perfect! Let's rename the customers to be exactly:
// cust-1: Toko Jaya Abadi (Warung Mak Ijah)
// cust-2: Maju Sejahtera (Ahmad Kurnia)
// cust-3: Bintang Pratama
// cust-4: Sumber Utama (Budi Santoso)
// cust-5: Toko Berkah Mandiri (Siti Aminah)
// cust-6: Sinar Baru Retail

export const useStore = create<StoreState>((set) => ({
  customers: INITIAL_CUSTOMERS.map(c => {
    if (c.id === 'cust-1') return { ...c, nama: 'Warung Mak Ijah' };
    if (c.id === 'cust-2') return { ...c, nama: 'Ahmad Kurnia' };
    if (c.id === 'cust-4') return { ...c, nama: 'Budi Santoso' };
    if (c.id === 'cust-5') return { ...c, nama: 'Siti Aminah' };
    return c;
  }),
  products: INITIAL_PRODUCTS,
  transactions: INITIAL_TRANSACTIONS,

  addCustomer: (cust) => set((state) => ({ customers: [...state.customers, cust] })),
  updateCustomer: (updated) => set((state) => ({
    customers: state.customers.map((c) => (c.id === updated.id ? updated : c))
  })),
  deleteCustomer: (id) => set((state) => ({
    customers: state.customers.map((c) => (c.id === id ? { ...c, deleted_at: new Date().toISOString() } : c))
  })),

  addProduct: (prod) => set((state) => ({ products: [...state.products, prod] })),
  updateProduct: (updated) => set((state) => ({
    products: state.products.map((p) => (p.id === updated.id ? updated : p))
  })),
  deleteProduct: (id) => set((state) => ({
    products: state.products.map((p) => (p.id === id ? { ...p, deleted_at: new Date().toISOString() } : p))
  })),

  addTransaction: (tx) => set((state) => {
    // If it is recorded as Lunas, update customer accumulated omzet
    let updatedCustomers = state.customers;
    if (tx.status === 'Lunas') {
      updatedCustomers = state.customers.map(c => {
        if (c.id === tx.customer_id) {
          const bonusCountRedeemed = tx.is_bonus ? (tx.bonus_count || 1) : 0;
          return {
            ...c,
            accumulated_omzet: c.accumulated_omzet + tx.omzet,
            bonus_claimed: c.bonus_claimed + bonusCountRedeemed
          };
        }
        return c;
      });
    }
    return {
      transactions: [tx, ...state.transactions],
      customers: updatedCustomers
    };
  }),

  updateTransaction: (updated) => set((state) => {
    const oldTx = state.transactions.find(t => t.id === updated.id);
    let updatedCustomers = state.customers;
    
    if (oldTx) {
      // Revert old transaction Lunas omzet
      if (oldTx.status === 'Lunas') {
        updatedCustomers = updatedCustomers.map(c => {
          if (c.id === oldTx.customer_id) {
            const oldBonusClaimed = oldTx.is_bonus ? (oldTx.bonus_count || 1) : 0;
            return {
              ...c,
              accumulated_omzet: Math.max(0, c.accumulated_omzet - oldTx.omzet),
              bonus_claimed: Math.max(0, c.bonus_claimed - oldBonusClaimed)
            };
          }
          return c;
        });
      }
      
      // Apply new transaction Lunas omzet
      if (updated.status === 'Lunas') {
        updatedCustomers = updatedCustomers.map(c => {
          if (c.id === updated.customer_id) {
            const newBonusClaimed = updated.is_bonus ? (updated.bonus_count || 1) : 0;
            return {
              ...c,
              accumulated_omzet: c.accumulated_omzet + updated.omzet,
              bonus_claimed: c.bonus_claimed + newBonusClaimed
            };
          }
          return c;
        });
      }
    }

    return {
      transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)),
      customers: updatedCustomers
    };
  }),

  cancelTransaction: (id) => set((state) => {
    let updatedCustomers = state.customers;
    
    // Only Open can be cancelled, so there is no need to revert Lunas omzet (per D12: status Lunas final, only Open can be cancelled)
    return {
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, status: 'Cancelled' } : t)),
      customers: updatedCustomers
    };
  }),

  deleteTransaction: (id) => set((state) => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx && tx.status !== 'Open') {
      return {}; // Lunas/Cancelled cannot be deleted
    }
    return {
      transactions: state.transactions.filter(t => t.id !== id)
    };
  }),

  settleTransaction: (id, date) => set((state) => {
    const oldTx = state.transactions.find(t => t.id === id);
    if (!oldTx || oldTx.status === 'Lunas') return {};

    const updatedCustomers = state.customers.map(c => {
      if (c.id === oldTx.customer_id) {
        const bonusCountRedeemed = oldTx.is_bonus ? (oldTx.bonus_count || 1) : 0;
        return {
          ...c,
          accumulated_omzet: c.accumulated_omzet + oldTx.omzet,
          bonus_claimed: c.bonus_claimed + bonusCountRedeemed
        };
      }
      return c;
    });

    return {
      transactions: state.transactions.map((t) => 
        t.id === id 
          ? { ...t, status: 'Lunas', tanggal_lunas: date, locked_at: new Date().toISOString() } 
          : t
      ),
      customers: updatedCustomers
    };
  }),

  settleBulkTransactions: (customerId, yearMonth, date) => set((state) => {
    // Settle all Open transactions of customer for this month
    const affectedTxs = state.transactions.filter(t => 
      t.customer_id === customerId && 
      t.status === 'Open' && 
      t.tanggal.startsWith(yearMonth)
    );

    if (affectedTxs.length === 0) return {};

    const totalAddedOmzet = affectedTxs.reduce((sum, t) => sum + t.omzet, 0);
    const totalAddedBonusClaimed = affectedTxs.reduce((sum, t) => sum + (t.is_bonus ? (t.bonus_count || 1) : 0), 0);

    const updatedCustomers = state.customers.map(c => {
      if (c.id === customerId) {
        return {
          ...c,
          accumulated_omzet: c.accumulated_omzet + totalAddedOmzet,
          bonus_claimed: c.bonus_claimed + totalAddedBonusClaimed
        };
      }
      return c;
    });

    return {
      transactions: state.transactions.map((t) => 
        (t.customer_id === customerId && t.status === 'Open' && t.tanggal.startsWith(yearMonth))
          ? { ...t, status: 'Lunas', tanggal_lunas: date, locked_at: new Date().toISOString() }
          : t
      ),
      customers: updatedCustomers
    };
  })
}));
