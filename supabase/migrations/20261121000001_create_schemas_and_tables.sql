-- Migration: 20261121000001_create_schemas_and_tables.sql
-- Description: Creates schemas, default privilege revokes, and base tables with column constraints and indexes.

-- 1. Create Private Schema (internal helpers, rate limits; hidden from PostgREST API)
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Revoke Default Privileges for Future Tables and Functions (Defense-in-depth backstop)
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- 3. Unified Rate Limits Table (Private Schema)
CREATE TABLE private.rate_limits (
  key text PRIMARY KEY,
  count int NOT NULL,
  window_start timestamptz NOT NULL
);

-- 4. Profiles Table (Auth Users mapping)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text NOT NULL CHECK (length(trim(display_name)) >= 1 AND length(display_name) <= 50),
  username_set boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NULL
);

-- 5. Conversations Table
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'direct' CHECK (kind = 'direct')
);

CREATE INDEX conversations_created_at_idx ON public.conversations (created_at DESC);

-- 6. Conversation Members Table
CREATE TABLE public.conversation_members (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX conversation_members_user_id_idx ON public.conversation_members (user_id);

-- 7. Direct Conversation Pairs (Physical Uniqueness & Concurrency Lock Mapping)
CREATE TABLE public.direct_conversation_pairs (
  conversation_id uuid PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_low_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_high_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT direct_conversation_pairs_order CHECK (user_low_id < user_high_id),
  CONSTRAINT direct_conversation_pairs_unique UNIQUE (user_low_id, user_high_id)
);

-- 8. Messages Table
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  body text NOT NULL CHECK (length(trim(body)) >= 1 AND length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_sender_client_unique UNIQUE (sender_id, client_id)
);

-- Composite index for keyset pagination and lateral queries
CREATE INDEX messages_cursor_idx ON public.messages (conversation_id, created_at DESC, id DESC);

-- 9. Blocks Table
CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX blocks_blocked_id_idx ON public.blocks (blocked_id);

-- 10. Reports Table
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (length(trim(reason)) >= 3 AND length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_target_check CHECK (message_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX reports_reporter_created_idx ON public.reports (reporter_id, created_at DESC);

-- 11. Base Table Access Control: Revoke ALL first
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;

-- 12. Explicit Minimal Grants to Authenticated
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.conversation_members TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT SELECT ON public.reports TO authenticated;

-- Note:
-- - Direct INSERT into public.messages is REVOKED (send_message is the sole writer).
-- - Direct INSERT into public.reports is REVOKED (report_content is the sole writer).
-- - public.direct_conversation_pairs and private.rate_limits have NO access grants.
-- - public.profiles has NO direct INSERT or DELETE grants, and UPDATE is column-restricted to display_name only.

-- 13. Enable Row-Level Security on EVERY table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversation_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.rate_limits ENABLE ROW LEVEL SECURITY;
