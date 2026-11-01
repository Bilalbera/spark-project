ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_until timestamptz,
  ADD COLUMN IF NOT EXISTS premium_title text,
  ADD COLUMN IF NOT EXISTS profile_theme text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS avatar_frame text NOT NULL DEFAULT 'diamond',
  ADD COLUMN IF NOT EXISTS chat_theme text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS profile_music text,
  ADD COLUMN IF NOT EXISTS showcase_episode_id uuid REFERENCES public.episodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS showcase_series_id uuid REFERENCES public.series(id) ON DELETE SET NULL;

-- premium_until can only be changed by trusted server functions, never by a direct user update.
CREATE OR REPLACE FUNCTION public.protect_premium_until()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
CREATE TRIGGER trg_protect_premium_until BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_premium_until();

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND premium_until > now());
$$;
REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_premium(uuid) TO authenticated, service_role;

-- Free test period: grants 30 days from now (or extends an active one by 30 days).
CREATE OR REPLACE FUNCTION public.activate_free_premium()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); result timestamptz;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Giriş gerekli'; END IF;
  UPDATE public.profiles
     SET premium_until = GREATEST(COALESCE(premium_until, now()), now()) + interval '30 days'
   WHERE id = me
   RETURNING premium_until INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'Profil bulunamadı'; END IF;
  RETURN result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.activate_free_premium() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_free_premium() TO authenticated, service_role;

-- Premium-only stickers in chat.
CREATE OR REPLACE FUNCTION public.check_premium_sticker()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.content LIKE '[sticker:%' AND NOT public.is_premium(NEW.sender_id) THEN
    RAISE EXCEPTION 'Çıkartmalar yalnızca Premium üyeler içindir';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_check_premium_sticker BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.check_premium_sticker();

-- Message reactions; premium emojis need an active membership.
CREATE TABLE public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions visible to members" ON public.message_reactions FOR SELECT TO authenticated
  USING (public.is_conversation_member((SELECT m.conversation_id FROM public.messages m WHERE m.id = message_id), auth.uid()));
CREATE POLICY "reactions add own" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_conversation_member((SELECT m.conversation_id FROM public.messages m WHERE m.id = message_id), auth.uid())
    AND (emoji IN ('👍','❤️','😂') OR (emoji IN ('👑','✨','🔥','💎','⚔️','🛡️') AND public.is_premium(auth.uid())))
  );
CREATE POLICY "reactions remove own" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- Gold-sealed friend request notifications from premium senders.
CREATE OR REPLACE FUNCTION public.on_friend_request_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender_name text;
BEGIN
  SELECT COALESCE(display_name, username) INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.receiver_id,
          CASE WHEN public.is_premium(NEW.sender_id) THEN 'friend_request_premium' ELSE 'friend_request' END,
          'Yeni arkadaşlık isteği', sender_name || ' arkadaşlık isteği gönderdi.', '/arkadaslar');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.on_friend_request_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_premium_until() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_premium_sticker() FROM PUBLIC, anon, authenticated;