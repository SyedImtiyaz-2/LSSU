"""
Dashboard API — CRUD endpoints consumed by the Next.js dashboard.
"""
from fastapi import APIRouter, Query, HTTPException
from postgrest.exceptions import APIError
from pydantic import BaseModel
from typing import Optional
from app.services.supabase_client import sb as get_sb

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _sb_call(fn):
    """Run a postgrest call and convert APIError → HTTPException so CORS headers survive."""
    try:
        return fn()
    except APIError as e:
        msg = e.args[0] if e.args else str(e)
        hint = ""
        if isinstance(msg, dict) and msg.get("code") == "PGRST106":
            hint = " | Fix: Supabase Dashboard → Settings → API → Exposed schemas → add 'issu'"
        raise HTTPException(status_code=503, detail=str(msg) + hint)


@router.get("/stats", summary="High-level KPIs")
async def get_stats():
    result = _sb_call(lambda: get_sb().table("dashboard_stats").select("*").execute())
    return result.data[0] if result.data else {}


@router.get("/icp-breakdown", summary="Sessions & leads by ICP")
async def get_icp_breakdown():
    result = _sb_call(lambda: get_sb().table("icp_breakdown").select("*").execute())
    return result.data or []


@router.get("/sessions", summary="Paginated list of chat sessions")
async def list_sessions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    icp_id: Optional[int] = None,
    resolved: Optional[bool] = None,
    human_requested: Optional[bool] = None,
):
    def _query():
        q = get_sb().table("chat_sessions").select("*")
        if icp_id is not None:
            q = q.eq("icp_id", icp_id)
        if resolved is not None:
            q = q.eq("resolved", resolved)
        if human_requested is not None:
            q = q.eq("human_requested", human_requested)
        return q.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    result = _sb_call(_query)
    return {"sessions": result.data or [], "offset": offset, "limit": limit}


@router.get("/leads", summary="All captured leads (name+phone+email)")
async def list_leads(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    result = _sb_call(lambda: (
        get_sb()
        .table("chat_sessions")
        .select("session_id, name, phone, email, icp_name, page_slug, referral_source, created_at")
        .not_.is_("name", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    ))
    return {"leads": result.data or [], "offset": offset, "limit": limit}


@router.get("/sessions/{session_id}/messages", summary="Full chat transcript")
async def get_messages(session_id: str):
    session = _sb_call(lambda: get_sb().table("chat_sessions").select("*").eq("session_id", session_id).execute())
    messages = _sb_call(lambda: (
        get_sb().table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    ))
    return {
        "session": session.data[0] if session.data else None,
        "messages": messages.data or [],
    }


class SessionUpdate(BaseModel):
    resolved: Optional[bool] = None
    human_requested: Optional[bool] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    chat_summary: Optional[str] = None


@router.patch("/sessions/{session_id}", summary="Update session fields")
async def update_session(session_id: str, body: SessionUpdate):
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = _sb_call(lambda: (
        get_sb()
        .table("chat_sessions")
        .update(payload)
        .eq("session_id", session_id)
        .execute()
    ))
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    return result.data[0]


@router.delete("/sessions/{session_id}", summary="Delete session and its messages")
async def delete_session(session_id: str):
    # Delete messages first (FK constraint)
    _sb_call(lambda: (
        get_sb()
        .table("chat_messages")
        .delete()
        .eq("session_id", session_id)
        .execute()
    ))
    result = _sb_call(lambda: (
        get_sb()
        .table("chat_sessions")
        .delete()
        .eq("session_id", session_id)
        .execute()
    ))
    return {"deleted": session_id}


@router.get("/recent-activity", summary="Last 10 sessions with snippet")
async def recent_activity():
    result = _sb_call(lambda: (
        get_sb()
        .table("chat_sessions")
        .select("session_id, icp_name, name, email, resolved, human_requested, message_count, created_at")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    ))
    return result.data or []
