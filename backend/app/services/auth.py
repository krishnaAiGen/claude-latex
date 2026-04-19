from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt, JWTError
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, email: str, password: str, name: str | None = None, is_admin: bool = False) -> User:
    user = User(
        email=email,
        password=hash_password(password),
        name=name,
        is_admin=is_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email)
    if not user or not user.password:
        return None
    if not verify_password(password, user.password):
        return None
    return user


async def get_user_by_google_id(db: AsyncSession, google_id: str) -> User | None:
    result = await db.execute(select(User).where(User.google_id == google_id))
    return result.scalar_one_or_none()


async def create_oauth_user(db: AsyncSession, email: str, name: str | None, google_id: str) -> User:
    user = User(email=email, password=None, name=name, google_id=google_id, is_admin=False)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def verify_google_token(credential: str) -> dict:
    """Verify a Google ID token and return its claims. Raises ValueError on failure."""
    return id_token.verify_oauth2_token(
        credential,
        google_requests.Request(),
        settings.google_client_id,
    )


async def ensure_admin_exists(db: AsyncSession) -> None:
    admin = await get_user_by_email(db, settings.admin_email)
    if not admin:
        await create_user(
            db,
            email=settings.admin_email,
            password=settings.admin_password,
            name="Admin",
            is_admin=True,
        )
