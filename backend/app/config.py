from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import List, Optional
import pathlib


# Search for .env in backend/ or backend/app/
_env_candidates = [
    pathlib.Path(__file__).parent.parent / ".env",   # backend/.env
    pathlib.Path(__file__).parent / ".env",           # backend/app/.env
]
_env_file = next((str(p) for p in _env_candidates if p.exists()), ".env")


class Settings(BaseSettings):
    supabase_url: str
    openai_api_key: str
    anthropic_api_key: Optional[str] = None   # optional — Claude via API key
    environment: str = "development"
    cors_origins: str = "http://localhost:3000"
    rag_confidence_threshold: float = 0.75
    rag_top_k: int = 3

    openai_model: str = "gpt-4o-mini"
    supabase_schema: str = "issu"

    # Accept either SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY
    supabase_service_key: Optional[str] = None
    supabase_service_role_key: Optional[str] = None

    @model_validator(mode="after")
    def resolve_service_key(self) -> "Settings":
        if not self.supabase_service_key:
            self.supabase_service_key = self.supabase_service_role_key
        if not self.supabase_service_key:
            raise ValueError("Set SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY")
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": _env_file, "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()


# ── ICP slug → id/name mapping (mirrors AGENTS.md) ──────────────────────────
ICP_MAPPING: dict[str, dict] = {
    "icp-traditional-student-1":            {"id": 1,  "name": "Traditional Prospective Student"},
    "icp-transfer-student-2":               {"id": 2,  "name": "Transfer Prospective Student"},
    "icp-transfer-back-student-3":          {"id": 3,  "name": "Transfer Back Prospective Student"},
    "icp-canadian-cross-border-student-4":  {"id": 4,  "name": "Canadian Cross Border Student"},
    "icp-charter-school-student-5":         {"id": 5,  "name": "Charter School Student"},
    "icp-indigenous-and-anishinaabe-scholar-6": {"id": 6, "name": "Indigenous and Anishinaabe Scholar"},
    "icp-cannabis-business-and-chemistry-student-7": {"id": 7, "name": "Cannabis Business & Chemistry Student"},
    "icp-fisheries-and-wildlife-student-8": {"id": 8,  "name": "Fisheries & Wildlife Student"},
    "icp-fire-science-student-9":           {"id": 9,  "name": "Fire Science Student"},
    "icp-nursing-student-10":               {"id": 10, "name": "Nursing Student"},
    "icp-robotics-engineering-student-11":  {"id": 11, "name": "Robotics Engineering Student"},
    "icp-collegiate-hockey-athlete-male-12":   {"id": 12, "name": "Collegiate Hockey Athlete (Men's)"},
    "icp-collegiate-hockey-athlete-female-13": {"id": 13, "name": "Collegiate Hockey Athlete (Women's)"},
}

EMBEDDING_MODEL = "text-embedding-3-small"
CLAUDE_MODEL    = "claude-sonnet-4-20250514"
CHUNK_SIZE      = 600    # target tokens per chunk
CHUNK_OVERLAP   = 100    # overlap tokens between chunks
