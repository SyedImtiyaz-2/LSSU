-- Migration 004: student_type segmentation + demand signals view
-- Run in Supabase SQL editor

-- ─────────────────────────────────────────
-- student_type: derived from icp_id
-- ─────────────────────────────────────────
alter table issu.chat_sessions
  add column if not exists student_type text;

-- Populate existing rows
update issu.chat_sessions set student_type =
  case icp_id
    when 1  then 'high-school'
    when 2  then 'transfer'
    when 3  then 'transfer-back'
    when 4  then 'international'
    when 5  then 'charter'
    when 6  then 'indigenous'
    when 7  then 'specialized'
    when 8  then 'specialized'
    when 9  then 'specialized'
    when 10 then 'specialized'
    when 11 then 'specialized'
    when 12 then 'athlete'
    when 13 then 'athlete'
    else 'unknown'
  end
where student_type is null;

create index if not exists chat_sessions_student_type_idx
  on issu.chat_sessions (student_type);

-- ─────────────────────────────────────────
-- VIEW: student_type_breakdown
-- ─────────────────────────────────────────
create or replace view issu.student_type_breakdown as
select
  coalesce(student_type, 'unknown')            as student_type,
  count(*)                                      as total_sessions,
  count(*) filter (where email is not null)     as leads_captured,
  count(*) filter (where resolved = true)       as resolved_sessions,
  round(
    count(*) filter (where resolved = true)::numeric /
    nullif(count(*), 0) * 100, 1
  )                                             as resolution_rate_pct,
  avg(message_count)::numeric(6,1)              as avg_messages
from issu.chat_sessions
group by student_type
order by total_sessions desc;

-- ─────────────────────────────────────────
-- VIEW: program_demand_signals
-- Sessions + escalations + unresolved per ICP = demand + gap signals
-- ─────────────────────────────────────────
create or replace view issu.program_demand_signals as
select
  icp_id,
  coalesce(icp_name, 'Unknown')                           as program,
  count(*)                                                as total_sessions,
  count(*) filter (where human_requested = true)          as escalations,
  count(*) filter (where unresolved_query is not null)    as unresolved_questions,
  round(
    count(*) filter (where human_requested = true)::numeric /
    nullif(count(*), 0) * 100, 1
  )                                                       as escalation_rate_pct,
  round(
    count(*) filter (where resolved = true)::numeric /
    nullif(count(*), 0) * 100, 1
  )                                                       as resolution_rate_pct,
  count(*) filter (where lead_score = 'high')             as high_intent_leads,
  count(*) filter (where lead_score = 'medium')           as medium_intent_leads
from issu.chat_sessions
where icp_name is not null
group by icp_id, icp_name
order by total_sessions desc;
