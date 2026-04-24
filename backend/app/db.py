from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def run_migrations():
    """Idempotent schema migrations for columns added after initial create_all."""
    async with engine.begin() as conn:
        # Users
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE"
        ))
        await conn.execute(text(
            "ALTER TABLE users ALTER COLUMN password DROP NOT NULL"
        ))

        # Projects
        await conn.execute(text(
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS doc_version INTEGER NOT NULL DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE projects ADD COLUMN IF NOT EXISTS link_access VARCHAR(20) NOT NULL DEFAULT 'none'"
        ))

        # Collaboration tables (CREATE TABLE IF NOT EXISTS)
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS project_members (
                id VARCHAR(36) PRIMARY KEY,
                project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL DEFAULT 'editor',
                joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_project_member UNIQUE (project_id, user_id)
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_project_members_project_id ON project_members(project_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_project_members_user_id ON project_members(user_id)"
        ))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS project_invitations (
                id VARCHAR(36) PRIMARY KEY,
                project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                invited_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL DEFAULT 'editor',
                token VARCHAR(64) UNIQUE NOT NULL,
                accepted BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_project_invitations_token ON project_invitations(token)"
        ))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS comments (
                id VARCHAR(36) PRIMARY KEY,
                project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                parent_id VARCHAR(36) REFERENCES comments(id) ON DELETE CASCADE,
                line_number INTEGER,
                content TEXT NOT NULL,
                resolved BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_comments_project_id ON comments(project_id)"
        ))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS document_drafts (
                id VARCHAR(36) PRIMARY KEY,
                project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL DEFAULT '',
                forked_from_version INTEGER NOT NULL DEFAULT 0,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_document_draft UNIQUE (project_id, user_id)
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_document_drafts_project_id ON document_drafts(project_id)"
        ))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS document_versions (
                id VARCHAR(36) PRIMARY KEY,
                project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                pushed_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                version_number INTEGER NOT NULL,
                content TEXT NOT NULL,
                ai_summary TEXT NOT NULL DEFAULT '',
                diff_stats JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_document_versions_project_version ON document_versions(project_id, version_number)"
        ))

        # Reviews table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS reviews (
                id VARCHAR(36) PRIMARY KEY,
                project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                venue VARCHAR(100) NOT NULL,
                topic TEXT NOT NULL,
                mode VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                progress_pct INTEGER NOT NULL DEFAULT 0,
                error_message TEXT,
                findings_json TEXT,
                scores_json TEXT,
                meta_json TEXT,
                benchmarks_json TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_reviews_project_id ON reviews(project_id)"
        ))
