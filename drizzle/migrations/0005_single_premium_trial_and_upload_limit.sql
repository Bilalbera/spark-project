-- Grant the free trial once per profile. premium_until remains populated after expiry,
-- so the same account cannot claim another trial later.
CREATE OR REPLACE FUNCTION public.activate_free_premium()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); result timestamptz;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Giriş gerekli'; END IF;
  UPDATE public.profiles
     SET premium_until = now() + interval '30 days'
   WHERE id = me AND premium_until IS NULL
   RETURNING premium_until INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Ücretsiz Premium denemesi zaten kullanılmış'; END IF;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.activate_free_premium() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_free_premium() TO authenticated, service_role;

-- Resumable MP4 uploads use the existing private media bucket.
UPDATE storage.buckets
   SET file_size_limit = 53687091200
 WHERE id = 'media';
