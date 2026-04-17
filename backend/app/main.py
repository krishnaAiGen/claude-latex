from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import document, compile, ws, files, auth, chat, projects
from app.db import init_db, AsyncSessionLocal
from app.services.auth import ensure_admin_exists
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
app.include_router(ws.router)


@app.on_event("startup")
async def startup():
    # Create database tables
    await init_db()

    # Ensure admin user exists
    async with AsyncSessionLocal() as db:
        await ensure_admin_exists(db)

    # Create local temp storage dir
    settings.storage_dir.mkdir(parents=True, exist_ok=True)

    # Initialize agent with PostgreSQL checkpointer
    await init_agent()
