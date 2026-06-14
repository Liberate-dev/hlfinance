-- STEP 7: Security hardening — jalankan SETELAH step 1-6
-- Fixes: lockout DoS (VULN-001), direct table bypass (VULN-002), security definer view (VULN-003)

-- ============================================================
-- VULN-003: products_public view → security_invoker
-- ============================================================
DROP VIEW IF EXISTS products_public;

CREATE VIEW products_public
WITH (security_invoker = true)
AS
SELECT id, kode, nama, tipe, harga_base, created_at, updated_at, deleted_at
FROM products;

GRANT SELECT ON products_public TO authenticated;

-- ============================================================
-- VULN-001: Login lockout — stop trusting anon callers
-- ============================================================

REVOKE EXECUTE ON FUNCTION record_failed_login(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION record_failed_login(TEXT) FROM PUBLIC;

-- Only authenticated sessions may reset lockout, and only for their own email.
CREATE OR REPLACE FUNCTION reset_login_attempts(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_session_email := lower(trim(coalesce(auth.jwt()->>'email', '')));
  IF v_session_email = '' OR v_session_email <> lower(trim(p_email)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE user_security
  SET failed_attempts = 0, locked_until = NULL
  WHERE email = v_session_email;
END;
$$;

-- record_failed_login kept for future Edge Function / Auth Hook integration.
-- Not granted to anon — client-side calls are no longer trusted.
CREATE OR REPLACE FUNCTION record_failed_login(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RAISE EXCEPTION 'record_failed_login is disabled for client calls. Use Supabase Auth rate limiting or an Edge Function.';
END;
$$;

REVOKE EXECUTE ON FUNCTION record_failed_login(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION check_login_allowed(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reset_login_attempts(TEXT) TO authenticated;

-- ============================================================
-- VULN-002: Restrict direct writes — force RPC for bon data
-- ============================================================

REVOKE INSERT, UPDATE, DELETE ON transactions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON transaction_lines FROM authenticated;
REVOKE ALL ON user_security FROM authenticated;

GRANT SELECT ON transactions TO authenticated;
GRANT SELECT ON transaction_lines TO authenticated;

-- customers & products: direct CRUD still allowed (admin UI uses PostgREST)

-- ============================================================
-- Bonus: search_path hardening (Supabase linter)
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_final_price(base NUMERIC, discounts JSONB)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
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

CREATE OR REPLACE FUNCTION prevent_locked_transaction_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION prevent_locked_line_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- Bonus: index for transaction_lines.product_id FK (performance linter)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transaction_lines_product_id ON transaction_lines(product_id);