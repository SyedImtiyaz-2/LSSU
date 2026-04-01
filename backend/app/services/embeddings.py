from openai import AsyncOpenAI
from app.config import settings, EMBEDDING_MODEL
import functools


@functools.lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.openai_api_key)


async def embed_text(text: str) -> list[float]:
    """Return a 1536-dim embedding vector for the given text."""
    client = get_openai_client()
    response = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text.replace("\n", " "),
    )
    return response.data[0].embedding


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed multiple texts in one API call (max 2048 inputs)."""
    client = get_openai_client()
    cleaned = [t.replace("\n", " ") for t in texts]
    response = await client.embeddings.create(model=EMBEDDING_MODEL, input=cleaned)
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
