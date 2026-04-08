"""
Claude API wrapper — builds the full prompt, calls the API, returns the reply.
The system prompt is loaded from AGENTS.md once at startup.
Falls back to OpenAI if ANTHROPIC_API_KEY is not set.
"""
import pathlib
import re
from app.config import settings, CLAUDE_MODEL, ICP_MAPPING
from app.models import ChatMessage, RAGChunk
from app.services.rag import build_context_block


# ── Load system prompt from AGENTS.md ────────────────────────────────────────
_AGENTS_MD = pathlib.Path(__file__).parent.parent.parent.parent / "AGENTS.md"


def _extract_system_prompt() -> str:
    """
    Pull the instructional body from AGENTS.md.
    Everything between 'You are **Laker**' and 'End of System Prompt' is used.
    """
    try:
        raw = _AGENTS_MD.read_text(encoding="utf-8")
        # Find the section after the SYSTEM PROMPT header divider
        match = re.search(
            r"(You are \*\*Laker\*\*.*?)---\s*\n\s*\*End of System Prompt",
            raw,
            re.DOTALL,
        )
        if match:
            return match.group(1).strip()
    except Exception:
        pass
    # Fallback minimal prompt
    return (
        "You are Laker, the official LSSU admissions assistant. "
        "Be warm, accurate, and always collect the student's name, phone, and email naturally."
    )


BASE_SYSTEM_PROMPT = _extract_system_prompt()


def _make_client():
    if settings.anthropic_api_key:
        import anthropic
        return ("anthropic", anthropic.Anthropic(api_key=settings.anthropic_api_key))
    # Fallback: OpenAI (gpt-4o-mini)
    from openai import OpenAI
    return ("openai", OpenAI(api_key=settings.openai_api_key))


_LLM_TYPE, _CLIENT = _make_client()


def _icp_name_from_slug(page_slug: str) -> str:
    icp = ICP_MAPPING.get(page_slug)
    return icp["name"] if icp else "your program of interest"


def build_system_prompt(page_slug: str, icp_id: int | None, prior_context: dict | None = None) -> str:
    """
    Inject conversation-specific variables into the base system prompt.
    Optionally include prior session data for returning visitors.
    """
    icp_label = _icp_name_from_slug(page_slug)
    inject = (
        f"\n\n---\n"
        f"## CURRENT CONVERSATION CONTEXT\n"
        f"- page_slug: {page_slug}\n"
        f"- detected_icp: {icp_label} (id={icp_id})\n"
        f"Use ONLY the knowledge section for this ICP when answering.\n"
    )
    if prior_context:
        lines = ["## RETURNING VISITOR — PRIOR SESSION DATA"]
        if prior_context.get("name"):
            lines.append(f"- Known name: {prior_context['name']}")
        if prior_context.get("phone"):
            lines.append(f"- Phone already captured: {prior_context['phone']} (do NOT ask again)")
        if prior_context.get("email"):
            lines.append(f"- Email already captured: {prior_context['email']} (do NOT ask again)")
        if prior_context.get("icp_name"):
            lines.append(f"- Previously interested in: {prior_context['icp_name']}")
        if prior_context.get("chat_summary"):
            lines.append(f"- Summary of last conversation: {prior_context['chat_summary']}")
        lines.append("Greet them by name if known, skip re-collecting any data already captured.")
        inject += "\n" + "\n".join(lines) + "\n"
    return BASE_SYSTEM_PROMPT + inject


async def get_claude_reply(
    page_slug: str,
    icp_id: int | None,
    history: list[ChatMessage],
    user_message: str,
    rag_chunks: list[RAGChunk],
    prior_context: dict | None = None,
) -> str:
    """
    Call Claude with the system prompt, conversation history, and RAG context.
    Returns the assistant's reply text.
    """
    system = build_system_prompt(page_slug, icp_id, prior_context)

    # Prefix the user's message with retrieved context
    if rag_chunks:
        context_block = build_context_block(rag_chunks)
        augmented_user_msg = (
            f"Context from LSSU knowledge base:\n{context_block}\n\n"
            f"Student question: {user_message}"
        )
    else:
        augmented_user_msg = user_message

    # Build messages array from history + current turn
    messages = [
        {"role": m.role, "content": m.content}
        for m in history
        if m.role in ("user", "assistant")
    ]
    messages.append({"role": "user", "content": augmented_user_msg})

    if _LLM_TYPE == "anthropic":
        response = _CLIENT.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            system=system,
            messages=messages,
        )
        return response.content[0].text
    else:
        # OpenAI fallback
        oai_messages = [{"role": "system", "content": system}] + messages
        response = _CLIENT.chat.completions.create(
            model=settings.openai_model,
            max_tokens=1024,
            messages=oai_messages,
        )
        return response.choices[0].message.content
