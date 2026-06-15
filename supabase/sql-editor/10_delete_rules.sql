-- Aturan hapus: pelanggan dengan transaksi tidak bisa dihapus; bon hanya setelah dibatalkan

CREATE OR REPLACE FUNCTION soft_delete_customer(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF EXISTS (SELECT 1 FROM transactions WHERE customer_id = p_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Pelanggan dengan riwayat transaksi tidak dapat dihapus.'
    );
  END IF;

  UPDATE customers SET deleted_at = now() WHERE id = p_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pelanggan tidak ditemukan.');
  END IF;

  RETURN jsonb_build_object('success', true);
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
  IF v_tx.status <> 'Cancelled' THEN
    RAISE EXCEPTION 'Hanya bon berstatus Batal yang dapat dihapus. Batalkan bon terlebih dahulu.';
  END IF;
  UPDATE transactions SET deleted_at = now(), updated_at = now() WHERE id = p_transaction_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION soft_delete_customer(UUID) TO authenticated;