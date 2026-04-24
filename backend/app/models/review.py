from datetime import datetime
from sqlalchemy import ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(primary_key=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    venue: Mapped[str]
    topic: Mapped[str]
    mode: Mapped[str]          # "speed" | "depth" | "novelty" | "rebuttal"
    status: Mapped[str] = mapped_column(default="pending")  # "pending"|"running"|"done"|"error"
    progress_pct: Mapped[int] = mapped_column(default=0)
    error_message: Mapped[str | None] = mapped_column(default=None)
    findings_json: Mapped[str | None] = mapped_column(default=None)
    scores_json: Mapped[str | None] = mapped_column(default=None)
    meta_json: Mapped[str | None] = mapped_column(default=None)
    benchmarks_json: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(server_default=text("NOW()"))
    completed_at: Mapped[datetime | None] = mapped_column(default=None)
