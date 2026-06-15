-- Admin settings: recovery code, clue, restore helpers

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  recovery_clue TEXT NOT NULL DEFAULT '',
  recovery_code_hash TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (id, recovery_clue)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_app_settings ON app_settings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, UPDATE ON app_settings TO authenticated;

-- Public clue for forgot-password screen (no code/hash exposed)
CREATE OR REPLACE FUNCTION get_recovery_clue()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT recovery_clue FROM app_settings WHERE id = 1;
$$;

-- Admin: read settings (without hash)
CREATE OR REPLACE FUNCTION get_admin_settings()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row app_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_row FROM app_settings WHERE id = 1;
  RETURN jsonb_build_object(
    'recovery_clue', COALESCE(v_row.recovery_clue, ''),
    'has_recovery_code', v_row.recovery_code_hash IS NOT NULL AND v_row.recovery_code_hash <> ''
  );
END;
$$;

-- Admin: update clue and/or recovery code
CREATE OR REPLACE FUNCTION update_recovery_settings(p_clue TEXT, p_code TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE app_settings
  SET
    recovery_clue = COALESCE(trim(p_clue), ''),
    recovery_code_hash = CASE
      WHEN p_code IS NULL OR trim(p_code) = '' THEN recovery_code_hash
      ELSE crypt(trim(p_code), gen_salt('bf'))
    END,
    updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Forgot password: verify recovery code and set new password (single-user app)
CREATE OR REPLACE FUNCTION reset_password_with_recovery(p_code TEXT, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_hash TEXT;
  v_email TEXT;
BEGIN
  IF length(trim(coalesce(p_new_password, ''))) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kata sandi minimal 8 karakter.');
  END IF;

  SELECT recovery_code_hash INTO v_hash FROM app_settings WHERE id = 1;
  IF v_hash IS NULL OR v_hash = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kode pemulihan belum diatur oleh admin.');
  END IF;

  IF crypt(trim(p_code), v_hash) <> v_hash THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kode pemulihan salah.');
  END IF;

  SELECT email INTO v_email
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Akun admin tidak ditemukan.');
  END IF;

  UPDATE auth.users
  SET
    encrypted_password = crypt(trim(p_new_password), gen_salt('bf')),
    updated_at = now()
  WHERE email = v_email;

  INSERT INTO user_security (email, failed_attempts, locked_until)
  VALUES (lower(v_email), 0, NULL)
  ON CONFLICT (email) DO UPDATE
    SET failed_attempts = 0, locked_until = NULL;

  RETURN jsonb_build_object('success', true, 'email', v_email);
END;
$$;

CREATE OR REPLACE FUNCTION restore_customer(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE customers SET deleted_at = NULL WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pelanggan tidak ditemukan.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION restore_product(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE products SET deleted_at = NULL WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produk tidak ditemukan.');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION get_recovery_clue() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION update_recovery_settings(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_password_with_recovery(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION restore_customer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_product(UUID) TO authenticated;