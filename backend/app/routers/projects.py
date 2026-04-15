from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.middleware.auth import get_current_user
from app.models.user import Project
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
    result = await db.execute(
        select(Project)
        .where(Project.user_id == user["id"])
        .order_by(Project.updated_at.desc())
    )
    projects = result.scalars().all()
    return {
        "projects": [
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat(),
            }
            for p in projects
        ]
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
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == user["id"])
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "project": {
            "id": str(project.id),
            "name": project.name,
            "description": project.description,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
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
