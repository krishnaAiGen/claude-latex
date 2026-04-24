"""Review mode endpoints: start, poll, and live-stream a paper review."""
import asyncio
import json
import logging
from uuid import uuid4

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, WebSocket
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.middleware.auth import get_current_user
from app.models.review import Review
from app.models.user import Project
from app.review.pipeline import run_review_pipeline
from app.review.schemas import ReviewResult, DimensionScore, MetaRecommendation
from app.services.document_store import read_document

logger = logging.getLogger("review.router")

router = APIRouter()


class StartReviewRequest(BaseModel):
    venue: str
    topic: str
    mode: str  # "speed"|"depth"|"novelty"|"rebuttal"


# ── GET /api/reviews — list all reviews for current user ────────────────────

@router.get("/reviews")
async def list_reviews(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Review, Project.name.label("project_name"))
        .join(Project, Review.project_id == Project.id)
        .where(Review.user_id == user["id"])
        .order_by(Review.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": r.Review.id,
            "project_id": r.Review.project_id,
            "project_name": r.project_name,
            "venue": r.Review.venue,
            "topic": r.Review.topic,
            "mode": r.Review.mode,
            "status": r.Review.status,
            "progress_pct": r.Review.progress_pct,
            "created_at": r.Review.created_at.isoformat(),
            "completed_at": r.Review.completed_at.isoformat() if r.Review.completed_at else None,
            "meta_verdict": json.loads(r.Review.meta_json).get("verdict") if r.Review.meta_json else None,
            "meta_overall": json.loads(r.Review.meta_json).get("overall") if r.Review.meta_json else None,
        }
        for r in rows
    ]


# ── POST /api/projects/{project_id}/review ───────────────────────────────────

@router.post("/projects/{project_id}/review")
async def start_review(
    project_id: str,
    body: StartReviewRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    latex, _ = read_document(user["id"], project_id)

    review = Review(
        id=str(uuid4()),
        project_id=project_id,
        user_id=user["id"],
        venue=body.venue,
        topic=body.topic,
        mode=body.mode,
        status="pending",
        progress_pct=0,
    )
    db.add(review)
    await db.commit()

    logger.info("[review:%s] queued pipeline venue=%s topic=%s mode=%s", review.id, body.venue, body.topic, body.mode)
    asyncio.create_task(run_review_pipeline(
        review_id=review.id,
        project_id=project_id,
        user_id=user["id"],
        latex=latex,
        venue=body.venue,
        topic=body.topic,
        mode=body.mode,
    ))

    return {"review_id": review.id}


# ── GET /api/projects/{project_id}/review/{review_id} ───────────────────────

@router.get("/projects/{project_id}/review/{review_id}", response_model=ReviewResult)
async def get_review(
    project_id: str,
    review_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    review = await db.get(Review, review_id)
    if not review or review.project_id != project_id:
        raise HTTPException(status_code=404, detail="Review not found")

    findings_raw = json.loads(review.findings_json or "[]")
    scores_raw = json.loads(review.scores_json or "{}")
    meta_raw = json.loads(review.meta_json) if review.meta_json else None

    dimension_scores = {
        k: DimensionScore(**v) for k, v in scores_raw.items()
    }

    meta = MetaRecommendation(**meta_raw) if meta_raw else None

    return ReviewResult(
        review_id=review.id,
        status=review.status,
        progress_pct=review.progress_pct,
        findings=findings_raw,
        dimension_scores=dimension_scores,
        meta=meta,
        benchmarks=json.loads(review.benchmarks_json or "[]"),
    )


# ── WS /api/reviews/{review_id}/stream ──────────────────────────────────────

@router.websocket("/reviews/{review_id}/stream")
async def review_stream(websocket: WebSocket, review_id: str):
    await websocket.accept()
    r = await aioredis.from_url(settings.redis_url)
    try:
        async with r.pubsub() as pubsub:
            await pubsub.subscribe(f"review:{review_id}")
            async for msg in pubsub.listen():
                if msg["type"] == "message":
                    data_bytes = msg["data"]
                    text = data_bytes if isinstance(data_bytes, str) else data_bytes.decode()
                    await websocket.send_text(text)
                    parsed = json.loads(text)
                    if parsed.get("stage") in ("done", "error"):
                        break
    finally:
        await r.aclose()
