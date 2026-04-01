#!/usr/bin/env python3
"""
Run the Supabase migration (001_initial.sql) directly via psycopg2.

Usage:
    cd /home/imtiyaz/Desktop/LSSU
    python scripts/migrate.py

The script reads DATABASE_URL from backend/app/.env (or environment).
Get your connection string from:
  Supabase Dashboard → Settings → Database → Connection string → URI
  (use the "Transaction" pooler URI for IPv4, or the direct URI)

Format:
  postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
  OR
  postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
"""
import os
import sys
import pathlib
import re

ROOT = pathlib.Path(__file__).parent.parent
MIGRATION = ROOT / "supabase" / "migrations" / "001_initial.sql"
# Check both possible .env locations
_env1 = ROOT / "backend" / ".env"
_env2 = ROOT / "backend" / "app" / ".env"
ENV_FILE  = _env1 if _env1.exists() else _env2


def load_env(path: pathlib.Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def build_db_url(env: dict) -> str | None:
    """Try to assemble a DATABASE_URL from available env vars."""
    if env.get("DATABASE_URL"):
        return env["DATABASE_URL"]

    # Derive from SUPABASE_URL + a database password if provided
    supabase_url = env.get("SUPABASE_URL", "")
    db_password  = env.get("SUPABASE_DB_PASSWORD") or env.get("DB_PASSWORD")
    ref_match    = re.search(r"https://([a-z0-9]+)\.supabase\.co", supabase_url)

    if ref_match and db_password:
        ref = ref_match.group(1)
        return f"postgresql://postgres:{db_password}@db.{ref}.supabase.co:5432/postgres"

    return None


def run_migration(db_url: str):
    import psycopg2

    sql = MIGRATION.read_text(encoding="utf-8")

    # Split on lines that start with '--' section comments or are purely procedural
    # psycopg2 needs statements separated individually for some DDL
    # We'll execute the whole file as a single transaction with autocommit=False
    print(f"Connecting to Supabase…")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True   # DDL (CREATE TABLE, etc.) needs this in some Postgres configs

    with conn.cursor() as cur:
        print(f"Running {MIGRATION.name} …")
        cur.execute(sql)

    conn.close()
    print("\n✓ Migration complete.")
    print("  Tables created in 'issu' schema.")
    print("  PostgREST schema exposure applied via 'alter role authenticator'.")
    print("\nIf the dashboard still shows 503, go to:")
    print("  Supabase Dashboard → Settings → API → Exposed schemas → add 'issu' → Save")


def main():
    env = load_env(ENV_FILE)
    db_url = build_db_url(env) or os.environ.get("DATABASE_URL")

    if not db_url:
        # Try to derive the project ref from SUPABASE_URL so we can show a pre-filled URL
        ref = ""
        m = re.search(r"https://([a-z0-9]+)\.supabase\.co", env.get("SUPABASE_URL", ""))
        if m:
            ref = m.group(1)

        print("═" * 64)
        print("DATABASE_URL not found in backend/app/.env\n")
        print("Add this line to backend/app/.env, filling in your DB password:\n")
        if ref:
            print(f"  DATABASE_URL=postgresql://postgres:[YOUR_DB_PASSWORD]@db.{ref}.supabase.co:5432/postgres")
        else:
            print("  DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres")
        print("\nGet your DB password from:")
        print("  Supabase Dashboard → Settings → Database → Database password")
        print("  (or reset it there if you don't have it)")
        print("═" * 64)
        sys.exit(1)

    run_migration(db_url)


if __name__ == "__main__":
    main()
