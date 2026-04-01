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


def _ensure_session(session_id: str, page_slug: str, icp_id: int | None, icp_name: str | None, referral_source: str | None):
    try:
        sb = get_sb()
        existing = sb.table("chat_sessions").select("session_id").eq("session_id", session_id).execute()
        if not existing.data:
            sb.table("chat_sessions").insert({
            "session_id": session_id,
            "page_slug": page_slug,
            "icp_id": icp_id,
            "icp_name": icp_name,
            "referral_source": referral_source,
        }).execute()
    except APIError:
        pass  # session logging is best-effort


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
    _ensure_session(req.session_id, req.page_slug, icp_id, icp_name, req.referral_source)

    # Log incoming user message
    _log_message(req.session_id, "user", req.message)

    # If ICP is unknown we can't do targeted RAG — ask to clarify
    if icp_id is None:
        reply = (
            "Hi! I'm Laker, your LSSU admissions guide. "
            "I wasn't able to detect your program of interest from this page. "
            "Which program or area are you most interested in?"
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
    )

    _log_message(req.session_id, "assistant", reply, rag_score=top_score, rag_chunks=chunks)

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
