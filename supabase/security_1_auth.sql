-- ============================================
-- Security phase 1: move logins to Supabase Auth
-- Run once in the Supabase SQL Editor, BEFORE deploying the matching app code.
--
-- Additive only: every existing user gets a Supabase Auth login with the
-- same id and the same password, plus trainer functions for managing client
-- logins. The old policies and login function keep working until phase 2.
-- ============================================

BEGIN;

-- 0. Safety checks - nothing is changed if any of these fail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND n.nspname = 'extensions'
  ) THEN
    RAISE EXCEPTION 'pgcrypto is not in the extensions schema - nothing was changed';
  END IF;

  IF EXISTS (SELECT lower(username) FROM public.users GROUP BY 1 HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Two usernames differ only by upper/lower case - nothing was changed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE password NOT LIKE '$2%') THEN
    RAISE EXCEPTION 'A password is not a bcrypt hash - nothing was changed';
  END IF;
END $$;

-- 1. Username -> internal login email for Supabase Auth (never receives mail).
--    Must match usernameToEmail() in src/lib/authEmail.js
CREATE OR REPLACE FUNCTION public.login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT left(encode(extensions.digest(lower(trim(p_username)), 'sha256'), 'hex'), 32)
    || '@users.example.com'
$$;

-- 2. Role of the logged-in user ('admin' or 'client'), NULL if not an app user
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.role FROM public.users u WHERE u.id = auth.uid()
$$;

-- 3. Create the Supabase Auth login for an app user (id, username, role, bcrypt hash)
CREATE OR REPLACE FUNCTION public.create_auth_login(
  p_id UUID, p_username TEXT, p_role public.user_role, p_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email TEXT := public.login_email(p_username);
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    v_email, p_hash, now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                       'app_role', p_role, 'username', p_username),
    jsonb_build_object('username', p_username),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), p_id, p_id::text, 'email',
    jsonb_build_object('sub', p_id::text, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    now(), now(), now()
  );
END;
$$;

-- Only this script and the functions below may call it
REVOKE ALL ON FUNCTION public.create_auth_login(UUID, TEXT, public.user_role, TEXT) FROM PUBLIC, anon, authenticated;

-- 4. Give every existing user a Supabase Auth login (same id, same password)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id, u.username, u.role, u.password FROM public.users u
    WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id)
  LOOP
    PERFORM public.create_auth_login(r.id, r.username, r.role, r.password);
  END LOOP;
END $$;

-- 5. Trainer: create a login for a new client. Adds _2, _3... if the username
--    is taken. Returns the new user's id and final username.
CREATE OR REPLACE FUNCTION public.create_client_login(p_username TEXT, p_password TEXT)
RETURNS TABLE (new_user_id UUID, new_username TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base TEXT := lower(trim(p_username));
  v_username TEXT := lower(trim(p_username));
  v_counter INT := 2;
  v_id UUID := gen_random_uuid();
  v_hash TEXT;
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only trainers can create client logins' USING ERRCODE = '42501';
  END IF;
  IF v_base = '' OR length(coalesce(p_password, '')) < 6 THEN
    RAISE EXCEPTION 'A username and a password of at least 6 characters are required';
  END IF;

  WHILE EXISTS (SELECT 1 FROM public.users u WHERE lower(u.username) = v_username)
     OR EXISTS (SELECT 1 FROM auth.users a WHERE a.email = public.login_email(v_username))
  LOOP
    v_username := v_base || '_' || v_counter;
    v_counter := v_counter + 1;
  END LOOP;

  v_hash := extensions.crypt(p_password, extensions.gen_salt('bf', 10));

  -- password column is only kept for the old login until phase 2 removes it
  INSERT INTO public.users (id, username, password, role, trainer_id)
  VALUES (v_id, v_username, v_hash, 'client', auth.uid());

  PERFORM public.create_auth_login(v_id, v_username, 'client', v_hash);

  RETURN QUERY SELECT v_id, v_username;
END;
$$;

-- 6. Trainer: set a new password for one of their clients and sign them out everywhere
CREATE OR REPLACE FUNCTION public.reset_client_password(p_user_id UUID, p_new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.user_id = p_user_id AND c.trainer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only reset passwords of your own clients' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_new_password, '')) < 6 THEN
    RAISE EXCEPTION 'The password must be at least 6 characters';
  END IF;

  v_hash := extensions.crypt(p_new_password, extensions.gen_salt('bf', 10));
  UPDATE auth.users SET encrypted_password = v_hash, updated_at = now() WHERE id = p_user_id;
  UPDATE public.users SET password = v_hash WHERE id = p_user_id;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
END;
$$;

-- 7. Trainer: delete one of their clients with all their data and their login
--    (photo files are removed by the app through the Storage API first)
CREATE OR REPLACE FUNCTION public.delete_client(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT c.user_id INTO v_user_id
  FROM public.clients c
  WHERE c.id = p_client_id AND c.trainer_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only delete your own clients' USING ERRCODE = '42501';
  END IF;

  -- Cascades to measurements, goals, coach notes, check-ins and photo rows
  DELETE FROM public.clients WHERE id = p_client_id;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.users WHERE id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;
END;
$$;

-- 8. Only logged-in users may call the trainer functions (they also check the caller)
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_client_login(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_client_password(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_client(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_login(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_client_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_client(UUID) TO authenticated;

COMMIT;

-- Check: every app user should now have a login (expect the same two numbers)
SELECT
  (SELECT count(*) FROM public.users) AS app_users,
  (SELECT count(*) FROM auth.users a JOIN public.users u ON u.id = a.id) AS auth_logins;
