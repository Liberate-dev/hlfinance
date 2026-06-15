-- Bon soft-delete: exclude from laporan/aktif, restore via admin

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at
  ON transactions (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Allow nomor_bon reuse after soft-delete; uniqueness only among active bons
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_nomor_bon_unique;

DROP INDEX IF EXISTS idx_transactions_nomor_bon_active;
CREATE UNIQUE INDEX idx_transactions_nomor_bon_active
  ON transactions (lower(trim(nomor_bon)))
  WHERE deleted_at IS NULL;

-- create_bon: duplicate check among active bons only
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
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE lower(trim(nomor_bon)) = lower(trim(p_nomor_bon))
      AND deleted_at IS NULL
  ) THEN
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
    status, tanggal_lunas, locked_at, deskripsi, deleted_at
  ) VALUES (
    trim(p_nomor_bon), p_tanggal, p_customer_id, COALESCE(p_ongkir, 0), 0,
    p_is_bonus, CASE WHEN p_is_bonus THEN GREATEST(p_bonus_count, 1) ELSE 0 END,
    v_status, v_tanggal_lunas, v_locked, p_deskripsi, NULL
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

  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_tx.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.'; END IF;
  IF v_tx.status <> 'Open' THEN RAISE EXCEPTION 'Hanya bon Open yang dapat diubah.'; END IF;

  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE lower(trim(nomor_bon)) = lower(trim(p_nomor_bon))
      AND id <> p_transaction_id
      AND deleted_at IS NULL
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
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id AND deleted_at IS NULL;
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
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_tx.status <> 'Open' THEN RAISE EXCEPTION 'Hanya bon Open yang dapat dihapus.'; END IF;
  UPDATE transactions SET deleted_at = now(), updated_at = now() WHERE id = p_transaction_id;
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
  SELECT * INTO v_tx FROM transactions WHERE id = p_transaction_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_tx.status = 'Lunas' THEN RAISE EXCEPTION 'Invalid or already Lunas'; END IF;
  IF v_tx.locked_at IS NOT NULL THEN RAISE EXCEPTION 'Bon sudah Lunas dan tidak dapat diubah.'; END IF;

  UPDATE transactions SET
    status = 'Lunas',
    tanggal_lunas = COALESCE(p_date, CURRENT_DATE),
    locked_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id AND locked_at IS NULL AND deleted_at IS NULL;

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
    AND deleted_at IS NULL
    AND to_char(tanggal, 'YYYY-MM') = p_year_month
    AND locked_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  SELECT COALESCE(SUM(omzet), 0) INTO v_total
  FROM transactions
  WHERE customer_id = p_customer_id
    AND status = 'Lunas'
    AND deleted_at IS NULL
    AND tanggal_lunas = COALESCE(p_date, CURRENT_DATE)
    AND to_char(tanggal, 'YYYY-MM') = p_year_month;

  RETURN jsonb_build_object('settled', v_count, 'totalOmzet', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION restore_transaction(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx transactions%ROWTYPE;
  v_cust customers%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_tx FROM transactions WHERE id = p_id;
  IF NOT FOUND OR v_tx.deleted_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bon tidak ditemukan atau tidak dalam status terhapus.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE lower(trim(nomor_bon)) = lower(trim(v_tx.nomor_bon))
      AND id <> p_id
      AND deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Nomor bon bentrok dengan bon aktif. Ubah nomor bon aktif terlebih dahulu.'
    );
  END IF;

  SELECT * INTO v_cust FROM customers WHERE id = v_tx.customer_id;
  IF NOT FOUND OR v_cust.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pelanggan bon ini masih terhapus. Pulihkan pelanggan terlebih dahulu.'
    );
  END IF;

  UPDATE transactions SET deleted_at = NULL, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION restore_transaction(UUID) TO authenticated;