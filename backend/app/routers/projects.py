from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.middleware.auth import get_current_user
from app.models.user import Project
from app.models.collaboration import ProjectMember
from app.services.s3_store import ensure_default_tex, delete_project_files
from app.constants import DEFAULT_LATEX

router = APIRouter()


class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None


@router.get("/projects")
async def list_projects(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Owned projects
    owned_result = await db.execute(
        select(Project)
        .where(Project.user_id == user["id"])
        .order_by(Project.updated_at.desc())
    )
    owned = owned_result.scalars().all()

    # Shared projects (user is a member but not owner)
    shared_result = await db.execute(
        select(Project, ProjectMember)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user["id"])
        .order_by(Project.updated_at.desc())
    )
    shared_rows = shared_result.all()

    def fmt(p: Project, role: str = "owner") -> dict:
        return {
            "id": str(p.id),
            "name": p.name,
            "description": p.description,
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat(),
            "role": role,
        }

    return {
        "projects": [fmt(p, "owner") for p in owned],
        "shared_projects": [fmt(p, m.role) for p, m in shared_rows],
    }


@router.post("/projects")
async def create_project(
    body: CreateProjectRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(
        user_id=user["id"],
        name=body.name,
        description=body.description,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # Create default main.tex in S3
    ensure_default_tex(user["id"], str(project.id), DEFAULT_LATEX)

    return {
        "project": {
            "id": str(project.id),
            "name": project.name,
            "description": project.description,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
        }
    }


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Access check: owner or member
    is_owner = str(project.user_id) == user["id"]
    if not is_owner:
        member_result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user["id"],
            )
        )
        if not member_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Project not found")

    role = "owner" if is_owner else None
    if not role:
        member_result2 = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user["id"],
            )
        )
        m = member_result2.scalar_one_or_none()
        role = m.role if m else "viewer"

    return {
        "project": {
            "id": str(project.id),
            "name": project.name,
            "description": project.description,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
            "role": role,
            "doc_version": project.doc_version,
        }
    }


@router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    body: UpdateProjectRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user["id"])
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    await db.commit()

    return {"project": {"id": str(project.id), "name": project.name}}


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user["id"])
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete S3 files
    delete_project_files(user["id"], project_id)

    # Delete from DB (cascades to chat messages)
    await db.delete(project)
    await db.commit()

    return {"deleted": project_id}
