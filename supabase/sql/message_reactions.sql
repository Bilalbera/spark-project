-- Install the message reaction table and its membership-aware RLS policies.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_until timestamptz;

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = _user_id AND premium_until > now()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_premium(uuid) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions visible to members" ON public.message_reactions;
CREATE POLICY "reactions visible to members"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (
    public.is_conversation_member(
      (SELECT m.conversation_id FROM public.messages m WHERE m.id = message_id),
      auth.uid()
    )
  );

DROP POLICY IF EXISTS "reactions add own" ON public.message_reactions;
CREATE POLICY "reactions add own"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_conversation_member(
      (SELECT m.conversation_id FROM public.messages m WHERE m.id = message_id),
      auth.uid()
    )
    AND (
      emoji IN ('👍', '❤️', '😂')
      OR (emoji IN ('👑', '✨', '🔥', '💎', '⚔️', '🛡️') AND public.is_premium(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "reactions remove own" ON public.message_reactions;
CREATE POLICY "reactions remove own"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
