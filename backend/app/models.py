from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


# ── Ingest ───────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    icp_id: int   = Field(..., description="ICP numeric ID (1–13)")
    icp_name: str = Field(..., description="ICP label, e.g. 'Nursing Student'")
    source: str   = Field(..., description="Document label, e.g. 'ICP_report'")
    text: str     = Field(..., description="Raw document text to chunk + embed")


class IngestResponse(BaseModel):
    chunks_stored: int
    icp_id: int
    icp_name: str
    message: str


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str     # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    session_id: str   = Field(..., description="Unique conversation ID")
    page_slug: str    = Field(..., description="Landing page slug for ICP detection")
    message: str      = Field(..., description="Student's current message")
    history: List[ChatMessage] = Field(default=[], description="Prior messages in this session")
    referral_source: Optional[str] = None


class RAGChunk(BaseModel):
    content: str
    similarity: float
    source: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    icp_id: Optional[int]    = None
    icp_name: Optional[str]  = None
    rag_score: Optional[float] = None
    human_handoff: bool = False
    lead_update: Optional[dict] = None   # partial lead fields extracted this turn


# ── Lead / Session ───────────────────────────────────────────────────────────

class LeadUpdate(BaseModel):
    session_id: str
    name: Optional[str]  = None
    phone: Optional[str] = None
    email: Optional[str] = None
    resolved: Optional[bool] = None
    human_requested: Optional[bool] = None
    unresolved_query: Optional[str] = None
    chat_summary: Optional[str] = None


class SessionRecord(BaseModel):
    session_id: str
    page_slug: Optional[str]
    icp_id: Optional[int]
    icp_name: Optional[str]
    referral_source: Optional[str]
    name: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    resolved: bool
    human_requested: bool
    unresolved_query: Optional[str]
    chat_summary: Optional[str]
    message_count: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


class MessageRecord(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    rag_score: Optional[float]
    created_at: Optional[datetime]


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_sessions: int
    resolved_sessions: int
    escalated_sessions: int
    leads_with_email: int
    leads_with_phone: int
    leads_with_name: int
    resolution_rate_pct: Optional[float]
    total_messages: int


class ICPBreakdown(BaseModel):
    icp_id: Optional[int]
    icp_name: str
    total_sessions: int
    leads_captured: int
    resolution_rate_pct: Optional[float]
