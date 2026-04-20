"""
Collaboration service — manages project members, invitations, drafts, and version history.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collaboration import (
    ProjectMember,
    ProjectInvitation,
    Comment,
    DocumentDraft,
    DocumentVersion,
)
from app.models.user import Project, User

ROLE_RANK = {"viewer": 0, "commenter": 1, "editor": 2, "owner": 3}

INVITATION_EXPIRE_DAYS = 7


# ---------------------------------------------------------------------------
# Role helpers
# ---------------------------------------------------------------------------

async def get_member_role(db: AsyncSession, project_id: str, user_id: str) -> str | None:
    """Return the user's role on the project, or None if not a member."""
    # Owner of the project always has role "owner"
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if project and str(project.user_id) == str(user_id):
        return "owner"

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    return member.role if member else None


async def require_role(
    db: AsyncSession, project_id: str, user_id: str, min_role: str
) -> str:
    """
    Return the user's role. Raises PermissionError if below min_role.
    """
    role = await get_member_role(db, project_id, user_id)
    if role is None or ROLE_RANK.get(role, -1) < ROLE_RANK.get(min_role, 0):
        raise PermissionError(f"Requires at least '{min_role}' role")
    return role


# ---------------------------------------------------------------------------
# Draft management
# ---------------------------------------------------------------------------

