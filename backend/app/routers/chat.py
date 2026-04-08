"""
POST /chat           — main chatbot endpoint (RAG + Claude)
PATCH /chat/session  — update lead fields extracted from conversation
GET  /chat/session/{session_id} — fetch a session + its messages
"""
from fastapi import APIRouter, HTTPException
from postgrest.exceptions import APIError
from app.models import ChatRequest, ChatResponse, LeadUpdate
from app.config import ICP_MAPPING, settings
from app.services.rag import retrieve_context
from app.services.claude_client import get_claude_reply
from app.services.supabase_client import sb as get_sb
from app.services.lead_scoring import compute_score, compute_tags
from app.services.auto_faq import auto_ingest_resolved_session

_ICP_STUDENT_TYPE: dict[int, str] = {
    1: "high-school", 2: "transfer", 3: "transfer-back",
    4: "international", 5: "charter", 6: "indigenous",
    7: "specialized", 8: "specialized", 9: "specialized",
    10: "specialized", 11: "specialized",
    12: "athlete", 13: "athlete",
}

router = APIRouter(prefix="/chat", tags=["chat"])

HANDOFF_REPLY = (
    "That's a great question — and it deserves a precise answer, not a guess. "
    "I'd love to connect you with one of our admissions advisors who can give you "
    "the exact details. Can I schedule a quick call for you? "
    "What's the best number to reach you at?"
)


def _resolve_icp(page_slug: str) -> tuple[int | None, str | None]:
    icp = ICP_MAPPING.get(page_slug)
    if icp:
        return icp["id"], icp["name"]
    return None, None


def _ensure_session(session_id: str, page_slug: str, icp_id: int | None, icp_name: str | None, referral_source: str | None, visitor_id: str | None = None):
    try:
        sb = get_sb()
        existing = sb.table("chat_sessions").select("session_id").eq("session_id", session_id).execute()
        if not existing.data:
            row = {
                "session_id": session_id,
                "page_slug": page_slug,
                "icp_id": icp_id,
                "icp_name": icp_name,
                "referral_source": referral_source,
                "student_type": _ICP_STUDENT_TYPE.get(icp_id, "unknown") if icp_id else "unknown",
            }
            if visitor_id:
                row["visitor_id"] = visitor_id
            sb.table("chat_sessions").insert(row).execute()
    except APIError:
        pass  # session logging is best-effort


def _refresh_lead_score(session_id: str):
    """Recompute and persist lead_score + lead_tags for a session."""
    try:
        sb = get_sb()
        rows = sb.table("chat_sessions").select(
            "name,phone,email,icp_name,message_count,resolved,human_requested"
        ).eq("session_id", session_id).execute().data
        if not rows:
            return
        r = rows[0]
        # Fetch last 20 message contents for topic detection
        msgs = sb.table("chat_messages").select("content").eq(
            "session_id", session_id
        ).order("created_at", desc=True).limit(20).execute().data or []
        texts = [m["content"] for m in msgs]

        score = compute_score(
            name=r.get("name"),
            phone=r.get("phone"),
            email=r.get("email"),
            message_count=r.get("message_count") or 0,
            resolved=r.get("resolved") or False,
            human_requested=r.get("human_requested") or False,
        )
        tags = compute_tags(
            icp_name=r.get("icp_name"),
            message_count=r.get("message_count") or 0,
            conversation_texts=texts,
        )
        sb.table("chat_sessions").update({
            "lead_score": score,
            "lead_tags": tags,
        }).eq("session_id", session_id).execute()
    except APIError:
        pass  # best-effort


