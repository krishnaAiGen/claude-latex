import asyncio
from app.workers.celery_app import celery_app
from app.review.pipeline import run_review_pipeline


@celery_app.task(name="review.run_pipeline")
def run_review_task(
    review_id: str,
    project_id: str,
    user_id: str,
    latex: str,
    venue: str,
    topic: str,
    mode: str,
) -> None:
    asyncio.run(run_review_pipeline(
        review_id=review_id,
        project_id=project_id,
        user_id=user_id,
        latex=latex,
        venue=venue,
        topic=topic,
        mode=mode,
    ))
