-- Apply this to the Supabase project used by the production site.
-- The app calls this RPC when a signed-in user starts the one-time free trial.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_until timestamptz;

-- Prevent clients from granting themselves Premium through a direct profile update.
CREATE OR REPLACE FUNCTION public.protect_premium_until()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.premium_until := NULL;
    ELSE
      NEW.premium_until := OLD.premium_until;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_premium_until ON public.profiles;
CREATE TRIGGER trg_protect_premium_until
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_premium_until();

REVOKE EXECUTE ON FUNCTION public.protect_premium_until() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.activate_free_premium()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  result timestamptz;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Giriş gerekli';
  END IF;

  UPDATE public.profiles
     SET premium_until = now() + interval '30 days'
   WHERE id = me AND premium_until IS NULL
   RETURNING premium_until INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Ücretsiz Premium denemesi zaten kullanılmış';
  END IF;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_free_premium() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_free_premium() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
