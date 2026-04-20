"""
Collaboration router — drafts, push-to-main, version history, members, invitations, comments.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.middleware.auth import get_current_user
from app.models.user import Project, User
from app.models.collaboration import ProjectInvitation
from app.services import collaboration as svc

logger = logging.getLogger(__name__)
from app.services.diff_summary import compute_diff_stats, generate_diff_summary
from app.services.document_store import read_document, write_document
from app.config import settings

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_project_or_404(db: AsyncSession, project_id: str) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _require_role(db: AsyncSession, project_id: str, user_id: str, min_role: str):
    try:
        return await svc.require_role(db, project_id, user_id, min_role)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ---------------------------------------------------------------------------
# Draft endpoints
# ---------------------------------------------------------------------------

class DraftUpdate(BaseModel):
    content: str


@router.get("/projects/{project_id}/draft")
async def get_draft(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "editor")
    project = await _get_project_or_404(db, project_id)

    # Read main content from S3 (owner's S3 path)
    main_content, _ = read_document(str(project.user_id), project_id)
    draft = await svc.get_or_create_draft(
        db, project_id, user["id"], main_content, project.doc_version
    )
    return {
        "content": draft.content,
        "forked_from_version": draft.forked_from_version,
        "updated_at": draft.updated_at.isoformat(),
        "main_version": project.doc_version,
        "main_ahead": draft.forked_from_version < project.doc_version,
    }


@router.put("/projects/{project_id}/draft")
async def save_draft(
    project_id: str,
    body: DraftUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "editor")
    project = await _get_project_or_404(db, project_id)

    # Ensure draft exists
    main_content, _ = read_document(str(project.user_id), project_id)
    await svc.get_or_create_draft(
        db, project_id, user["id"], main_content, project.doc_version
    )
    draft = await svc.save_draft(db, project_id, user["id"], body.content)
    return {"updated_at": draft.updated_at.isoformat()}


@router.get("/projects/{project_id}/members/{member_user_id}/draft")
async def get_member_draft(
    project_id: str,
    member_user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner only: view another member's draft (read-only)."""
    await _require_role(db, project_id, user["id"], "owner")
    draft = await svc.get_draft(db, project_id, member_user_id)
    if not draft:
        raise HTTPException(status_code=404, detail="No draft found for this member")
    return {
        "content": draft.content,
        "forked_from_version": draft.forked_from_version,
        "updated_at": draft.updated_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# AI summary generation
# ---------------------------------------------------------------------------

class SummaryRequest(BaseModel):
    main_content: str
    draft_content: str
    model: str | None = None


@router.post("/projects/{project_id}/draft/summary")
async def generate_summary(
    project_id: str,
    body: SummaryRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    diff_stats = compute_diff_stats(body.main_content, body.draft_content)
    summary = await generate_diff_summary(
        body.main_content, body.draft_content, body.model
    )
    return {"summary": summary, "diff_stats": diff_stats}


# ---------------------------------------------------------------------------
# Push to main (owner only)
# ---------------------------------------------------------------------------

class PushRequest(BaseModel):
    ai_summary: str


@router.post("/projects/{project_id}/push")
async def push_to_main(
    project_id: str,
    body: PushRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    project = await _get_project_or_404(db, project_id)

    draft = await svc.get_draft(db, project_id, user["id"])
    if not draft:
        raise HTTPException(status_code=400, detail="No draft found — nothing to push")

    # Write draft content to S3 as new main
    write_document(str(project.user_id), project_id, draft.content)

    # Compute diff stats
    main_content, _ = read_document(str(project.user_id), project_id)
    diff_stats = compute_diff_stats(main_content, draft.content)

    # Create version record + increment doc_version
    version = await svc.push_to_main(
        db,
        project_id,
        user["id"],
        draft.content,
        body.ai_summary,
        diff_stats,
    )

    # Broadcast to all project WebSocket clients
    from app.routers.ws import broadcast_to_project
    pusher_result = await db.execute(select(User).where(User.id == user["id"]))
    pusher = pusher_result.scalar_one_or_none()
    await broadcast_to_project(project_id, {
        "type": "main_updated",
        "version_number": version.version_number,
        "pushed_by": pusher.name or pusher.email if pusher else user["id"],
        "ai_summary": body.ai_summary,
    })

    return {"version_number": version.version_number}


# ---------------------------------------------------------------------------
# Version history
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/history")
async def list_history(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "viewer")
    versions = await svc.get_version_history(db, project_id)

    # Enrich with pusher name
    rows = []
    for v in versions:
        pusher_result = await db.execute(select(User).where(User.id == v.pushed_by))
        pusher = pusher_result.scalar_one_or_none()
        rows.append({
            "id": str(v.id),
            "version_number": v.version_number,
            "pushed_by": {
                "id": str(v.pushed_by),
                "name": pusher.name or pusher.email if pusher else str(v.pushed_by),
            },
            "ai_summary": v.ai_summary,
            "diff_stats": v.diff_stats,
            "created_at": v.created_at.isoformat(),
        })
    return {"versions": rows}


@router.get("/projects/{project_id}/history/{version_id}")
async def get_version(
    project_id: str,
    version_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "viewer")
    version = await svc.get_version(db, project_id, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return {"content": version.content, "version_number": version.version_number}


@router.post("/projects/{project_id}/history/{version_id}/restore")
async def restore_version(
    project_id: str,
    version_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    project = await _get_project_or_404(db, project_id)

    version = await svc.get_version(db, project_id, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Write restored content to S3
    write_document(str(project.user_id), project_id, version.content)

    new_version = await svc.restore_version(db, project_id, version_id, user["id"])

    # Broadcast
    from app.routers.ws import broadcast_to_project
    await broadcast_to_project(project_id, {
        "type": "main_updated",
        "version_number": new_version.version_number,
        "pushed_by": user.get("name") or user["email"],
        "ai_summary": f"Restored to v{version.version_number}",
    })

    return {"version_number": new_version.version_number}


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

class InviteRequest(BaseModel):
    email: str
    role: str = "editor"


class UpdateRoleRequest(BaseModel):
    role: str


@router.get("/projects/{project_id}/members")
async def list_members(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "viewer")
    members = await svc.get_project_members(db, project_id)
    return {"members": members}


@router.delete("/projects/{project_id}/members/{member_user_id}")
async def remove_member(
    project_id: str,
    member_user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    await svc.remove_member(db, project_id, member_user_id)
    return {"removed": member_user_id}


@router.patch("/projects/{project_id}/members/{member_user_id}")
async def update_role(
    project_id: str,
    member_user_id: str,
    body: UpdateRoleRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    if body.role not in ("editor", "commenter", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    member = await svc.update_member_role(db, project_id, member_user_id, body.role)
    return {"user_id": member_user_id, "role": member.role}


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/invite")
async def invite_member(
    project_id: str,
    body: InviteRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    if body.role not in ("editor", "commenter", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")

    invitation = await svc.create_invitation(
        db, project_id, user["id"], body.email, body.role
    )

    # Send email via Resend if configured
    invite_url = f"{settings.app_url}/invite?token={invitation.token}"
    email_sent = False
    if settings.resend_api_key:
        try:
            import resend
            resend.api_key = settings.resend_api_key
            project = await _get_project_or_404(db, project_id)
            resend.Emails.send({
                "from": "noreply@thesailab.com",
                "to": body.email,
                "subject": f"You've been invited to collaborate on '{project.name}'",
                "html": (
                    f"<p>{user.get('name') or user['email']} has invited you to collaborate "
                    f"on the LaTeX project <strong>{project.name}</strong> as <em>{body.role}</em>.</p>"
                    f"<p><a href='{invite_url}'>Accept invitation</a></p>"
                    f"<p>This link expires in 7 days.</p>"
                ),
            })
            email_sent = True
        except Exception as e:
            logger.error(f"Failed to send invite email to {body.email}: {e}")

    # If email failed, remove the invitation record — only confirmed-sent invitations are tracked
    if not email_sent:
        from sqlalchemy import delete as sql_delete
        await db.execute(sql_delete(ProjectInvitation).where(ProjectInvitation.id == invitation.id))
        await db.commit()
        return {"token": None, "invite_url": None, "email_sent": False}

    return {"token": invitation.token, "invite_url": invite_url, "email_sent": True}


@router.get("/projects/{project_id}/invite-link")
async def get_invite_link(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    # Return a generic invite link (token-less, uses link_access role on project)
    return {"url": f"{settings.app_url}/invite?project={project_id}"}


@router.get("/projects/{project_id}/invitations")
async def list_invitations(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ProjectInvitation)
        .where(
            ProjectInvitation.project_id == project_id,
            ProjectInvitation.accepted == False,  # noqa: E712
        )
        .order_by(ProjectInvitation.created_at.desc())
    )
    invitations = result.scalars().all()
    active = [
        {
            "id": str(inv.id),
            "email": inv.email,
            "role": inv.role,
            "created_at": inv.created_at.isoformat(),
            "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
        }
        for inv in invitations
        if inv.expires_at is None or inv.expires_at > now
    ]
    return {"invitations": active}


@router.delete("/projects/{project_id}/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    project_id: str,
    invitation_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "owner")
    from sqlalchemy import delete as sql_delete
    await db.execute(
        sql_delete(ProjectInvitation).where(
            ProjectInvitation.id == invitation_id,
            ProjectInvitation.project_id == project_id,
        )
    )
    await db.commit()


@router.get("/invitations/accept")
async def accept_invitation(
    token: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        member = await svc.accept_invitation(db, token, user["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "project_id": str(member.project_id),
        "role": member.role,
    }


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

class CommentRequest(BaseModel):
    content: str
    line_number: int | None = None
    parent_id: str | None = None


class ResolveRequest(BaseModel):
    resolved: bool = True


@router.get("/projects/{project_id}/comments")
async def list_comments(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "commenter")
    comments = await svc.get_comments(db, project_id)
    return {"comments": comments}


@router.post("/projects/{project_id}/comments")
async def add_comment(
    project_id: str,
    body: CommentRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "commenter")
    comment = await svc.create_comment(
        db,
        project_id,
        user["id"],
        body.content,
        body.line_number,
        body.parent_id,
    )

    comment_data = {
        "id": str(comment.id),
        "userId": str(comment.user_id),
        "userName": user.get("name") or user["email"],
        "parentId": body.parent_id,
        "lineNumber": body.line_number,
        "content": body.content,
        "resolved": False,
        "replies": [],
        "createdAt": comment.created_at.isoformat(),
    }

    # Broadcast new comment to project room
    from app.routers.ws import broadcast_to_project
    await broadcast_to_project(project_id, {
        "type": "comment_added",
        "comment": comment_data,
    })

    return comment_data


@router.patch("/projects/{project_id}/comments/{comment_id}")
async def update_comment(
    project_id: str,
    comment_id: str,
    body: ResolveRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "commenter")
    try:
        comment = await svc.resolve_comment(db, comment_id, body.resolved)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    from app.routers.ws import broadcast_to_project
    await broadcast_to_project(project_id, {
        "type": "comment_resolved",
        "comment_id": comment_id,
        "resolved": body.resolved,
    })

    return {"id": comment_id, "resolved": comment.resolved}


@router.delete("/projects/{project_id}/comments/{comment_id}")
async def delete_comment(
    project_id: str,
    comment_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_role(db, project_id, user["id"], "commenter")
    from sqlalchemy import delete as sql_delete
    from app.models.collaboration import Comment
    await db.execute(
        sql_delete(Comment).where(Comment.id == comment_id)
    )
    await db.commit()
    return {"deleted": comment_id}


# ---------------------------------------------------------------------------
# Member drafts list (owner only)
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/member-drafts")
async def list_member_drafts(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Owner only: list all members with their draft change stats."""
    await _require_role(db, project_id, user["id"], "owner")
    project = await _get_project_or_404(db, project_id)

    main_content, _ = read_document(str(project.user_id), project_id)
    members = await svc.get_project_members(db, project_id)

    result = []
    for member in members:
        if member["role"] == "owner":
            continue
        draft = await svc.get_draft(db, project_id, member["user_id"])
        if draft:
            stats = compute_diff_stats(main_content, draft.content)
            result.append({
                "user_id": member["user_id"],
                "name": member["name"],
                "email": member["email"],
                "role": member["role"],
                "lines_changed": stats["lines_added"] + stats["lines_removed"],
                "updated_at": draft.updated_at.isoformat(),
            })

    return {"member_drafts": result}
