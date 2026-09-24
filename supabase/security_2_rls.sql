-- ============================================
-- Security phase 2: lock the database
-- Run in the Supabase SQL Editor AFTER phase 1 is deployed and logins work.
--
-- Replaces the "allow everything" policies: a trainer sees only their own
-- clients, a client sees only their own data, logged-out visitors see
-- nothing. Removes the old login functions and the old password column.
-- ============================================

BEGIN;

-- 0. Safety checks - nothing is changed if any of these fail
DO $$
BEGIN
  IF to_regprocedure('public.create_client_login(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Run security_1_auth.sql first - nothing was changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.users u WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id)
  ) THEN
    RAISE EXCEPTION 'Some users have no Supabase Auth login - run security_1_auth.sql again first. Nothing was changed';
  END IF;
END $$;

-- 1. A client's login belongs to the client's trainer (the checks below rely on it)
UPDATE public.users u
SET trainer_id = c.trainer_id
FROM public.clients c
WHERE c.user_id = u.id AND u.trainer_id IS DISTINCT FROM c.trainer_id;

-- 2. Helpers for the policies. SECURITY DEFINER so a policy can look at
--    clients/users without going through their own policies.

-- The client record belongs to the logged-in trainer
CREATE OR REPLACE FUNCTION public.is_my_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = p_client_id AND c.trainer_id = auth.uid()
  )
$$;

-- The client record is the logged-in client's own
CREATE OR REPLACE FUNCTION public.is_own_client_record(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = p_client_id AND c.user_id = auth.uid()
  )
$$;

