import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime


# ── Ingest ───────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    icp_id: int   = Field(..., description="ICP numeric ID (1–13)")
    icp_name: str = Field(..., description="ICP label, e.g. 'Nursing Student'")
    source: str   = Field(..., description="Document label, e.g. 'ICP_report'")
    text: str     = Field(..., description="Raw document text to chunk + embed")
    priority: int = Field(default=5, ge=1, le=10, description="Chunk precedence 1=highest 10=lowest")
    doc_type: str = Field(default="general", description="official|brochure|sop|faq|auto-faq|email|general")


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
    visitor_id: Optional[str] = Field(None, description="Persistent browser visitor ID for cross-session memory")
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

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v is None:
            return v
        digits = re.sub(r"\D", "", v)
        if not (len(digits) == 10 or (len(digits) == 11 and digits[0] == "1")):
            raise ValueError("Phone must be a 10-digit US number.")
        return digits[-10:]  # normalise to 10 digits

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if v is None:
            return v
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$", v.strip()):
            raise ValueError("Invalid email format.")
        return v.strip().lower()


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
