-- User contact form inbox and founder notifications.
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_email text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS sender_email text;

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
  ON public.contact_messages(created_at DESC);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
GRANT INSERT, SELECT, UPDATE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

DROP POLICY IF EXISTS "contact messages insert own" ON public.contact_messages;
CREATE POLICY "contact messages insert own"
  ON public.contact_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "founders read contact messages" ON public.contact_messages;
CREATE POLICY "founders read contact messages"
  ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

DROP POLICY IF EXISTS "founders update contact messages" ON public.contact_messages;
CREATE POLICY "founders update contact messages"
  ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE OR REPLACE FUNCTION public.notify_founders_of_contact_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(display_name, username, 'Bir kullanıcı')
    INTO sender_name
    FROM public.profiles
   WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ur.user_id,
         'contact_message',
         'Yeni kullanıcı iletisi',
         COALESCE(sender_name, 'Bir kullanıcı') || ': ' || left(NEW.body, 140),
         '/kurucu/iletisim'
    FROM public.user_roles ur
   WHERE ur.role = 'founder';

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_founders_of_contact_message() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_founders_contact_message ON public.contact_messages;
CREATE TRIGGER trg_notify_founders_contact_message
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_founders_of_contact_message();

ALTER TABLE public.contact_messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'contact_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
