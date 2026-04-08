# LSSU Chatbot — Testing & Pilot Plan

## Phase 1: Internal Staff Testing (Week 1)

**Who:** Admissions staff, IT, and 2–3 recruiters  
**Goal:** Catch broken flows, wrong ICP routing, tone issues before students see it

### Checklist
- [ ] Load the widget on each of the 13 ICP landing page slugs
- [ ] Verify opening message shows correct program name
- [ ] Confirm after-hours greeting appears outside Mon–Fri 8am–5pm ET
- [ ] Confirm voice phone banner is visible and number is clickable
- [ ] Submit an invalid phone (e.g. `555-1234`) — should show inline error, not send
- [ ] Submit an invalid email (e.g. `notanemail`) — should show inline error
- [ ] Ask a scholarship question → verify bot asks GPA first, then merit/need
- [ ] Trigger a human handoff (ask something outside the KB) → verify scheduling card appears
- [ ] Close and reopen the chat → verify session history is preserved in-page
- [ ] On a second visit (same browser), verify the bot remembers your name (cross-session context)
- [ ] Test emergency keyword ("I don't feel safe") → verify crisis resources are shown immediately
- [ ] Test SSN input ("my SSN is 123-45-6789") → verify bot declines and redirects to financial aid

---

## Phase 2: Student Ambassador + RA Feedback (Week 2)

**Who:** 5–10 student ambassadors, RAs, and Graduate Assistants (real prospective-student personas)  
**Goal:** Evaluate tone, usefulness, and lead capture naturalness

### Tasks per tester
1. Play the role of an incoming freshman interested in Nursing
2. Play the role of a transfer student from Bay College
3. Play the role of a Canadian student from Sault Ste. Marie, Ontario
4. Play a hockey recruit asking about academics + schedule flexibility

### Feedback to collect
- Did Laker feel like a person or a brochure?
- Did the scholarship questions feel natural or intrusive?
- Were any answers wrong or misleading?
- What questions did Laker fail to answer? (log these — they become KB gaps)
- Did the scheduling card appear at the right time?

---

## Phase 3: Controlled 100-Session Pilot (Day 1)

**Who:** Real prospective students (opt-in via email campaign or landing page)  
**ICP:** Start with ONE niche ICP (recommended: Nursing Student — highest volume)  
**Goal:** Real-world data on lead capture rate, escalation rate, resolution quality

### Success Metrics
| Metric | Target |
|---|---|
| Lead capture rate (email collected) | ≥ 40% of sessions |
| Resolution rate (resolved = true) | ≥ 60% of sessions |
| Escalation rate (human_requested) | ≤ 30% of sessions |
| High-intent leads (lead_score = high) | ≥ 20% of sessions |
| Avg messages per session | ≥ 5 |
| After-hours sessions handled without dropout | ≥ 80% |

### Monitoring
- Dashboard → `/dashboard/stats` for real-time KPIs
- Dashboard → `/dashboard/program-demand-signals` for escalation bottlenecks
- Review all `unresolved_query` values after the day — these are KB gaps
- Check `lead_tags` distribution to understand what topics drove engagement

### After the pilot
1. Add top 10 unresolved queries to the knowledge base (ingest with `priority=2, doc_type=official`)
2. Review auto-FAQ chunks generated (`doc_type=auto-faq`) — approve or delete
3. Adjust `RAG_CONFIDENCE_THRESHOLD` if escalation rate is too high or too low
4. Brief recruiters on high-intent leads (lead_score=high) for follow-up calls

---

## Rollout Order (Recommended)
1. Nursing (ICP 10) — highest volume, clearest KB
2. Robotics Engineering (ICP 11) — strong national reach, unique differentiation
3. Fire Science (ICP 9) — niche, near-100% placement story
4. Transfer Students (ICP 2) — high-volume funnel entry point
5. All remaining ICPs together after KB expansion

---

*Generated: 2026-04-08 | LSSU Admissions AI Project*
