-- ============================================================================
-- EBEXTA AI Native Intelligence Layer Schema
-- Covers conversation persistence, structured response messages, and action audit logging.
-- ============================================================================

-- 1. AI Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title               TEXT DEFAULT 'New Conversation',
  context_page        TEXT,
  context_entity_id   TEXT,
  context_entity_type TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- 2. AI Messages with structured card payloads
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id     UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender              TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
  content             TEXT NOT NULL,
  intent              TEXT,
  confidence          TEXT DEFAULT 'HIGH' CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  response_type       TEXT DEFAULT 'TEXT' CHECK (response_type IN ('TEXT', 'CARD', 'TABLE', 'ACTION_CONFIRM', 'EXPERT', 'METRICS')),
  structured_data     JSONB,
  tool_calls          JSONB,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- 3. AI Action Audit Log
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  conversation_id     UUID,
  action_name         TEXT NOT NULL,
  parameters          JSONB,
  target_entity_type  TEXT,
  target_entity_id    TEXT,
  before_state        JSONB,
  after_state         JSONB,
  status              TEXT DEFAULT 'executed' CHECK (status IN ('previewed', 'confirmed', 'executed', 'rejected', 'failed')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON public.ai_audit_logs(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "ai_conversations_own_select" ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_own_insert" ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_own_update" ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_own_delete" ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_admin_all"   ON public.ai_conversations;

DROP POLICY IF EXISTS "ai_messages_own_select" ON public.ai_messages;
DROP POLICY IF EXISTS "ai_messages_own_insert" ON public.ai_messages;
DROP POLICY IF EXISTS "ai_messages_admin_all"   ON public.ai_messages;

DROP POLICY IF EXISTS "ai_audit_own_select" ON public.ai_audit_logs;
DROP POLICY IF EXISTS "ai_audit_own_insert" ON public.ai_audit_logs;
DROP POLICY IF EXISTS "ai_audit_admin_all"   ON public.ai_audit_logs;

-- Policies for ai_conversations
CREATE POLICY "ai_conversations_own_select" ON public.ai_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_own_insert" ON public.ai_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_own_update" ON public.ai_conversations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_conversations_own_delete" ON public.ai_conversations
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "ai_conversations_admin_all" ON public.ai_conversations
  FOR ALL USING (public.is_admin());

-- Policies for ai_messages
CREATE POLICY "ai_messages_own_select" ON public.ai_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_messages_own_insert" ON public.ai_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_messages_admin_all" ON public.ai_messages
  FOR ALL USING (public.is_admin());

-- Policies for ai_audit_logs
CREATE POLICY "ai_audit_own_select" ON public.ai_audit_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_audit_own_insert" ON public.ai_audit_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_audit_admin_all" ON public.ai_audit_logs
  FOR ALL USING (public.is_admin());