-- The login is a client login created by the logged-in trainer
CREATE OR REPLACE FUNCTION public.is_my_client_login(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id AND u.role = 'client' AND u.trainer_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.is_my_client(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_own_client_record(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_my_client_login(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_client(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_client_record(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_my_client_login(UUID) TO authenticated;

-- 3. Remove every existing policy on the app's tables (the "Allow all" ones)
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'clients', 'measurements', 'goals',
                        'coach_notes', 'weekly_checkins', 'progress_photos')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

-- 4. Logged-out visitors get no table access at all
REVOKE ALL ON public.users, public.clients, public.measurements, public.goals,
  public.coach_notes, public.weekly_checkins, public.progress_photos FROM anon;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

-- 5. Policies

-- users: your own row; a trainer also sees their clients' logins (usernames).
-- Writes only happen through the trainer functions.
CREATE POLICY "Read own user and own clients' users" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_my_client_login(id));

-- clients: the trainer and the client can read; only the trainer adds/edits.
-- Deleting goes through delete_client() so the login is removed too.
CREATE POLICY "Trainer and client read client" ON public.clients
  FOR SELECT TO authenticated
  USING (trainer_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "Trainer adds own clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    trainer_id = auth.uid()
    AND public.current_app_role() = 'admin'
    AND (user_id IS NULL OR public.is_my_client_login(user_id))
  );

CREATE POLICY "Trainer edits own clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (trainer_id = auth.uid())
  WITH CHECK (
    trainer_id = auth.uid()
    AND (user_id IS NULL OR public.is_my_client_login(user_id))
  );

-- measurements: trainer and client read; trainer writes
CREATE POLICY "Trainer and client read measurements" ON public.measurements
  FOR SELECT TO authenticated
  USING (public.is_my_client(client_id) OR public.is_own_client_record(client_id));

CREATE POLICY "Trainer writes measurements" ON public.measurements
  FOR ALL TO authenticated
  USING (public.is_my_client(client_id))
  WITH CHECK (public.is_my_client(client_id));

-- goals, coach notes, check-ins: trainer and client read; trainer writes
CREATE POLICY "Trainer and client read goals" ON public.goals
  FOR SELECT TO authenticated
  USING (public.is_my_client(client_id) OR public.is_own_client_record(client_id));

CREATE POLICY "Trainer writes goals" ON public.goals
  FOR ALL TO authenticated
  USING (public.is_my_client(client_id))
  WITH CHECK (public.is_my_client(client_id) AND trainer_id = auth.uid());

CREATE POLICY "Trainer and client read coach notes" ON public.coach_notes
  FOR SELECT TO authenticated
  USING (public.is_my_client(client_id) OR public.is_own_client_record(client_id));

CREATE POLICY "Trainer writes coach notes" ON public.coach_notes
  FOR ALL TO authenticated
  USING (public.is_my_client(client_id))
  WITH CHECK (public.is_my_client(client_id) AND trainer_id = auth.uid());

CREATE POLICY "Trainer and client read check-ins" ON public.weekly_checkins
  FOR SELECT TO authenticated
  USING (public.is_my_client(client_id) OR public.is_own_client_record(client_id));

CREATE POLICY "Trainer writes check-ins" ON public.weekly_checkins
  FOR ALL TO authenticated
  USING (public.is_my_client(client_id))
  WITH CHECK (public.is_my_client(client_id) AND trainer_id = auth.uid());

-- progress photos: trainer and client read and upload (as themselves);
-- the trainer deletes any, a client deletes only their own uploads
CREATE POLICY "Trainer and client read photos" ON public.progress_photos
  FOR SELECT TO authenticated
  USING (public.is_my_client(client_id) OR public.is_own_client_record(client_id));

CREATE POLICY "Trainer and client add photos" ON public.progress_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_my_client(client_id) OR public.is_own_client_record(client_id))
    AND uploader_id = auth.uid()
  );

CREATE POLICY "Trainer or uploader deletes photos" ON public.progress_photos
  FOR DELETE TO authenticated
  USING (
    public.is_my_client(client_id)
    OR (public.is_own_client_record(client_id) AND uploader_id = auth.uid())
  );

-- 6. Remove the old login functions (anyone could call them)
DROP FUNCTION IF EXISTS public.authenticate_user(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user_with_password(TEXT, TEXT, public.user_role, UUID);
DROP FUNCTION IF EXISTS public.reset_user_password(UUID, TEXT);

-- 7. Passwords now live only in Supabase Auth
ALTER TABLE public.users DROP COLUMN IF EXISTS password;

-- 8. Trainer functions without the old password column
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

  INSERT INTO public.users (id, username, role, trainer_id)
  VALUES (v_id, v_username, 'client', auth.uid());

  PERFORM public.create_auth_login(
    v_id, v_username, 'client', extensions.crypt(p_password, extensions.gen_salt('bf', 10))
  );

  RETURN QUERY SELECT v_id, v_username;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_client_password(p_user_id UUID, p_new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.user_id = p_user_id AND c.trainer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only reset passwords of your own clients' USING ERRCODE = '42501';
  END IF;
  IF length(coalesce(p_new_password, '')) < 6 THEN
    RAISE EXCEPTION 'The password must be at least 6 characters';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
END;
$$;

-- Only removes the login if it is one of this trainer's client logins
CREATE OR REPLACE FUNCTION public.delete_client(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_remove_login BOOLEAN;
BEGIN
  SELECT c.user_id INTO v_user_id
  FROM public.clients c
  WHERE c.id = p_client_id AND c.trainer_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only delete your own clients' USING ERRCODE = '42501';
  END IF;

  v_remove_login := v_user_id IS NOT NULL AND public.is_my_client_login(v_user_id);

  -- Cascades to measurements, goals, coach notes, check-ins and photo rows
  DELETE FROM public.clients WHERE id = p_client_id;

  IF v_remove_login THEN
    DELETE FROM public.users WHERE id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.login_email(TEXT) FROM PUBLIC, anon, authenticated;

COMMIT;

-- Check: expect 0 old functions, 0 password columns, and the new policies
SELECT
  (SELECT count(*) FROM pg_proc WHERE proname IN ('authenticate_user', 'create_user_with_password', 'reset_user_password')) AS old_functions_left,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password') AS password_columns_left,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policies;
