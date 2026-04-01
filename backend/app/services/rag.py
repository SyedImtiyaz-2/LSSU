"""
RAG retrieval service.
Embeds the student's question, runs vector search filtered by ICP,
applies a confidence gate, and returns ranked context chunks.
"""
from app.services.supabase_client import sb as get_sb
from app.services.embeddings import embed_text
from app.config import settings
from app.models import RAGChunk


async def retrieve_context(
    question: str,
    icp_id: int,
    top_k: int | None = None,
    threshold: float | None = None,
) -> tuple[list[RAGChunk], float | None]:
    """
    Returns (chunks, top_score).
    top_score is None when no chunks pass the threshold — caller should trigger
    human-handoff.
    """
    k = top_k or settings.rag_top_k
    min_score = threshold or settings.rag_confidence_threshold

    query_vec = await embed_text(question)

    result = get_sb().rpc(
        "match_knowledge_chunks",
        {
            "query_embedding": query_vec,
            "icp_filter": icp_id,
            "match_threshold": min_score,
            "match_count": k,
        },
    ).execute()

    rows = result.data or []

    if not rows:
        return [], None

    chunks = [
        RAGChunk(
            content=r["content"],
            similarity=r["similarity"],
            source=r.get("source"),
        )
        for r in rows
    ]

    top_score = max(c.similarity for c in chunks)
    return chunks, top_score


def build_context_block(chunks: list[RAGChunk]) -> str:
    """Concatenate retrieved chunks into a labelled context string."""
    parts = []
    for i, chunk in enumerate(chunks, 1):
        src = f" [{chunk.source}]" if chunk.source else ""
        parts.append(f"[Context {i}{src}]\n{chunk.content}")
    return "\n\n".join(parts)