def _get_prior_context(visitor_id: str | None, current_session_id: str) -> dict | None:
    """
    Load the most recent prior session for this visitor to inject as context.
    Returns dict with name/email/phone/icp_name/chat_summary or None.
    """
    if not visitor_id:
        return None
    try:
        sb = get_sb()
        rows = (
            sb.table("chat_sessions")
            .select("name,email,phone,icp_name,chat_summary")
            .eq("visitor_id", visitor_id)
            .neq("session_id", current_session_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        if rows:
            r = rows[0]
            # Only return if we actually captured some lead data
            if any(r.get(f) for f in ("name", "email", "phone")):
                return r
    except APIError:
        pass
    return None


def _log_message(session_id: str, role: str, content: str, rag_score: float | None = None, rag_chunks: list | None = None):
    try:
        sb = get_sb()
        sb.table("chat_messages").insert({
            "session_id": session_id,
            "role": role,
            "content": content,
            "rag_score": rag_score,
            "rag_chunks_used": [{"content": c.content[:120], "score": c.similarity} for c in (rag_chunks or [])],
        }).execute()
        # Increment message count
        existing = sb.table("chat_sessions").select("message_count").eq("session_id", session_id).execute().data
        count = (existing[0].get("message_count") or 0) + 1 if existing else 1
        sb.table("chat_sessions").update({"message_count": count}).eq("session_id", session_id).execute()
    except APIError:
        pass  # logging is best-effort


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    icp_id, icp_name = _resolve_icp(req.page_slug)

    # Upsert session row
    _ensure_session(req.session_id, req.page_slug, icp_id, icp_name, req.referral_source, req.visitor_id)

    # Load prior session context for returning visitors
    prior_ctx = _get_prior_context(req.visitor_id, req.session_id)

    # Log incoming user message
    _log_message(req.session_id, "user", req.message)

    # If ICP is unknown — show program menu grouped by category
    if icp_id is None:
        reply = (
            "Hi! I'm **Laker**, your LSSU admissions guide. Which program are you interested in?\n\n"
            "**Undergraduate Programs**\n"
            "• Traditional entry (high school → LSSU)\n"
            "• Transfer from a community college\n"
            "• Transfer back (returning to LSSU or coming home)\n\n"
            "**Specialized Degrees**\n"
            "• Nursing\n"
            "• Robotics Engineering\n"
            "• Fire Science\n"
            "• Fisheries & Wildlife\n"
            "• Cannabis Business & Chemistry\n\n"
            "**Student Backgrounds**\n"
            "• Canadian / cross-border student\n"
            "• Charter school graduate\n"
            "• Indigenous / Anishinaabe scholar\n"
            "• Collegiate hockey athlete\n\n"
            "Just tell me which fits you best and I'll pull up everything you need!"
        )
        _log_message(req.session_id, "assistant", reply)
        return ChatResponse(
            reply=reply,
            session_id=req.session_id,
            icp_id=None,
            icp_name=None,
        )

    # ── RAG retrieval ────────────────────────────────────────────────────────
    chunks, top_score = await retrieve_context(
        question=req.message,
        icp_id=icp_id,
        top_k=settings.rag_top_k,
        threshold=settings.rag_confidence_threshold,
    )

    # ── Confidence gate ──────────────────────────────────────────────────────
    if top_score is None or top_score < settings.rag_confidence_threshold:
        # No confident context — trigger human handoff
        sb = get_sb()
        sb.table("chat_sessions").update({
            "human_requested": True,
            "unresolved_query": req.message,
        }).eq("session_id", req.session_id).execute()

        _log_message(req.session_id, "assistant", HANDOFF_REPLY, rag_score=top_score)
        _refresh_lead_score(req.session_id)
        return ChatResponse(
            reply=HANDOFF_REPLY,
            session_id=req.session_id,
            icp_id=icp_id,
            icp_name=icp_name,
            rag_score=top_score,
            human_handoff=True,
        )

    # ── Claude call ──────────────────────────────────────────────────────────
    reply = await get_claude_reply(
        page_slug=req.page_slug,
        icp_id=icp_id,
        history=req.history,
        user_message=req.message,
        rag_chunks=chunks,
        prior_context=prior_ctx,
    )

    _log_message(req.session_id, "assistant", reply, rag_score=top_score, rag_chunks=chunks)
    _refresh_lead_score(req.session_id)

    return ChatResponse(
        reply=reply,
        session_id=req.session_id,
        icp_id=icp_id,
        icp_name=icp_name,
        rag_score=top_score,
        human_handoff=False,
    )


@router.patch("/session", summary="Update lead fields from a session")
async def update_session(payload: LeadUpdate):
    sb = get_sb()
    update_data = {k: v for k, v in payload.model_dump().items() if k != "session_id" and v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update.")
    sb.table("chat_sessions").update(update_data).eq("session_id", payload.session_id).execute()

    # When a session is resolved, auto-ingest Q&A pairs into the KB
    if payload.resolved is True:
        _refresh_lead_score(payload.session_id)
        await auto_ingest_resolved_session(payload.session_id)

    return {"message": "Session updated.", "fields": list(update_data.keys())}


@router.get("/session/{session_id}", summary="Fetch session + messages")
async def get_session(session_id: str):
    sb = get_sb()
    session = sb.table("chat_sessions").select("*").eq("session_id", session_id).execute()
    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found.")
    messages = (
        sb.table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
        .data or []
    )
    return {"session": session.data[0], "messages": messages}
