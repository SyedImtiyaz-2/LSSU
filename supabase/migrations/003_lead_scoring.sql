-- Migration 003: lead scoring + tagging columns
-- Run in Supabase SQL editor

alter table issu.chat_sessions
  add column if not exists lead_score text
    check (lead_score in ('high', 'medium', 'low')),
  add column if not exists lead_tags  text[] default '{}';

-- Index for filtering leads by score in dashboard
create index if not exists chat_sessions_lead_score_idx
  on issu.chat_sessions (lead_score)
  where lead_score is not null;