async def get_or_create_draft(
    db: AsyncSession,
    project_id: str,
    user_id: str,
    main_content: str,
    main_version: int,
) -> DocumentDraft:
    """Return existing draft, or create one forked from current main."""
    result = await db.execute(
        select(DocumentDraft).where(
            DocumentDraft.project_id == project_id,
            DocumentDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()
    if draft:
        return draft

    draft = DocumentDraft(
        id=uuid.uuid4(),
        project_id=project_id,
        user_id=user_id,
        content=main_content,
        forked_from_version=main_version,
    )
    db.add(draft)
    await db.commit()
    await db.refresh(draft)
    return draft


async def save_draft(
    db: AsyncSession,
    project_id: str,
    user_id: str,
    content: str,
) -> DocumentDraft:
    result = await db.execute(
        select(DocumentDraft).where(
            DocumentDraft.project_id == project_id,
            DocumentDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise ValueError("Draft not found — call get_or_create_draft first")
    draft.content = content
    draft.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(draft)
    return draft


async def get_draft(
    db: AsyncSession, project_id: str, user_id: str
) -> DocumentDraft | None:
    result = await db.execute(
        select(DocumentDraft).where(
            DocumentDraft.project_id == project_id,
            DocumentDraft.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Push to main
# ---------------------------------------------------------------------------

async def push_to_main(
    db: AsyncSession,
    project_id: str,
    user_id: str,
    draft_content: str,
    ai_summary: str,
    diff_stats: dict | None = None,
) -> DocumentVersion:
    """
    Push the owner's draft to main.  Increments doc_version on the project.
    Only call after verifying user is owner (role check done in router).
    """
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise ValueError("Project not found")

    new_version = project.doc_version + 1
    project.doc_version = new_version
    project.updated_at = datetime.now(timezone.utc)

    version = DocumentVersion(
        id=uuid.uuid4(),
        project_id=project_id,
        pushed_by=user_id,
        version_number=new_version,
        content=draft_content,
        ai_summary=ai_summary,
        diff_stats=diff_stats,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


# ---------------------------------------------------------------------------
# Version history
# ---------------------------------------------------------------------------

async def get_version_history(db: AsyncSession, project_id: str) -> list[DocumentVersion]:
    result = await db.execute(
        select(DocumentVersion)
        .where(DocumentVersion.project_id == project_id)
        .order_by(DocumentVersion.version_number.desc())
    )
    return list(result.scalars().all())


async def get_version(
    db: AsyncSession, project_id: str, version_id: str
) -> DocumentVersion | None:
    result = await db.execute(
        select(DocumentVersion).where(
            DocumentVersion.id == version_id,
            DocumentVersion.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def restore_version(
    db: AsyncSession,
    project_id: str,
    version_id: str,
    restored_by: str,
    ai_summary: str = "",
) -> DocumentVersion:
    """Restore a previous version by pushing it as a new version."""
    old_version = await get_version(db, project_id, version_id)
    if not old_version:
        raise ValueError("Version not found")

    return await push_to_main(
        db,
        project_id,
        restored_by,
        old_version.content,
        ai_summary or f"Restored to v{old_version.version_number}",
        diff_stats=None,
    )


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

async def get_project_members(db: AsyncSession, project_id: str) -> list[dict]:
    # Get the owner
    result = await db.execute(
        select(Project, User)
        .join(User, User.id == Project.user_id)
        .where(Project.id == project_id)
    )
    row = result.first()
    members = []
    if row:
        project, owner = row
        members.append({
            "user_id": str(owner.id),
            "name": owner.name,
            "email": owner.email,
            "role": "owner",
        })

    result = await db.execute(
        select(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
    )
    for member, user in result.all():
        members.append({
            "user_id": str(user.id),
            "name": user.name,
            "email": user.email,
            "role": member.role,
        })
    return members


async def remove_member(
    db: AsyncSession, project_id: str, user_id: str
) -> None:
    await db.execute(
        delete(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    await db.commit()


async def update_member_role(
    db: AsyncSession, project_id: str, user_id: str, role: str
) -> ProjectMember:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise ValueError("Member not found")
    member.role = role
    await db.commit()
    await db.refresh(member)
    return member


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------

async def create_invitation(
    db: AsyncSession,
    project_id: str,
    invited_by: str,
    email: str,
    role: str,
) -> ProjectInvitation:
    token = secrets.token_urlsafe(32)
    invitation = ProjectInvitation(
        id=uuid.uuid4(),
        project_id=project_id,
        invited_by=invited_by,
        email=email,
        role=role,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITATION_EXPIRE_DAYS),
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)
    return invitation


async def get_invitation_by_token(
    db: AsyncSession, token: str
) -> ProjectInvitation | None:
    result = await db.execute(
        select(ProjectInvitation).where(ProjectInvitation.token == token)
    )
    return result.scalar_one_or_none()


async def accept_invitation(
    db: AsyncSession, token: str, user_id: str
) -> ProjectMember:
    invitation = await get_invitation_by_token(db, token)
    if not invitation:
        raise ValueError("Invalid invitation token")
    if invitation.accepted:
        raise ValueError("Invitation already accepted")
    if invitation.expires_at and invitation.expires_at < datetime.now(timezone.utc):
        raise ValueError("Invitation has expired")

    invitation.accepted = True

    # Upsert membership
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == invitation.project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member:
        member.role = invitation.role
    else:
        member = ProjectMember(
            id=uuid.uuid4(),
            project_id=invitation.project_id,
            user_id=user_id,
            role=invitation.role,
        )
        db.add(member)

    await db.commit()
    await db.refresh(member)
    return member


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------

async def get_comments(db: AsyncSession, project_id: str) -> list[dict]:
    result = await db.execute(
        select(Comment, User)
        .join(User, User.id == Comment.user_id)
        .where(Comment.project_id == project_id, Comment.parent_id == None)
        .order_by(Comment.created_at.asc())
    )
    top_level = []
    for comment, user in result.all():
        # Fetch replies
        replies_result = await db.execute(
            select(Comment, User)
            .join(User, User.id == Comment.user_id)
            .where(Comment.parent_id == str(comment.id))
            .order_by(Comment.created_at.asc())
        )
        replies = [
            {
                "id": str(r.id),
                "userId": str(r.user_id),
                "userName": ru.name or ru.email,
                "parentId": str(r.parent_id),
                "lineNumber": r.line_number,
                "content": r.content,
                "resolved": r.resolved,
                "replies": [],
                "createdAt": r.created_at.isoformat(),
            }
            for r, ru in replies_result.all()
        ]
        top_level.append({
            "id": str(comment.id),
            "userId": str(comment.user_id),
            "userName": user.name or user.email,
            "parentId": None,
            "lineNumber": comment.line_number,
            "content": comment.content,
            "resolved": comment.resolved,
            "replies": replies,
            "createdAt": comment.created_at.isoformat(),
        })
    return top_level


async def create_comment(
    db: AsyncSession,
    project_id: str,
    user_id: str,
    content: str,
    line_number: int | None = None,
    parent_id: str | None = None,
) -> Comment:
    comment = Comment(
        id=uuid.uuid4(),
        project_id=project_id,
        user_id=user_id,
        parent_id=parent_id,
        line_number=line_number,
        content=content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


async def resolve_comment(
    db: AsyncSession, comment_id: str, resolved: bool = True
) -> Comment:
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise ValueError("Comment not found")
    comment.resolved = resolved
    comment.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(comment)
    return comment
