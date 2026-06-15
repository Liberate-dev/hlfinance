-- Admin: hapus semua data bisnis (pelanggan, produk, bon) — akun login & pengaturan admin tetap

CREATE OR REPLACE FUNCTION clear_all_business_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customers INTEGER;
  v_products INTEGER;
  v_transactions INTEGER;
  v_lines INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT COUNT(*) INTO v_lines FROM transaction_lines;
  SELECT COUNT(*) INTO v_transactions FROM transactions;
  SELECT COUNT(*) INTO v_customers FROM customers;
  SELECT COUNT(*) INTO v_products FROM products;

  TRUNCATE TABLE transaction_lines, transactions, customers, products;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', jsonb_build_object(
      'transaction_lines', v_lines,
      'transactions', v_transactions,
      'customers', v_customers,
      'products', v_products
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION clear_all_business_data() TO authenticated;