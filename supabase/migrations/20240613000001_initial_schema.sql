-- HL Finance — Supabase schema, RPC, RLS (PRD v2.2)

-- =============================================================================
-- TABLES
-- =============================================================================

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

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE OR REPLACE VIEW products_public AS
SELECT id, kode, nama, tipe, harga_base, created_at, updated_at, deleted_at
FROM products;

-- =============================================================================
-- TRIGGERS — lock lunas bon
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_locked_transaction_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_transaction ON transactions;
CREATE TRIGGER trg_lock_transaction
  BEFORE UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_transaction_change();

CREATE OR REPLACE FUNCTION prevent_locked_line_change()
RETURNS TRIGGER AS $$
DECLARE
  parent_locked TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT locked_at INTO parent_locked FROM transactions WHERE id = OLD.transaction_id;
  ELSE
    SELECT locked_at INTO parent_locked FROM transactions WHERE id = NEW.transaction_id;
  END IF;
  IF parent_locked IS NOT NULL THEN
    RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_transaction_lines ON transaction_lines;
CREATE TRIGGER trg_lock_transaction_lines
  BEFORE INSERT OR UPDATE OR DELETE ON transaction_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_line_change();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated ON transactions;
CREATE TRIGGER trg_transactions_updated
  BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_final_price(base NUMERIC, discounts JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  val NUMERIC := base;
  d NUMERIC;
BEGIN
  IF discounts IS NULL OR jsonb_array_length(discounts) = 0 THEN
    RETURN round(base);
  END IF;
  FOR d IN SELECT (jsonb_array_elements_text(discounts))::NUMERIC
  LOOP
    val := val * (1 - d / 100);
  END LOOP;
  RETURN round(val);
END;
$$;

-- =============================================================================
-- AUTH LOCKOUT (called from frontend before signInWithPassword)
-- =============================================================================

CREATE OR REPLACE FUNCTION check_login_allowed(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec user_security%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM user_security WHERE email = lower(trim(p_email));
  IF FOUND AND rec.locked_until IS NOT NULL AND rec.locked_until > now() THEN
    RETURN jsonb_build_object('allowed', false, 'error', 'Akun terkunci 30 menit.');
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION record_failed_login(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(trim(p_email));
  v_attempts INTEGER;
BEGIN
  INSERT INTO user_security (email, failed_attempts)
  VALUES (v_email, 1)
  ON CONFLICT (email) DO UPDATE
    SET failed_attempts = user_security.failed_attempts + 1
  RETURNING failed_attempts INTO v_attempts;

  IF v_attempts >= 5 THEN
    UPDATE user_security
    SET locked_until = now() + interval '30 minutes', failed_attempts = 0
    WHERE email = v_email;
    RETURN jsonb_build_object('locked', true, 'error', 'Akun terkunci 30 menit.');
  END IF;
  RETURN jsonb_build_object('locked', false, 'error', 'Kredensial salah.');
END;
$$;

CREATE OR REPLACE FUNCTION reset_login_attempts(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_security
  SET failed_attempts = 0, locked_until = NULL
  WHERE email = lower(trim(p_email));
END;
$$;

-- =============================================================================
-- RPC — BON OPERATIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION create_bon(
  p_nomor_bon TEXT,
  p_tanggal DATE,
  p_customer_id UUID,
  p_ongkir NUMERIC DEFAULT 0,
  p_deskripsi TEXT DEFAULT NULL,
  p_is_bonus BOOLEAN DEFAULT false,
  p_bonus_count INTEGER DEFAULT 0,
  p_status TEXT DEFAULT 'Open',
  p_lines JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cust customers%ROWTYPE;
  v_tx_id UUID;
  v_line JSONB;
  v_prod products%ROWTYPE;
  v_discounts JSONB;
  v_base NUMERIC;
  v_final NUMERIC;
  v_modal NUMERIC;
  v_omzet NUMERIC := 0;
  v_status TEXT;
  v_locked TIMESTAMPTZ;
  v_tanggal_lunas DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_nomor_bon IS NULL OR trim(p_nomor_bon) = '' THEN
    RAISE EXCEPTION 'Nomor Bon wajib diisi.';
  END IF;
  IF EXISTS (SELECT 1 FROM transactions WHERE lower(nomor_bon) = lower(trim(p_nomor_bon))) THEN
    RAISE EXCEPTION 'Nomor Bon sudah ada';
  END IF;
  IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Minimal satu baris produk.';
  END IF;

  SELECT * INTO v_cust FROM customers WHERE id = p_customer_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF p_is_bonus THEN
    v_status := 'Lunas';
    v_locked := now();
    v_tanggal_lunas := p_tanggal;
  ELSE
    v_status := COALESCE(p_status, 'Open');
    IF v_status NOT IN ('Open', 'Lunas', 'Cancelled') THEN
      RAISE EXCEPTION 'Status tidak valid';
    END IF;
    IF v_status = 'Lunas' THEN
      v_locked := now();
      v_tanggal_lunas := p_tanggal;
    END IF;
  END IF;

  INSERT INTO transactions (
    nomor_bon, tanggal, customer_id, ongkir, omzet, is_bonus, bonus_count,
    status, tanggal_lunas, locked_at, deskripsi
  ) VALUES (
    trim(p_nomor_bon), p_tanggal, p_customer_id, COALESCE(p_ongkir, 0), 0,
    p_is_bonus, CASE WHEN p_is_bonus THEN GREATEST(p_bonus_count, 1) ELSE 0 END,
    v_status, v_tanggal_lunas, v_locked, p_deskripsi
  ) RETURNING id INTO v_tx_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_prod FROM products
    WHERE id = (v_line->>'product_id')::UUID AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produk tidak ditemukan';
    END IF;

    v_discounts := CASE WHEN v_prod.tipe = 'LM' THEN v_cust.diskon_lm ELSE v_cust.diskon_br END;
    v_base := v_prod.harga_base;

    IF p_is_bonus THEN
      v_final := 0;
      v_modal := 0;
    ELSE
      v_final := calculate_final_price(v_base, v_discounts);
      v_modal := v_prod.harga_modal;
    END IF;

    INSERT INTO transaction_lines (
      transaction_id, product_id, qty, tipe_snapshot,
      harga_modal_snapshot, harga_base_snapshot,
      diskon_terapan_snapshot, harga_final_unit
    ) VALUES (
      v_tx_id, v_prod.id, GREATEST((v_line->>'qty')::INTEGER, 1), v_prod.tipe,
      v_modal, v_base, v_discounts, v_final
    );

    v_omzet := v_omzet + (v_final * GREATEST((v_line->>'qty')::INTEGER, 1));
  END LOOP;

  UPDATE transactions SET omzet = v_omzet WHERE id = v_tx_id;

  RETURN jsonb_build_object('id', v_tx_id);
END;
$$;

CREATE OR REPLACE FUNCTION update_bon_open(
  p_transaction_id UUID,
  p_nomor_bon TEXT,
  p_tanggal DATE,
  p_customer_id UUID,
  p_ongkir NUMERIC,
  p_deskripsi TEXT,
  p_status TEXT,
  p_lines JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions%ROWTYPE;
  v_cust customers%ROWTYPE;
  v_line JSONB;
  v_existing transaction_lines%ROWTYPE;
  v_prod products%ROWTYPE;
  v_discounts JSONB;
  v_base NUMERIC;
  v_final NUMERIC;
  v_modal NUMERIC;
  v_omzet NUMERIC := 0;
  v_line_id UUID;
  v_product_id UUID;
  v_qty INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_tx.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.'; END IF;
  IF v_tx.status <> 'Open' THEN RAISE EXCEPTION 'Hanya bon Open yang dapat diubah.'; END IF;

  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE lower(nomor_bon) = lower(trim(p_nomor_bon)) AND id <> p_transaction_id
  ) THEN
    RAISE EXCEPTION 'Nomor Bon sudah ada';
  END IF;

  SELECT * INTO v_cust FROM customers WHERE id = p_customer_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  UPDATE transactions SET
    nomor_bon = trim(p_nomor_bon),
    tanggal = p_tanggal,
    customer_id = p_customer_id,
    ongkir = COALESCE(p_ongkir, 0),
    deskripsi = p_deskripsi,
    status = COALESCE(p_status, 'Open'),
    updated_at = now()
  WHERE id = p_transaction_id;

  CREATE TEMP TABLE tmp_existing_lines ON COMMIT DROP AS
    SELECT * FROM transaction_lines WHERE transaction_id = p_transaction_id;

  DELETE FROM transaction_lines WHERE transaction_id = p_transaction_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_id := NULLIF(v_line->>'line_id', '')::UUID;
    v_product_id := (v_line->>'product_id')::UUID;
    v_qty := GREATEST((v_line->>'qty')::INTEGER, 1);

    IF v_line_id IS NOT NULL THEN
      SELECT * INTO v_existing FROM tmp_existing_lines WHERE id = v_line_id;
      IF FOUND AND v_existing.product_id = v_product_id THEN
        v_base := v_existing.harga_base_snapshot;
        v_modal := v_existing.harga_modal_snapshot;
        v_discounts := v_existing.diskon_terapan_snapshot;
        v_final := calculate_final_price(v_base, v_discounts);
      ELSE
        SELECT * INTO v_prod FROM products WHERE id = v_product_id AND deleted_at IS NULL;
        IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
        v_discounts := CASE WHEN v_prod.tipe = 'LM' THEN v_cust.diskon_lm ELSE v_cust.diskon_br END;
        v_base := v_prod.harga_base;
        v_final := calculate_final_price(v_base, v_discounts);
        v_modal := v_prod.harga_modal;
      END IF;
    ELSE
      SELECT * INTO v_prod FROM products WHERE id = v_product_id AND deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
      v_discounts := CASE WHEN v_prod.tipe = 'LM' THEN v_cust.diskon_lm ELSE v_cust.diskon_br END;
      v_base := v_prod.harga_base;
      v_final := calculate_final_price(v_base, v_discounts);
      v_modal := v_prod.harga_modal;
    END IF;

    INSERT INTO transaction_lines (
      transaction_id, product_id, qty, tipe_snapshot,
      harga_modal_snapshot, harga_base_snapshot,
      diskon_terapan_snapshot, harga_final_unit
    ) VALUES (
      p_transaction_id, v_product_id, v_qty,
      COALESCE((SELECT tipe FROM products WHERE id = v_product_id), 'LM'),
      v_modal, v_base, v_discounts, v_final
    );

    v_omzet := v_omzet + (v_final * v_qty);
  END LOOP;

  UPDATE transactions SET omzet = v_omzet WHERE id = p_transaction_id;

  RETURN jsonb_build_object('id', p_transaction_id);
END;
$$;

CREATE OR REPLACE FUNCTION cancel_bon(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_tx.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.'; END IF;
  IF v_tx.status <> 'Open' THEN RAISE EXCEPTION 'Hanya bon Open yang dapat dibatalkan.'; END IF;
  UPDATE transactions SET status = 'Cancelled', updated_at = now() WHERE id = p_transaction_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION delete_bon_open(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_tx.status <> 'Open' THEN RAISE EXCEPTION 'Hanya bon Open yang dapat dihapus.'; END IF;
  DELETE FROM transactions WHERE id = p_transaction_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION settle_bon(p_transaction_id UUID, p_date DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_tx.status = 'Lunas' THEN RAISE EXCEPTION 'Invalid or already Lunas'; END IF;
  IF v_tx.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.'; END IF;

  UPDATE transactions SET
    status = 'Lunas',
    tanggal_lunas = COALESCE(p_date, CURRENT_DATE),
    locked_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id AND locked_at IS NULL;

  RETURN jsonb_build_object('id', p_transaction_id);
END;
$$;

CREATE OR REPLACE FUNCTION settle_bon_bulk(
  p_customer_id UUID,
  p_year_month TEXT,
  p_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_total NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE transactions SET
    status = 'Lunas',
    tanggal_lunas = COALESCE(p_date, CURRENT_DATE),
    locked_at = now(),
    updated_at = now()
  WHERE customer_id = p_customer_id
    AND status = 'Open'
    AND to_char(tanggal, 'YYYY-MM') = p_year_month
    AND locked_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT COALESCE(SUM(omzet), 0) INTO v_total
  FROM transactions
  WHERE customer_id = p_customer_id
    AND status = 'Lunas'
    AND tanggal_lunas = COALESCE(p_date, CURRENT_DATE)
    AND to_char(tanggal, 'YYYY-MM') = p_year_month;

  RETURN jsonb_build_object('settled', v_count, 'totalOmzet', v_total);
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_user_security ON user_security
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_customers ON customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_products ON products
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_transactions ON transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY auth_transaction_lines ON transaction_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon to call lockout functions only (via RPC grants below)
GRANT EXECUTE ON FUNCTION check_login_allowed(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_failed_login(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_login_attempts(TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION create_bon(TEXT, DATE, UUID, NUMERIC, TEXT, BOOLEAN, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_bon_open(UUID, TEXT, DATE, UUID, NUMERIC, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_bon(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_bon_open(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION settle_bon(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION settle_bon_bulk(UUID, TEXT, DATE) TO authenticated;

GRANT SELECT ON products_public TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;