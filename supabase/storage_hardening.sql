-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · Storage hardening enforce chat-attachment file limits server-side
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- PROBLEM: the chat-attachments bucket had NO size cap and NO allowed-MIME list,
-- so a user could upload arbitrarily large files (storage/cost DoS) or active
-- content (HTML/SVG with script). Client-side checks alone are bypassable.
--
-- FIX: enforce a 10 MB cap and a safe MIME allowlist at the bucket level this
-- is applied by Supabase Storage on every upload regardless of the client. SVG
-- and HTML are intentionally excluded (script-bearing). The bucket stays PRIVATE
-- (served only via short-lived signed URLs from *.supabase.co, not the app
-- domain), and participant-scoped RLS is unchanged.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE storage.buckets
SET
  file_size_limit = 10485760,  -- 10 MB
  allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
WHERE id = 'chat-attachments';

-- Verify:
--   SELECT id, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets WHERE id = 'chat-attachments';
