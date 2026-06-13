-- STEP 5: RLS + grants — jalankan TERAKHIR setelah 04_functions_bon.sql sukses

ALTER TABLE user_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_user_security ON user_security;
DROP POLICY IF EXISTS auth_customers ON customers;
DROP POLICY IF EXISTS auth_products ON products;
DROP POLICY IF EXISTS auth_transactions ON transactions;
DROP POLICY IF EXISTS auth_transaction_lines ON transaction_lines;

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