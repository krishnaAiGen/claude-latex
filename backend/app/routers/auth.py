from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.services.auth import (
    authenticate_user,
    create_token,
    create_user,
    get_user_by_email,
    get_user_by_google_id,
    create_oauth_user,
    verify_google_token,
)
from app.middleware.auth import get_current_user, get_admin_user

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: str | None = None


@router.post("/auth/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(str(user.id))
    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "is_admin": user.is_admin,
        },
    }


class GoogleAuthRequest(BaseModel):
    credential: str


@router.post("/auth/google")
async def google_auth(body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    if not body.credential:
        raise HTTPException(status_code=400, detail="Missing credential")
    try:
        claims = verify_google_token(body.credential)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {e}")

    google_id: str = claims["sub"]
    email: str = claims.get("email", "")
    name: str | None = claims.get("name")

    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")

    # 3-path lookup: google_id → link existing email account → create new
    user = await get_user_by_google_id(db, google_id)
    if not user:
        user = await get_user_by_email(db, email)
        if user:
            user.google_id = google_id
            await db.commit()
            await db.refresh(user)
        else:
            user = await create_oauth_user(db, email=email, name=name, google_id=google_id)

    token = create_token(str(user.id))
    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "is_admin": user.is_admin,
        },
    }


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}


@router.post("/auth/create-user")
async def admin_create_user(
    body: CreateUserRequest,
    admin: dict = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await create_user(db, body.email, body.password, body.name)
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
        }
    }
