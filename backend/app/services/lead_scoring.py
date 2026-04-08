"""
Lead scoring and tagging service.

Scoring:
  +3  email captured
  +2  phone captured
  +1  name captured
  +2  message_count >= 10 (deep engagement)
  +1  message_count >= 5  (medium engagement)
  +1  resolved == True
  -1  human_requested == True (couldn't answer)

  >= 6 → high
  >= 3 → medium
  <  3 → low

Tagging:
  - Program tag from icp_name
  - Topic tags extracted from conversation text
  - Depth tag from message_count
"""

import re
from typing import Optional

# ── Topic keyword map ─────────────────────────────────────────────────────────

TOPIC_PATTERNS: list[tuple[str, list[str]]] = [
    ("scholarship",    ["scholarship", "financial aid", "fafsa", "aid", "grant", "tuition waiver"]),
    ("cost-tuition",   ["cost", "tuition", "afford", "price", "one rate", "out-of-pocket", "fee"]),
    ("application",    ["apply", "application", "deadline", "admission", "enroll", "register"]),
    ("transfer",       ["transfer", "credits", "community college", "michigan transfer", "mta"]),
    ("housing",        ["housing", "dorm", "residence hall", "live on campus", "apartment"]),
    ("clinical",       ["clinical", "nclex", "nursing", "patient care", "simulation", "placement"]),
    ("career",         ["career", "job", "salary", "placement rate", "hire", "employment", "industry"]),
    ("sports-hockey",  ["hockey", "athlete", "sport", "team", "laker pride", "play"]),
    ("campus-life",    ["campus", "student life", "club", "organization", "outdoor", "safety"]),
    ("canadian",       ["canada", "canadian", "ontario", "osap", "cross-border", "commute"]),
    ("indigenous",     ["indigenous", "anishinaabe", "native", "tribal", "ojibwe", "first nations"]),
]


def _detect_topics(texts: list[str]) -> list[str]:
    """Return list of topic tags present in any of the provided text strings."""
    combined = " ".join(texts).lower()
    tags = []
    for tag, keywords in TOPIC_PATTERNS:
        if any(kw in combined for kw in keywords):
            tags.append(tag)
    return tags


def _depth_tag(message_count: int) -> str:
    if message_count >= 10:
        return "depth:deep"
    if message_count >= 5:
        return "depth:medium"
    return "depth:shallow"


def compute_score(
    name: Optional[str],
    phone: Optional[str],
    email: Optional[str],
    message_count: int,
    resolved: bool,
    human_requested: bool,
) -> str:
    points = 0
    if email:
        points += 3
    if phone:
        points += 2
    if name:
        points += 1
    if message_count >= 10:
        points += 2
    elif message_count >= 5:
        points += 1
    if resolved:
        points += 1
    if human_requested:
        points -= 1

    if points >= 5:
        return "high"
    if points >= 2:
        return "medium"
    return "low"


def compute_tags(
    icp_name: Optional[str],
    message_count: int,
    conversation_texts: list[str],
) -> list[str]:
    tags: list[str] = []

    # Program tag
    if icp_name:
        slug = icp_name.lower().replace(" ", "-").replace("&", "and").replace("'", "")
        tags.append(f"program:{slug}")

    # Depth tag
    tags.append(_depth_tag(message_count))

    # Topic tags
    tags.extend(_detect_topics(conversation_texts))

    return tags
