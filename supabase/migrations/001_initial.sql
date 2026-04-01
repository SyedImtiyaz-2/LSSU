-- LSSU ICP Chatbot — Supabase Schema v1.0
-- Run this in your Supabase SQL editor (project: ksxozkgrmqbsxzzxiscx)

-- Enable pgvector extension (must be in public schema)
create extension if not exists vector with schema extensions;

-- ─────────────────────────────────────────
-- SCHEMA
-- ─────────────────────────────────────────
create schema if not exists issu;

-- Grant usage to authenticated and anon roles
grant usage on schema issu to anon, authenticated, service_role;
grant all privileges on all tables in schema issu to anon, authenticated, service_role;
grant all privileges on all sequences in schema issu to anon, authenticated, service_role;
alter default privileges in schema issu grant all on tables to anon, authenticated, service_role;
alter default privileges in schema issu grant all on sequences to anon, authenticated, service_role;

-- ─────────────────────────────────────────
-- EXPOSE SCHEMA TO POSTGREST (Data API)
-- ─────────────────────────────────────────
-- This makes the 'issu' schema accessible via the Supabase REST API.
-- After running this SQL, you ALSO need to go to:
--   Supabase Dashboard → Settings → API → "Exposed schemas"
--   and add "issu" to the list, then Save.
-- (The SQL below handles the Postgres side; the dashboard toggle handles PostgREST config reload.)
alter role authenticator set pgrst.db_schemas to 'public,issu';
notify pgrst, 'reload config';

-- Set search path for this session
set search_path to issu, extensions, public;

-- ─────────────────────────────────────────
-- KNOWLEDGE CHUNKS (RAG vector store)
-- ─────────────────────────────────────────
create table if not exists issu.knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  icp_id      int  not null,
  icp_name    text not null,
  content     text not null,
  embedding   extensions.vector(1536),   -- OpenAI text-embedding-3-small
  source      text,                       -- e.g. "ICP_report" | "USP_report"
  chunk_index int,
  created_at  timestamptz default now()
);

-- IVFFlat index for cosine similarity (tune lists ≈ rows/1000, min 10)
create index if not exists knowledge_chunks_embedding_idx
  on issu.knowledge_chunks using ivfflat (embedding extensions.vector_cosine_ops)
  with (lists = 20);

-- Fast ICP-first filter
create index if not exists knowledge_chunks_icp_idx
  on issu.knowledge_chunks (icp_id);

-- ─────────────────────────────────────────
-- CHAT SESSIONS (one row per conversation)
-- ─────────────────────────────────────────
create table if not exists issu.chat_sessions (
  id               uuid primary key default gen_random_uuid(),
  session_id       text unique not null,
  page_slug        text,
  icp_id           int,
  icp_name         text,
  referral_source  text,
  -- Lead capture
  name             text,
  phone            text,
  email            text,
  -- Resolution
  resolved         boolean default false,
  human_requested  boolean default false,
  unresolved_query text,
  chat_summary     text,
  message_count    int default 0,
  -- Timestamps
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists chat_sessions_icp_idx      on issu.chat_sessions (icp_id);
create index if not exists chat_sessions_created_idx  on issu.chat_sessions (created_at desc);
create index if not exists chat_sessions_resolved_idx on issu.chat_sessions (resolved);

-- ─────────────────────────────────────────
-- CHAT MESSAGES
-- ─────────────────────────────────────────
create table if not exists issu.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  session_id      text references issu.chat_sessions(session_id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  rag_score       float,
  rag_chunks_used jsonb,
  created_at      timestamptz default now()
);

create index if not exists chat_messages_session_idx  on issu.chat_messages (session_id);
create index if not exists chat_messages_created_idx  on issu.chat_messages (created_at);

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at on chat_sessions
-- ─────────────────────────────────────────
create or replace function issu.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_sessions_updated_at on issu.chat_sessions;
create trigger chat_sessions_updated_at
  before update on issu.chat_sessions
  for each row execute procedure issu.update_updated_at();

-- ─────────────────────────────────────────
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ─────────────────────────────────────────
create or replace function issu.match_knowledge_chunks(
  query_embedding  extensions.vector(1536),
  icp_filter       int,
  match_threshold  float default 0.70,
  match_count      int   default 3
)
returns table (
  id          uuid,
  content     text,
  icp_name    text,
  source      text,
  similarity  float
)
language sql stable as $$
  select
    id,
    content,
    icp_name,
    source,
    1 - (embedding <=> query_embedding) as similarity
  from issu.knowledge_chunks
  where icp_id = icp_filter
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────
-- DASHBOARD STATS VIEW
-- ─────────────────────────────────────────
create or replace view issu.dashboard_stats as
select
  count(*)                                             as total_sessions,
  count(*) filter (where resolved = true)              as resolved_sessions,
  count(*) filter (where human_requested = true)       as escalated_sessions,
  count(*) filter (where email is not null)            as leads_with_email,
  count(*) filter (where phone is not null)            as leads_with_phone,
  count(*) filter (where name  is not null)            as leads_with_name,
  round(
    count(*) filter (where resolved = true)::numeric /
    nullif(count(*), 0) * 100, 1
  )                                                    as resolution_rate_pct,
  sum(message_count)                                   as total_messages
from issu.chat_sessions;

-- ICP breakdown view
create or replace view issu.icp_breakdown as
select
  icp_id,
  icp_name,
  count(*)                                             as total_sessions,
  count(*) filter (where email is not null)            as leads_captured,
  round(
    count(*) filter (where resolved = true)::numeric /
    nullif(count(*), 0) * 100, 1
  )                                                    as resolution_rate_pct
from issu.chat_sessions
where icp_name is not null
group by icp_id, icp_name
order by total_sessions desc;
