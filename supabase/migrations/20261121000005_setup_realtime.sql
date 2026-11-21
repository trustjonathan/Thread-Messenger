-- Migration: 20261121000005_setup_realtime.sql
-- Description: Adds messages table to supabase_realtime publication for client live updates.

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
