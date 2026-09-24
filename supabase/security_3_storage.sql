-- ============================================
-- Security phase 3: private progress photos
-- Run in the Supabase SQL Editor AFTER the app version that shows photos
-- through signed links is deployed (otherwise photos stop showing until then).
--
-- Makes the "photos" bucket private and replaces its open rules: only the
-- client's trainer and the client can view, upload or delete their photos.
-- Photos are stored in a folder named after the client id.
-- ============================================

BEGIN;

-- 0. Safety check - nothing is changed if this fails
DO $$
BEGIN
  IF to_regprocedure('public.is_my_client(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Run security_2_rls.sql first - nothing was changed';
  END IF;
END $$;

-- 1. The folder (a client id) belongs to the logged-in trainer's client,
--    or is the logged-in client's own. Compared as text, so odd folder names
--    are simply denied instead of causing errors.
CREATE OR REPLACE FUNCTION public.can_access_photo_folder(p_folder TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id::text = p_folder
      AND (c.trainer_id = auth.uid() OR c.user_id = auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public.can_access_photo_folder(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_photo_folder(TEXT) TO authenticated;

-- 2. Remove every existing rule for the photos bucket (including the open
--    "Allow custom auth access to photos" one)
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%''photos''%'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- 3. New rules: trainer and client only (viewing needs a signed link)
CREATE POLICY "Photos: trainer and client can view" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'photos' AND public.can_access_photo_folder((storage.foldername(name))[1]));

CREATE POLICY "Photos: trainer and client can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND public.can_access_photo_folder((storage.foldername(name))[1]));

CREATE POLICY "Photos: trainer and client can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND public.can_access_photo_folder((storage.foldername(name))[1]));

-- 4. Private bucket: public links stop working, the app uses signed links
UPDATE storage.buckets SET public = false WHERE id = 'photos';

COMMIT;

-- Check: expect bucket_public = false and photo_policies = 3
SELECT
  (SELECT public FROM storage.buckets WHERE id = 'photos') AS bucket_public,
  (SELECT count(*) FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects'
     AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%''photos''%') AS photo_policies;
