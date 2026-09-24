-- ============================================
-- Security phase 4: hidden master (read-only)
-- Run once in the Supabase SQL Editor, after security_1 to security_3.
-- Nothing changes for trainers or clients, so it is safe to run before the
-- app has any master screens.
--
-- A "master" login can READ every table and every photo and can write
-- nothing: no policy below allows it, and the trainer functions refuse it.
-- The master exists only in Supabase Auth (app_metadata.app_role = 'master')
-- and has no row in public.users, so it never shows up in any list.
-- Create the login with create_master.sql.
--
-- Turn a master off (takes effect at once, not when its session expires):
--   DELETE FROM auth.users WHERE raw_app_meta_data ->> 'app_role' = 'master';
--
-- If security_2_rls.sql or security_3_storage.sql is ever run again it
-- removes these policies - run this file again afterwards.
-- ============================================

BEGIN;

-- 0. Safety check - nothing is changed if this fails
DO $$
BEGIN
  IF to_regprocedure('public.is_my_client(uuid)') IS NULL
     OR to_regprocedure('public.can_access_photo_folder(text)') IS NULL THEN
    RAISE EXCEPTION 'Run security_2_rls.sql and security_3_storage.sql first - nothing was changed';
  END IF;
END $$;

-- 1. The logged-in user is a master. Read from the Auth user's app_metadata,
--    which only the database can change (user_metadata can be edited by the
--    user, so it is never used). Looked up live, so removing the flag or the
--    login stops access immediately.
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users a
    WHERE a.id = auth.uid() AND a.raw_app_meta_data ->> 'app_role' = 'master'
  )
$$;

REVOKE ALL ON FUNCTION public.is_master() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master() TO authenticated;

-- 2. Read-only access to every table. These add to the existing policies
--    (a row is visible if any policy allows it) and touch no write rule.
DROP POLICY IF EXISTS "Master reads all users" ON public.users;
CREATE POLICY "Master reads all users" ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT public.is_master()));

DROP POLICY IF EXISTS "Master reads all clients" ON public.clients;
CREATE POLICY "Master reads all clients" ON public.clients
  FOR SELECT TO authenticated
  USING ((SELECT public.is_master()));

DROP POLICY IF EXISTS "Master reads all measurements" ON public.measurements;
CREATE POLICY "Master reads all measurements" ON public.measurements
  FOR SELECT TO authenticated
  USING ((SELECT public.is_master()));

DROP POLICY IF EXISTS "Master reads all goals" ON public.goals;
CREATE POLICY "Master reads all goals" ON public.goals
  FOR SELECT TO authenticated
  USING ((SELECT public.is_master()));

DROP POLICY IF EXISTS "Master reads all coach notes" ON public.coach_notes;
CREATE POLICY "Master reads all coach notes" ON public.coach_notes
  FOR SELECT TO authenticated
  USING ((SELECT public.is_master()));

DROP POLICY IF EXISTS "Master reads all check-ins" ON public.weekly_checkins;
CREATE POLICY "Master reads all check-ins" ON public.weekly_checkins
  FOR SELECT TO authenticated
  USING ((SELECT public.is_master()));

DROP POLICY IF EXISTS "Master reads all photos" ON public.progress_photos;
CREATE POLICY "Master reads all photos" ON public.progress_photos
  FOR SELECT TO authenticated
  USING ((SELECT public.is_master()));

-- 3. Photo files: view only (needed for the signed links), no upload or delete
DROP POLICY IF EXISTS "Photos: master can view" ON storage.objects;
CREATE POLICY "Photos: master can view" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'photos' AND (SELECT public.is_master()));

COMMIT;

-- Check: expect master_policies = 8
SELECT count(*) AS master_policies
FROM pg_policies
WHERE policyname LIKE 'Master reads all %' OR policyname = 'Photos: master can view';
