"""
Text chunker: splits a document into ~600-token chunks with 100-token overlap.
Uses tiktoken so token counts match what the embedding model sees.
"""
import tiktoken
from app.config import CHUNK_SIZE, CHUNK_OVERLAP

_ENCODER = tiktoken.get_encoding("cl100k_base")  # used by text-embedding-3-small


def _tokenize(text: str) -> list[int]:
    return _ENCODER.encode(text)


def _detokenize(tokens: list[int]) -> str:
    return _ENCODER.decode(tokens)


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """
    Split *text* into chunks of ≤chunk_size tokens with *overlap* token overlap.
    Tries to break on paragraph boundaries first; falls back to sliding window.
    """
    # Split on paragraph boundaries, then join into token-budget windows
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current_tokens: list[int] = []

    for para in paragraphs:
        para_tokens = _tokenize(para)

        # If a single paragraph exceeds chunk_size, hard-split it
        if len(para_tokens) > chunk_size:
            # Flush current buffer first
            if current_tokens:
                chunks.append(_detokenize(current_tokens))
                current_tokens = current_tokens[-overlap:] if overlap else []

            for start in range(0, len(para_tokens), chunk_size - overlap):
                slice_tokens = para_tokens[start: start + chunk_size]
                chunks.append(_detokenize(slice_tokens))
                if len(slice_tokens) < chunk_size:
                    break
            current_tokens = para_tokens[-(overlap):] if overlap else []
            continue

        # Would adding this paragraph exceed the budget?
        if len(current_tokens) + len(para_tokens) > chunk_size:
            if current_tokens:
                chunks.append(_detokenize(current_tokens))
            # Start new window with overlap from previous
            current_tokens = current_tokens[-overlap:] + para_tokens if overlap else para_tokens
        else:
            if current_tokens:
                current_tokens += _tokenize("\n\n")  # preserve paragraph gap
            current_tokens += para_tokens

    if current_tokens:
        chunks.append(_detokenize(current_tokens))

    return chunks
