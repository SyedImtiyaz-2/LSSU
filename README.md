# LSSU BFX — Laker Admissions Chatbot

RAG-powered admissions chatbot for Lake Superior State University, built on Claude + Supabase pgvector.

## Architecture

```
widget/          Embeddable JS chat widget (drop on any landing page)
backend/         FastAPI — ingestion pipeline + chat RAG endpoint
dashboard/       Next.js admin dashboard — leads, sessions, analytics
supabase/        SQL migrations (pgvector schema)
AGENTS.md        Master system prompt + ICP knowledge base
```

## Quick Start

### 1. Supabase
1. Create a project at supabase.com
2. Run `supabase/migrations/001_initial.sql` in the SQL editor
3. Copy your `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`

### 2. Backend
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload   # http://localhost:8000/docs
```

### 3. Ingest documents
```bash
# POST raw text for a given ICP
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{"icp_id": 10, "icp_name": "Nursing Student", "source": "ICP_report", "text": "..."}'

# Upload a .docx file
curl -X POST http://localhost:8000/ingest/file \
  -F "file=@nursing_icp.docx" -F "icp_id=10" -F "icp_name=Nursing Student"
```

### 4. Dashboard
```bash
cd dashboard
cp .env.local.example .env.local
npm install && npm run dev    # http://localhost:3000
```

### 5. Chat widget
```html
<script src="laker-chat.js"
        data-page-slug="icp-nursing-student-10"
        data-api="https://your-api.com"
        data-referral="google"></script>
```

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ingest` | Ingest raw text |
| `POST` | `/ingest/file` | Upload .docx/.txt |
| `DELETE` | `/ingest/{icp_id}` | Clear ICP chunks |
| `GET` | `/ingest/status` | Chunk counts per ICP |
| `POST` | `/chat` | Chat with Laker (RAG) |
| `PATCH` | `/chat/session` | Update lead fields |
| `GET` | `/dashboard/stats` | KPI overview |
| `GET` | `/dashboard/icp-breakdown` | Sessions by ICP |
| `GET` | `/dashboard/sessions` | Paginated sessions |
| `GET` | `/dashboard/leads` | Captured leads (CSV-exportable) |