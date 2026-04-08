"""
Auto-FAQ service: when a session is resolved, extract clean Q&A pairs
from the conversation and ingest them back into the knowledge base
as low-priority "auto-faq" chunks.

This reduces repetition — frequently-asked questions get answered
directly from the KB instead of always hitting Claude.
"""
from postgrest.exceptions import APIError
from app.services.supabase_client import sb as get_sb


_MIN_USER_LEN  = 10   # ignore very short user messages
_MIN_BOT_LEN   = 40   # ignore very short bot replies
_MAX_PAIRS     = 5    # store at most 5 Q&A pairs per session
_AUTO_FAQ_PRIORITY = 8  # lower than official docs (1-5), higher than nothing
_AUTO_FAQ_DOC_TYPE = "auto-faq"


def _format_qa(question: str, answer: str) -> str:
    return f"Q: {question.strip()}\nA: {answer.strip()}"


async def auto_ingest_resolved_session(session_id: str) -> int:
    """
    Pull messages for session_id, pair user/assistant turns,
    and ingest meaningful Q&A pairs as knowledge chunks.
    Returns the number of chunks stored (0 if skipped).
    """
    try:
        sb = get_sb()

        # Load session metadata
        session_rows = sb.table("chat_sessions").select(
            "icp_id,icp_name,resolved"
        ).eq("session_id", session_id).execute().data

        if not session_rows:
            return 0
        session = session_rows[0]

        if not session.get("resolved") or not session.get("icp_id"):
            return 0

        icp_id   = session["icp_id"]
        icp_name = session["icp_name"] or "Unknown ICP"

        # Load messages in order
        msgs = sb.table("chat_messages").select(
            "role,content"
        ).eq("session_id", session_id).order("created_at").execute().data or []

        # Pair consecutive user → assistant turns
        pairs: list[tuple[str, str]] = []
        i = 0
        while i < len(msgs) - 1:
            if msgs[i]["role"] == "user" and msgs[i+1]["role"] == "assistant":
                q = msgs[i]["content"]
                a = msgs[i+1]["content"]
                if len(q) >= _MIN_USER_LEN and len(a) >= _MIN_BOT_LEN:
                    pairs.append((q, a))
                    i += 2
                    continue
            i += 1

        if not pairs:
            return 0

        # Keep only the most meaningful pairs (cap at _MAX_PAIRS)
        pairs = pairs[:_MAX_PAIRS]

        # Check if auto-faq chunks already exist for this session (avoid duplicates)
        existing = sb.table("knowledge_chunks").select("id").eq(
            "source", f"auto-faq:{session_id}"
        ).limit(1).execute().data
        if existing:
            return 0

        # Embed + store inline to avoid circular imports with ingest.py
        from app.services.chunker import chunk_text
        from app.services.embeddings import embed_batch

        texts = [_format_qa(q, a) for q, a in pairs]
        chunks_flat: list[str] = []
        for text in texts:
            chunks_flat.extend(chunk_text(text))

        if not chunks_flat:
            return 0

        embeddings = await embed_batch(chunks_flat)
        rows = [
            {
                "icp_id":      icp_id,
                "icp_name":    icp_name,
                "content":     chunk,
                "embedding":   emb,
                "source":      f"auto-faq:{session_id}",
                "chunk_index": idx,
                "priority":    _AUTO_FAQ_PRIORITY,
                "doc_type":    _AUTO_FAQ_DOC_TYPE,
            }
            for idx, (chunk, emb) in enumerate(zip(chunks_flat, embeddings))
        ]

        sb.table("knowledge_chunks").insert(rows).execute()
        return len(rows)

    except (APIError, Exception):
        return 0  # best-effort — never block the main chat flow
