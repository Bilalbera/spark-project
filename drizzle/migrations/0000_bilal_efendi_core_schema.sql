-- ===== ENUMS =====
CREATE TYPE public.app_role AS ENUM ('user','founder');
CREATE TYPE public.content_status AS ENUM ('draft','published','hidden','scheduled');
CREATE TYPE public.request_status AS ENUM ('pending','accepted','rejected');

-- ===== PROFILES =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  email text,
  bio text,
  banned boolean NOT NULL DEFAULT false,
  onboarded boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ===== ROLES =====
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles update by founder" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'founder'));

CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'founder'));

-- new user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base_username text;
BEGIN
  base_username := lower(regexp_replace(split_part(COALESCE(NEW.email,'kullanici'),'@',1), '[^a-z0-9_]', '', 'g'));
  IF base_username = '' THEN base_username := 'kullanici'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = base_username) THEN
    base_username := base_username || substr(replace(NEW.id::text,'-',''),1,4);
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    base_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', base_username),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );

  IF lower(COALESCE(NEW.email,'')) = 'bilalberacantekin@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'founder') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== CATEGORIES =====
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  emoji text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories founder write" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));

-- ===== SERIES =====
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  genre text,
  cover_url text,
  hero_url text,
  status public.content_status NOT NULL DEFAULT 'draft',
  featured boolean NOT NULL DEFAULT false,
  show_in_hero boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  release_date date,
  publish_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_series_status ON public.series(status);
GRANT SELECT ON public.series TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.series TO authenticated;
GRANT ALL ON public.series TO service_role;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series public read published" ON public.series FOR SELECT TO anon, authenticated
  USING (status = 'published' OR (status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= now()));
CREATE POLICY "series founder read all" ON public.series FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'founder'));
CREATE POLICY "series founder write" ON public.series FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));

CREATE TABLE public.series_categories (
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (series_id, category_id)
);
GRANT SELECT ON public.series_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.series_categories TO authenticated;
GRANT ALL ON public.series_categories TO service_role;
ALTER TABLE public.series_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "series_categories public read" ON public.series_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "series_categories founder write" ON public.series_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));

-- ===== SEASONS =====
CREATE TABLE public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  number int NOT NULL,
  title text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, number)
);
GRANT SELECT ON public.seasons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons public read" ON public.seasons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "seasons founder write" ON public.seasons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));

-- ===== EPISODES =====
CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  number int NOT NULL,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  youtube_url text,
  duration_seconds int,
  status public.content_status NOT NULL DEFAULT 'draft',
  is_new boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  release_date date,
  publish_at timestamptz,
  view_count bigint NOT NULL DEFAULT 0,
  like_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_episodes_season ON public.episodes(season_id);
CREATE INDEX idx_episodes_series ON public.episodes(series_id);
GRANT SELECT ON public.episodes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.episodes TO authenticated;
GRANT ALL ON public.episodes TO service_role;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "episodes public read published" ON public.episodes FOR SELECT TO anon, authenticated
  USING (status = 'published' OR (status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= now()));
CREATE POLICY "episodes founder read all" ON public.episodes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'founder'));
CREATE POLICY "episodes founder write" ON public.episodes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));

-- ===== HOMEPAGE SECTIONS =====
CREATE TABLE public.homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  visible boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.homepage_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homepage_sections TO authenticated;
GRANT ALL ON public.homepage_sections TO service_role;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sections public read" ON public.homepage_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sections founder write" ON public.homepage_sections FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));

CREATE TABLE public.section_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.homepage_sections(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (section_id, series_id)
);
GRANT SELECT ON public.section_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.section_items TO authenticated;
GRANT ALL ON public.section_items TO service_role;
ALTER TABLE public.section_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "section_items public read" ON public.section_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "section_items founder write" ON public.section_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));

-- ===== USER CONTENT STATE =====
CREATE TABLE public.favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favorites own" ON public.favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.watchlist (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_id)
);
GRANT SELECT, INSERT, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchlist own" ON public.watchlist FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.episode_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, episode_id)
);
GRANT SELECT, INSERT, DELETE ON public.episode_likes TO authenticated;
GRANT ALL ON public.episode_likes TO service_role;
ALTER TABLE public.episode_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes own" ON public.episode_likes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.watch_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  position_seconds int NOT NULL DEFAULT 0,
  duration_seconds int,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, episode_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_progress TO authenticated;
GRANT ALL ON public.watch_progress TO service_role;
ALTER TABLE public.watch_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress own" ON public.watch_progress FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  watched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_history_user ON public.watch_history(user_id, watched_at DESC);
GRANT SELECT, INSERT, DELETE ON public.watch_history TO authenticated;
GRANT ALL ON public.watch_history TO service_role;
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history own" ON public.watch_history FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.episode_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_views_created ON public.episode_views(created_at DESC);
GRANT SELECT, INSERT ON public.episode_views TO authenticated;
GRANT ALL ON public.episode_views TO service_role;
ALTER TABLE public.episode_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "views insert own" ON public.episode_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "views founder read" ON public.episode_views FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'founder'));

