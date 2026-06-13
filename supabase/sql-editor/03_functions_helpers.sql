-- STEP 3: Helper + login functions — jalankan SETELAH 02_triggers.sql sukses

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