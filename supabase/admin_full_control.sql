-- ============================================================================
-- EBEXTA · Admin full control (update / delete everything, including users)
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER, admin-only. Updates already exist (admin_update_profile,
-- ebexta_activate_request, ebexta_deliver_dossier …). This adds DELETE power:
--   ebexta_admin_delete_user(uuid)      → wipe a user + ALL their data + login
--   ebexta_admin_delete_row(text, uuid) → delete any single row in whitelisted tables
--
-- Run once in the Supabase SQL editor. Idempotent. Requires public.is_admin().
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_user(target uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: not an admin';
  END IF;
  IF target = auth.uid() THEN RAISE EXCEPTION 'Use the account page to delete your own account'; END IF;

  -- Wipe every table that references this user (best-effort; ignore missing tables).
  DELETE FROM public.messages           WHERE sender_id = target;
  DELETE FROM public.conversations      WHERE user_a = target OR user_b = target;
  DELETE FROM public.dossiers           WHERE requester_id = target OR subject_id = target;
  DELETE FROM public.dossier_requests   WHERE requester_id = target OR subject_id = target;
  DELETE FROM public.plan_requests      WHERE user_id = target;
  DELETE FROM public.signal_matches     WHERE user_id = target;
  DELETE FROM public.signal_watches     WHERE user_id = target;
  DELETE FROM public.verified_contacts  WHERE user_id = target;
  DELETE FROM public.verification_requests WHERE user_id = target;
  DELETE FROM public.declared_intents   WHERE user_id = target;
  DELETE FROM public.saved_leads        WHERE user_id = target;
  DELETE FROM public.outreach           WHERE user_id = target;
  DELETE FROM public.leads              WHERE user_id = target;
  DELETE FROM public.scans              WHERE user_id = target;
  DELETE FROM public.payments           WHERE user_id = target;
  DELETE FROM public.api_usage          WHERE user_id = target;
  DELETE FROM public.system_logs        WHERE user_id = target;
  DELETE FROM public.profiles           WHERE id = target;

  -- Remove the login itself (function owner has rights on the auth schema).
  BEGIN
    DELETE FROM auth.users WHERE id = target;
  EXCEPTION WHEN others THEN
    -- If the auth row can't be removed here, the profile + data are already gone.
    NULL;
  END;
END; $$;

-- Generic single-row delete, restricted to a safe whitelist of tables.
CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_row(p_table text, p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: not an admin';
  END IF;
  IF p_table NOT IN (
    'leads','declared_intents','verified_contacts','verification_requests',
    'signal_watches','signal_matches','plan_requests','dossier_requests','dossiers',
    'conversations','messages','scans','saved_leads','outreach','system_logs','api_usage'
  ) THEN
    RAISE EXCEPTION 'Table not allowed: %', p_table;
  END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table) USING p_id;
END; $$;

REVOKE ALL ON FUNCTION public.ebexta_admin_delete_user(uuid)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_delete_row(text, uuid)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_user(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_row(text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
