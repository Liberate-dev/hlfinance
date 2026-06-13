-- STEP 1: Tables — paste SEMUA isi file ini ke SQL Editor, lalu Run

CREATE TABLE IF NOT EXISTS user_security (
  email TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode VARCHAR(10) NOT NULL,
  nama VARCHAR NOT NULL,
  diskon_lm JSONB NOT NULL DEFAULT '[]'::jsonb,
  diskon_br JSONB NOT NULL DEFAULT '[]'::jsonb,
  threshold_bonus NUMERIC NOT NULL DEFAULT 0,
  telepon VARCHAR,
  alamat TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT customers_kode_unique UNIQUE (kode)
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode VARCHAR(10) NOT NULL,
  nama VARCHAR NOT NULL,
  tipe VARCHAR NOT NULL CHECK (tipe IN ('LM', 'BR')),
  harga_modal NUMERIC NOT NULL CHECK (harga_modal >= 0),
  harga_base NUMERIC NOT NULL CHECK (harga_base >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT products_kode_unique UNIQUE (kode)
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor_bon VARCHAR NOT NULL,
  tanggal DATE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  ongkir NUMERIC NOT NULL DEFAULT 0 CHECK (ongkir >= 0),
  omzet NUMERIC NOT NULL DEFAULT 0 CHECK (omzet >= 0),
  is_bonus BOOLEAN NOT NULL DEFAULT false,
  bonus_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Lunas', 'Cancelled')),
  tanggal_lunas DATE,
  locked_at TIMESTAMPTZ,
  deskripsi TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transactions_nomor_bon_unique UNIQUE (nomor_bon),
  CONSTRAINT chk_bonus_status CHECK (
    is_bonus = false OR (is_bonus = true AND status = 'Lunas')
  ),
  CONSTRAINT chk_bonus_count CHECK (
    (is_bonus = false AND bonus_count = 0) OR (is_bonus = true AND bonus_count >= 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_status ON transactions(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_tanggal_lunas ON transactions(tanggal_lunas);

CREATE TABLE IF NOT EXISTS transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  qty INTEGER NOT NULL CHECK (qty >= 1),
  tipe_snapshot VARCHAR NOT NULL CHECK (tipe_snapshot IN ('LM', 'BR')),
  harga_modal_snapshot NUMERIC NOT NULL,
  harga_base_snapshot NUMERIC NOT NULL,
  diskon_terapan_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  harga_final_unit NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transaction_lines_tx_tipe
  ON transaction_lines(transaction_id, tipe_snapshot);

CREATE OR REPLACE VIEW products_public AS
SELECT id, kode, nama, tipe, harga_base, created_at, updated_at, deleted_at
FROM products;