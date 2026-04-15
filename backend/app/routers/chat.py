from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.middleware.auth import get_current_user
from app.models.user import ChatMessage

router = APIRouter()


class SaveMessageRequest(BaseModel):
    role: str
    content: str
    context: dict | None = None


@router.get("/projects/{project_id}/chat/messages")
async def list_messages(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == user["id"], ChatMessage.project_id == project_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return {
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "context": m.context,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ]
    }


@router.post("/projects/{project_id}/chat/messages")
async def save_message(
    project_id: str,
    body: SaveMessageRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    msg = ChatMessage(
        user_id=user["id"],
        project_id=project_id,
        role=body.role,
        content=body.content,
        context=body.context,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return {"id": str(msg.id)}


@router.delete("/projects/{project_id}/chat/messages")
async def clear_messages(
    project_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(ChatMessage).where(
            ChatMessage.user_id == user["id"],
            ChatMessage.project_id == project_id,
        )
    )
    await db.commit()
    return {"cleared": True}
