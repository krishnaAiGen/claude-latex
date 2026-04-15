import os
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Depends, Body, Query, BackgroundTasks
from fastapi.responses import FileResponse

from app.models.document import DocumentContent
from app.services.compiler import compile_latex, get_cache_dir
from app.services.s3_store import write_file_text as s3_write, upload_from_dir as s3_upload
from app.services.auth import decode_token
from app.middleware.auth import get_current_user

router = APIRouter()


def _bg_sync_to_s3(user_id: str, project_id: str, cache_dir: str, latex_content: str | None):
    """Background task: sync main.tex and main.pdf to S3."""
    try:
        if latex_content:
            s3_write(user_id, project_id, "main.tex", latex_content)
        s3_upload(user_id, project_id, cache_dir, "main.pdf")
    except Exception:
        pass  # S3 sync failure shouldn't break anything


@router.post("/projects/{project_id}/compile")
async def compile_document(
    project_id: str,
    background_tasks: BackgroundTasks,
    body: DocumentContent | None = Body(default=None),
    user: dict = Depends(get_current_user),
):
    latex_content = body.latex_content if body else None

    result = await compile_latex(user["id"], project_id, latex_content)

    # Sync to S3 in background (non-blocking)
    if result.success:
        cache_dir = get_cache_dir(user["id"], project_id)
        background_tasks.add_task(_bg_sync_to_s3, user["id"], project_id, cache_dir, latex_content)

    return {
        "success": result.success,
        "pdf_url": f"/api/projects/{project_id}/pdf" if result.success else None,
        "log": result.log,
        "errors": [asdict(e) for e in result.errors],
        "warnings": result.warnings,
    }


@router.get("/projects/{project_id}/pdf")
async def get_pdf(project_id: str, token: str = Query(default="")):
    """Serve PDF from local cache. No S3 round-trip."""
    payload = decode_token(token) if token else None
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = payload["sub"]
    cache_dir = get_cache_dir(user_id, project_id)
    pdf_path = os.path.join(cache_dir, "main.pdf")

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF not found. Compile first.")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        headers={"Cache-Control": "no-cache"},
    )
