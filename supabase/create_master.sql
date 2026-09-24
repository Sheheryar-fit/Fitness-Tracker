-- ============================================
-- Create the master login
-- Run once in the Supabase SQL Editor, after security_4_master.sql.
--
-- 1. Change the two values marked EDIT (username and password).
--    Use a username nobody would guess and a long password (12+ characters).
-- 2. Run it. The check at the bottom should show master_logins = 1.
-- 3. Put the placeholder text back (or delete the saved snippet) so the
--    password is not kept in the editor, and change the password from inside
--    the app after the first login.
--
-- The master is created in Supabase Auth only, with no row in public.users.
-- ============================================

DO $$
DECLARE
  v_username TEXT := 'CHANGE_ME_USERNAME';  -- EDIT
  v_password TEXT := 'CHANGE_ME_PASSWORD';  -- EDIT
  v_id UUID := gen_random_uuid();
  v_email TEXT;
BEGIN
  IF v_username = 'CHANGE_ME_USERNAME' OR v_password = 'CHANGE_ME_PASSWORD' THEN
    RAISE EXCEPTION 'Edit the username and password first - nothing was changed';
  END IF;

  v_username := lower(trim(v_username));
  IF v_username = '' OR length(v_password) < 12 THEN
    RAISE EXCEPTION 'A username and a password of at least 12 characters are required - nothing was changed';
  END IF;

  v_email := public.login_email(v_username);
  IF EXISTS (SELECT 1 FROM public.users u WHERE lower(u.username) = v_username)
     OR EXISTS (SELECT 1 FROM auth.users a WHERE a.email = v_email) THEN
    RAISE EXCEPTION 'That username is already taken - nothing was changed';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(v_password, extensions.gen_salt('bf', 10)), now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'),
                       'app_role', 'master', 'username', v_username),
    jsonb_build_object('username', v_username),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', v_email,
                       'email_verified', true, 'phone_verified', false),
    now(), now(), now()
  );
END $$;

-- Check: expect master_logins = 1
SELECT count(*) AS master_logins
FROM auth.users
WHERE raw_app_meta_data ->> 'app_role' = 'master';
