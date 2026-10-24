-- ============================================================================
-- EBEXTA · Company Community & Business Network Database Schema
-- ----------------------------------------------------------------------------
-- Fixes table dependency order so RLS policy compilation succeeds cleanly.
-- ============================================================================

-- ── 0. HELPER FUNCTIONS ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;


-- ── 1. CREATE ALL TABLES FIRST (TO PREVENT RLS RELATION ERRORS) ──────────────

-- 1.1 COMMUNITY GROUPS
CREATE TABLE IF NOT EXISTS public.community_groups (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  logo_url      TEXT,
  cover_url     TEXT,
  is_private    BOOLEAN DEFAULT false,
  creator_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  members_count INT DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 1.2 COMMUNITY GROUP MEMBERS
CREATE TABLE IF NOT EXISTS public.community_group_members (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id   UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status     TEXT DEFAULT 'approved' CHECK (status IN ('approved', 'pending')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- 1.3 COMMUNITY POSTS
CREATE TABLE IF NOT EXISTS public.community_posts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name    TEXT,
  company_logo    TEXT,
  post_type       TEXT NOT NULL CHECK (post_type IN ('news', 'product', 'hiring', 'partnership', 'funding', 'announcement', 'update')),
  content         TEXT NOT NULL,
  image_url       TEXT,
  video_url       TEXT,
  link_url        TEXT,
  group_id        UUID REFERENCES public.community_groups(id) ON DELETE CASCADE,
  likes_count     INT DEFAULT 0,
  comments_count  INT DEFAULT 0,
  is_verified     BOOLEAN DEFAULT false,
  data_origin     TEXT DEFAULT 'company_provided' CHECK (data_origin IN ('company_provided', 'ebexta_verified', 'ai_generated', 'public_data')),
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 1.4 POST REACTIONS
CREATE TABLE IF NOT EXISTS public.community_post_reactions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id       UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT DEFAULT 'like' CHECK (reaction_type IN ('like', 'celebrate', 'insightful', 'handshake')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- 1.5 POST COMMENTS
CREATE TABLE IF NOT EXISTS public.community_post_comments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  parent_id  UUID REFERENCES public.community_post_comments(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.6 COMPANY CONNECTIONS
CREATE TABLE IF NOT EXISTS public.company_connections (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_diff_users CHECK (requester_id <> receiver_id)
);

-- 1.7 COMPANY FOLLOWS
CREATE TABLE IF NOT EXISTS public.company_follows (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (follower_id, target_user_id)
);

-- 1.8 NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.community_notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('connection_request', 'connection_accepted', 'new_message', 'group_invite', 'group_join_request', 'post_reaction', 'comment', 'mention')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  link       TEXT,
  read       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1.9 MODERATION & REPORTS
CREATE TABLE IF NOT EXISTS public.community_reports (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'user', 'company', 'group')),
  target_id   UUID NOT NULL,
  reason      TEXT NOT NULL,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 1.10 USER BLOCKS
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);


-- ── 2. INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_group ON public.community_posts (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON public.community_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON public.community_post_reactions (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON public.community_post_comments (post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.company_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_target ON public.company_follows (target_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.community_notifications (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_connection_pair
  ON public.company_connections (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id));


-- ── 3. ROW LEVEL SECURITY & POLICIES ────────────────────────────────────────

-- 3.1 GROUPS RLS
ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_read_all" ON public.community_groups;
CREATE POLICY "groups_read_all" ON public.community_groups
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "groups_insert_creator" ON public.community_groups;
CREATE POLICY "groups_insert_creator" ON public.community_groups
  FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "groups_update_admin" ON public.community_groups;
CREATE POLICY "groups_update_admin" ON public.community_groups
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() OR public.is_admin());


-- 3.2 GROUP MEMBERS RLS
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_members_read" ON public.community_group_members;
CREATE POLICY "group_members_read" ON public.community_group_members
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "group_members_insert" ON public.community_group_members;
CREATE POLICY "group_members_insert" ON public.community_group_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "group_members_update" ON public.community_group_members;
CREATE POLICY "group_members_update" ON public.community_group_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.community_groups g WHERE g.id = group_id AND g.creator_id = auth.uid()
  ));

DROP POLICY IF EXISTS "group_members_delete" ON public.community_group_members;
CREATE POLICY "group_members_delete" ON public.community_group_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.community_groups g WHERE g.id = group_id AND g.creator_id = auth.uid()
  ));


-- 3.3 POSTS RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_read_public" ON public.community_posts;
CREATE POLICY "posts_read_public" ON public.community_posts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      group_id IS NULL OR EXISTS (
        SELECT 1 FROM public.community_groups g
        WHERE g.id = community_posts.group_id AND (
          g.is_private = false OR EXISTS (
            SELECT 1 FROM public.community_group_members m
            WHERE m.group_id = g.id AND m.user_id = auth.uid() AND m.status = 'approved'
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "posts_insert_own" ON public.community_posts;
CREATE POLICY "posts_insert_own" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "posts_update_own" ON public.community_posts;
CREATE POLICY "posts_update_own" ON public.community_posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "posts_delete_own" ON public.community_posts;
CREATE POLICY "posts_delete_own" ON public.community_posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());


-- 3.4 POST REACTIONS RLS
ALTER TABLE public.community_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_read_all" ON public.community_post_reactions;
CREATE POLICY "reactions_read_all" ON public.community_post_reactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reactions_insert_own" ON public.community_post_reactions;
CREATE POLICY "reactions_insert_own" ON public.community_post_reactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reactions_delete_own" ON public.community_post_reactions;
CREATE POLICY "reactions_delete_own" ON public.community_post_reactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());


-- 3.5 POST COMMENTS RLS
ALTER TABLE public.community_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_read_all" ON public.community_post_comments;
CREATE POLICY "comments_read_all" ON public.community_post_comments
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "comments_insert_own" ON public.community_post_comments;
CREATE POLICY "comments_insert_own" ON public.community_post_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comments_delete_own" ON public.community_post_comments;
CREATE POLICY "comments_delete_own" ON public.community_post_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());


-- 3.6 COMPANY CONNECTIONS RLS
ALTER TABLE public.company_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "connections_read_participants" ON public.company_connections;
CREATE POLICY "connections_read_participants" ON public.company_connections
  FOR SELECT TO authenticated
  USING (auth.uid() IN (requester_id, receiver_id) OR public.is_admin());

DROP POLICY IF EXISTS "connections_insert_requester" ON public.company_connections;
CREATE POLICY "connections_insert_requester" ON public.company_connections
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "connections_update_participants" ON public.company_connections;
CREATE POLICY "connections_update_participants" ON public.company_connections
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (requester_id, receiver_id));

DROP POLICY IF EXISTS "connections_delete_participants" ON public.company_connections;
CREATE POLICY "connections_delete_participants" ON public.company_connections
  FOR DELETE TO authenticated
  USING (auth.uid() IN (requester_id, receiver_id));


-- 3.7 COMPANY FOLLOWS RLS
ALTER TABLE public.company_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_read_all" ON public.company_follows;
CREATE POLICY "follows_read_all" ON public.company_follows
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "follows_insert_own" ON public.company_follows;
CREATE POLICY "follows_insert_own" ON public.company_follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS "follows_delete_own" ON public.company_follows;
CREATE POLICY "follows_delete_own" ON public.company_follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());


