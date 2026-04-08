-- Migration 002: add visitor_id for cross-session memory
-- Run in Supabase SQL editor

alter table issu.chat_sessions
  add column if not exists visitor_id text;

create index if not exists chat_sessions_visitor_idx
  on issu.chat_sessions (visitor_id)
  where visitor_id is not null;
