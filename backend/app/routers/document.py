from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.document import DocumentContent, DocumentResponse
from app.models.user import Project
from app.services.document_store import read_document
from app.services.collaboration import get_or_create_draft, save_draft, get_member_role
from app.middleware.auth import get_current_user

router = APIRouter()

EDITOR_ROLES = {"owner", "editor"}


async def _get_project(db, project_id: str) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


@router.get("/projects/{project_id}/document", response_model=DocumentResponse)
async def get_document(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(db, project_id)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")

    owner_user_id = str(project.user_id)
    role = await get_member_role(db, project_id, user["id"])

    if role in EDITOR_ROLES:
        # Editors and owners get their personal draft
        main_content, last_modified = read_document(owner_user_id, project_id)
        draft = await get_or_create_draft(
            db, project_id, user["id"], main_content, project.doc_version
        )
        return DocumentResponse(latex_content=draft.content, last_modified=last_modified)
    else:
        # Viewers and commenters always read main
        content, last_modified = read_document(owner_user_id, project_id)
        return DocumentResponse(latex_content=content, last_modified=last_modified)


@router.put("/projects/{project_id}/document")
async def update_document(
    project_id: str,
    body: DocumentContent,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await _get_project(db, project_id)
    if not project:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Project not found")

    role = await get_member_role(db, project_id, user["id"])
    if role not in EDITOR_ROLES:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Editors and owners only")

    owner_user_id = str(project.user_id)

    # Always autosave to the user's personal draft (never directly to main)
    main_content, last_modified = read_document(owner_user_id, project_id)
    await get_or_create_draft(
        db, project_id, user["id"], main_content, project.doc_version
    )
    await save_draft(db, project_id, user["id"], body.latex_content)
    return {"last_modified": last_modified}
