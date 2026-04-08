-- Migration 005: knowledge base document ranking + precedence
-- priority: 1 = highest precedence, 10 = lowest
-- doc_type: official | brochure | sop | faq | auto-faq | email

alter table issu.knowledge_chunks
  add column if not exists priority  int  not null default 5
    check (priority between 1 and 10),
  add column if not exists doc_type  text not null default 'general';

-- Index for fast priority-filtered queries
create index if not exists knowledge_chunks_priority_idx
  on issu.knowledge_chunks (icp_id, priority);

-- Updated vector search: blends cosine similarity with priority boost
-- Higher priority (lower number) nudges chunks up in ranking.
-- Boost formula: similarity + (10 - priority) * 0.01
--   priority 1 → +0.09 boost  (official docs surface first)
--   priority 5 → +0.05 boost  (default)
--   priority 10 → +0.00 boost (auto-faq, last resort)
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
  doc_type    text,
  priority    int,
  similarity  float
)
language sql stable as $$
  select
    id,
    content,
    icp_name,
    source,
    doc_type,
    priority,
    (1 - (embedding <=> query_embedding))
      + (10 - priority) * 0.01               as similarity
  from issu.knowledge_chunks
  where icp_id = icp_filter
    and (1 - (embedding <=> query_embedding)) > match_threshold
  order by similarity desc
  limit match_count;
$$;