-- 3.8 NOTIFICATIONS RLS
ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own" ON public.community_notifications;
CREATE POLICY "notifications_own" ON public.community_notifications
  FOR ALL TO authenticated USING (user_id = auth.uid());


-- 3.9 REPORTS & BLOCKS RLS
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_own" ON public.community_reports;
CREATE POLICY "reports_insert_own" ON public.community_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_read_admin" ON public.community_reports;
CREATE POLICY "reports_read_admin" ON public.community_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.is_admin());

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_own" ON public.user_blocks;
CREATE POLICY "blocks_own" ON public.user_blocks
  FOR ALL TO authenticated USING (blocker_id = auth.uid());


-- ── 4. TRIGGERS & FUNCTIONS ──────────────────────────────────────────────────

-- Trigger to maintain likes_count on posts
CREATE OR REPLACE FUNCTION public.tg_update_post_likes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS tr_post_likes ON public.community_post_reactions;
CREATE TRIGGER tr_post_likes AFTER INSERT OR DELETE ON public.community_post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_update_post_likes();

-- Trigger to maintain comments_count on posts
CREATE OR REPLACE FUNCTION public.tg_update_post_comments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.community_posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS tr_post_comments ON public.community_post_comments;
CREATE TRIGGER tr_post_comments AFTER INSERT OR DELETE ON public.community_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_update_post_comments();


-- ── 5. REALTIME PUBLICATION SETUP ───────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.company_connections;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;


-- ── 6. HELPER RPC FUNCTIONS ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ebexta_join_group(p_group_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_private boolean;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  SELECT is_private INTO v_is_private FROM public.community_groups WHERE id = p_group_id;
  IF v_is_private IS NULL THEN RAISE EXCEPTION 'Group not found'; END IF;
  
  IF v_is_private THEN
    v_status := 'pending';
  ELSE
    v_status := 'approved';
  END IF;
  
  INSERT INTO public.community_group_members (group_id, user_id, status)
  VALUES (p_group_id, auth.uid(), v_status)
  ON CONFLICT (group_id, user_id) DO UPDATE SET status = EXCLUDED.status;

  IF v_status = 'approved' THEN
    UPDATE public.community_groups SET members_count = members_count + 1 WHERE id = p_group_id;
  END IF;

  RETURN v_status;
END; $$;

GRANT EXECUTE ON FUNCTION public.ebexta_join_group(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
