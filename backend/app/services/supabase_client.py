from supabase import create_client, Client
from app.config import settings
import functools


@functools.lru_cache(maxsize=1)
def get_supabase() -> Client:
    client = create_client(settings.supabase_url, settings.supabase_service_key)
    return client


def sb():
    """Return a postgrest query builder scoped to the issu schema."""
    return get_supabase().schema(settings.supabase_schema)