-- ===== FRIENDS =====
CREATE TABLE public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests visible to parties" ON public.friend_requests FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "requests send" ON public.friend_requests FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND receiver_id <> auth.uid());
CREATE POLICY "requests update by parties" ON public.friend_requests FOR UPDATE TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "requests delete by parties" ON public.friend_requests FOR DELETE TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE TABLE public.friendships (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);
GRANT SELECT, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships visible" ON public.friendships FOR SELECT TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "friendships delete own" ON public.friendships FOR DELETE TO authenticated USING (user_id = auth.uid() OR friend_id = auth.uid());

-- ===== CONVERSATIONS =====
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = _conversation_id AND user_id = _user_id);
$$;

GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations for members" ON public.conversations FOR SELECT TO authenticated USING (public.is_conversation_member(id, auth.uid()));

GRANT SELECT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members visible to members" ON public.conversation_members FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "members update own" ON public.conversation_members FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members leave" ON public.conversation_members FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages for members" ON public.messages FOR SELECT TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "messages insert by member" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "messages update by member" ON public.messages FOR UPDATE TO authenticated USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "messages delete own" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- ===== NOTIFICATIONS =====
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications delete own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ===== SETTINGS =====
CREATE TABLE public.admin_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
GRANT ALL ON public.admin_settings TO service_role;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.admin_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings founder write" ON public.admin_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'founder')) WITH CHECK (public.has_role(auth.uid(),'founder'));

-- ===== HELPER FUNCTIONS =====
CREATE OR REPLACE FUNCTION public.accept_friend_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.friend_requests;
BEGIN
  SELECT * INTO r FROM public.friend_requests WHERE id = _request_id;
  IF r IS NULL OR r.receiver_id <> auth.uid() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  UPDATE public.friend_requests SET status = 'accepted' WHERE id = _request_id;
  INSERT INTO public.friendships (user_id, friend_id) VALUES (r.sender_id, r.receiver_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.friendships (user_id, friend_id) VALUES (r.receiver_id, r.sender_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (r.sender_id, 'friend_accepted', 'Arkadaşlık isteğin kabul edildi',
          (SELECT COALESCE(display_name, username) FROM public.profiles WHERE id = r.receiver_id) || ' artık arkadaşın.', '/arkadaslar');
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(_friend_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.friendships WHERE (user_id = auth.uid() AND friend_id = _friend_id) OR (user_id = _friend_id AND friend_id = auth.uid());
  DELETE FROM public.friend_requests WHERE (sender_id = auth.uid() AND receiver_id = _friend_id) OR (sender_id = _friend_id AND receiver_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv_id uuid; me uuid := auth.uid();
BEGIN
  IF me IS NULL OR _other_user_id = me THEN RAISE EXCEPTION 'Geçersiz istek'; END IF;
  SELECT cm1.conversation_id INTO conv_id
  FROM public.conversation_members cm1
  JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  WHERE cm1.user_id = me AND cm2.user_id = _other_user_id
  LIMIT 1;
  IF conv_id IS NOT NULL THEN RETURN conv_id; END IF;
  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO conv_id;
  INSERT INTO public.conversation_members (conversation_id, user_id) VALUES (conv_id, me), (conv_id, _other_user_id);
  RETURN conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient uuid; sender_name text;
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  SELECT COALESCE(display_name, username) INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  FOR recipient IN SELECT user_id FROM public.conversation_members WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (recipient, 'message', sender_name || ' mesaj gönderdi', left(NEW.content, 80), '/mesajlar');
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_message_insert AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.on_message_insert();

CREATE OR REPLACE FUNCTION public.on_friend_request_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender_name text;
BEGIN
  SELECT COALESCE(display_name, username) INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.receiver_id, 'friend_request', 'Yeni arkadaşlık isteği', sender_name || ' arkadaşlık isteği gönderdi.', '/arkadaslar');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_friend_request_insert AFTER INSERT ON public.friend_requests FOR EACH ROW EXECUTE FUNCTION public.on_friend_request_insert();

CREATE OR REPLACE FUNCTION public.register_episode_view(_episode_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.episode_views (episode_id, user_id) VALUES (_episode_id, auth.uid());
  UPDATE public.episodes SET view_count = view_count + 1 WHERE id = _episode_id;
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.watch_history (user_id, episode_id) VALUES (auth.uid(), _episode_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.profiles SET last_seen = now() WHERE id = auth.uid();
$$;

-- ===== REALTIME =====
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
