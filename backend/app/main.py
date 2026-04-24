from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.routers import document, compile, ws, files, auth, chat, projects, collaboration, review, venues
from app.db import init_db, AsyncSessionLocal, run_migrations
import app.models.collaboration  # noqa: F401 — registers tables with Base.metadata
import app.models.review  # noqa: F401 — registers reviews table with Base.metadata
from app.services.auth import ensure_admin_exists
from app.services.venue_index import load_venues
from app.agent.graph import init_agent
app = FastAPI(title="Claude LaTeX Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(document.router, prefix="/api")
app.include_router(compile.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(collaboration.router, prefix="/api")
app.include_router(review.router, prefix="/api")
app.include_router(venues.router, prefix="/api")
app.include_router(ws.router)


@app.on_event("startup")
async def startup():
    # Create database tables
    await init_db()
    await run_migrations()

    # Ensure admin user exists
    async with AsyncSessionLocal() as db:
        await ensure_admin_exists(db)

    # Load SCImago venue index into memory
    load_venues()

    # Create local temp storage dir
    settings.storage_dir.mkdir(parents=True, exist_ok=True)

    # Initialize agent with PostgreSQL checkpointer
    await init_agent()


@app.get("/health")
async def health():
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "error", "database": str(e)})
