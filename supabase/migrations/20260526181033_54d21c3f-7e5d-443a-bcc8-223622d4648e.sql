
-- 1. Companies INSERT policy - restrict to authenticated
DROP POLICY IF EXISTS "Allow company creation during signup" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Storage policies for property-images
DROP POLICY IF EXISTS "Public can view property images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update property images" ON storage.objects;

-- Authenticated users can view (no anonymous listing). Public URLs still work since bucket is public.
CREATE POLICY "Authenticated users can view property images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'property-images');

-- Uploads/updates/deletes only via service_role (edge functions). No direct client writes.
-- (No INSERT/UPDATE/DELETE policy for authenticated = denied by default.)

-- 3. Lock down internal trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 4. Add company access check to get_unique_tags
CREATE OR REPLACE FUNCTION public.get_unique_tags(p_company_id uuid)
RETURNS TABLE(tag text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_company_id IS DISTINCT FROM public.get_user_company_id(auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT DISTINCT t.tag
  FROM (
    SELECT unnest(p.tags) as tag
    FROM properties p
    WHERE p.company_id = p_company_id
    AND p.tags IS NOT NULL
  ) AS t
  WHERE t.tag NOT LIKE 'list-%'
  ORDER BY t.tag;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_unique_tags(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unique_tags(uuid) TO authenticated;

-- 5. Remove deals from realtime publication to prevent cross-company event leakage
ALTER PUBLICATION supabase_realtime DROP TABLE public.deals;
