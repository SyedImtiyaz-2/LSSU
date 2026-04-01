from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.routers import ingest, chat, dashboard

app = FastAPI(
    title="LSSU Laker Chatbot API",
    description="RAG-powered admissions chatbot for Lake Superior State University",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS must be registered before all other middleware / exception handlers
# so that error responses also carry the Allow-Origin header.
_origins = settings.cors_origins_list
_open    = "*" in _origins   # True when CORS_ORIGINS contains *
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _open else _origins,
    allow_credentials=False if _open else True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler that returns JSON (not plain-text).
    Starlette's CORS middleware adds headers to any Response object,
    so this ensures the browser can read the error body.
    """
    import traceback, logging
    logging.error("Unhandled exception: %s", traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
    )


app.include_router(ingest.router)
app.include_router(chat.router)
app.include_router(dashboard.router)


@app.on_event("startup")
async def check_supabase():
    """Verify Supabase schema is reachable at startup and log a clear error if not."""
    import logging
    from app.services.supabase_client import get_supabase
    from app.config import settings
    try:
        get_supabase().schema(settings.supabase_schema).table("chat_sessions").select("id").limit(1).execute()
        logging.info("✓ Supabase schema '%s' is reachable.", settings.supabase_schema)
    except Exception as e:
        logging.warning(
            "\n\n⚠️  Supabase schema '%s' is not accessible: %s\n"
            "   Fix: Supabase Dashboard → Settings → API → 'Exposed schemas' → add '%s'\n"
            "   Then run supabase/migrations/001_initial.sql in the SQL editor.\n",
            settings.supabase_schema, e, settings.supabase_schema,
        )


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "service": "LSSU Laker Chatbot API", "version": "1.0.0"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}
