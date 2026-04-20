from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.services.auth import decode_token, get_user_by_id


async def get_current_user(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.removeprefix("Bearer ").strip()
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "is_admin": user.is_admin,
    }


async def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_project_role(min_role: str):
    """
    FastAPI dependency factory.  Returns a dependency that checks the calling
    user has at least `min_role` on the project specified by `project_id` in
    the path.

    Usage::

        @router.get("/projects/{project_id}/something")
        async def handler(
            project_id: str,
            user: dict = Depends(get_current_user),
            _role: str = Depends(require_project_role("editor")),
            db: AsyncSession = Depends(get_db),
        ): ...
    """
    async def _check(
        project_id: str,
        user: dict = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> str:
        from app.services.collaboration import require_role
        try:
            return await require_role(db, project_id, user["id"], min_role)
        except PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))

    return _check
