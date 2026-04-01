"""
POST /ingest        — ingest raw text (from .docx, paste, etc.)
POST /ingest/file   — upload a .docx or .txt file directly
DELETE /ingest/{icp_id} — clear all chunks for an ICP (re-run)
"""
import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.models import IngestRequest, IngestResponse
from app.services.chunker import chunk_text
from app.services.embeddings import embed_batch
from app.services.supabase_client import sb as get_sb

router = APIRouter(prefix="/ingest", tags=["ingestion"])


async def _store_chunks(
    icp_id: int,
    icp_name: str,
    source: str,
    text: str,
) -> int:
    chunks = chunk_text(text)
    if not chunks:
        return 0

    embeddings = await embed_batch(chunks)

    rows = [
        {
            "icp_id": icp_id,
            "icp_name": icp_name,
            "content": chunk,
            "embedding": emb,
            "source": source,
            "chunk_index": idx,
        }
        for idx, (chunk, emb) in enumerate(zip(chunks, embeddings))
    ]

    get_sb().table("knowledge_chunks").insert(rows).execute()
    return len(rows)


@router.post("", response_model=IngestResponse)
async def ingest_text(req: IngestRequest):
    """Ingest raw text for a given ICP."""
    stored = await _store_chunks(req.icp_id, req.icp_name, req.source, req.text)
    return IngestResponse(
        chunks_stored=stored,
        icp_id=req.icp_id,
        icp_name=req.icp_name,
        message=f"Stored {stored} chunks for ICP {req.icp_id} ({req.icp_name})",
    )


@router.post("/file", response_model=IngestResponse)
async def ingest_file(
    file: UploadFile = File(...),
    icp_id: int = Form(...),
    icp_name: str = Form(...),
    source: str = Form("uploaded_file"),
):
    """Upload a .docx or .txt file and ingest its text."""
    content = await file.read()
    filename = file.filename or ""

    if filename.endswith(".docx"):
        try:
            from docx import Document
            doc = Document(io.BytesIO(content))
            text = "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse .docx: {e}")
    elif filename.endswith(".txt") or filename.endswith(".md"):
        text = content.decode("utf-8", errors="replace")
    else:
        raise HTTPException(status_code=400, detail="Only .docx, .txt, and .md files are supported.")

    stored = await _store_chunks(icp_id, icp_name, source or filename, text)
    return IngestResponse(
        chunks_stored=stored,
        icp_id=icp_id,
        icp_name=icp_name,
        message=f"Stored {stored} chunks from '{filename}' for ICP {icp_id}",
    )


@router.delete("/{icp_id}", summary="Clear all chunks for an ICP")
async def clear_icp_chunks(icp_id: int):
    get_sb().table("knowledge_chunks").delete().eq("icp_id", icp_id).execute()
    return {"message": f"Cleared all knowledge chunks for icp_id={icp_id}"}


@router.get("/status", summary="Count chunks per ICP")
async def ingest_status():
    rows = (
        get_sb().table("knowledge_chunks")
        .select("icp_id, icp_name")
        .execute()
        .data or []
    )
    from collections import Counter
    counts = Counter((r["icp_id"], r["icp_name"]) for r in rows)
    return [
        {"icp_id": k[0], "icp_name": k[1], "chunk_count": v}
        for k, v in sorted(counts.items())
    ]
