-- STEP 2: Triggers — jalankan SETELAH 01_tables.sql sukses

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