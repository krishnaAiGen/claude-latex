#!/usr/bin/env python3
"""CLI to manage users for Claude LaTeX Editor.

Usage:
  python manage_users.py create user@example.com          # auto-generate password
  python manage_users.py create user@example.com mypass    # custom password
  python manage_users.py list                              # show all users
"""

import asyncio
import json
import secrets
import string
import sys
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.db import engine, AsyncSessionLocal, Base
from app.models.user import User
from app.services.auth import hash_password

CREDENTIALS_FILE = Path(__file__).parent / "credentials.json"


def generate_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _load_credentials() -> dict:
    if CREDENTIALS_FILE.exists():
        return json.loads(CREDENTIALS_FILE.read_text())
    return {}


def _save_credential(email: str, password: str):
    creds = _load_credentials()
    creds[email] = password
    CREDENTIALS_FILE.write_text(json.dumps(creds, indent=2))


async def create_user(email: str, password: str | None = None):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    pwd = password or generate_password()

    async with AsyncSessionLocal() as db:
        # Check if exists
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"Error: User {email} already exists.")
            sys.exit(1)

        user = User(
            email=email,
            password=hash_password(pwd),
            name=email.split("@")[0],
            is_admin=False,
        )
        db.add(user)
        await db.commit()

    # Save plain password locally
    _save_credential(email, pwd)

    print(f"User created successfully!")
    print(f"  Email:    {email}")
    print(f"  Password: {pwd}")
    print()


async def list_users():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).order_by(User.created_at))
        users = result.scalars().all()

    if not users:
        print("No users found.")
        return

    creds = _load_credentials()

    print(f"{'Email':<40} {'Password':<16} {'Name':<20} {'Admin':<8} {'Created'}")
    print("-" * 110)
    for u in users:
        admin = "Yes" if u.is_admin else "No"
        created = u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "N/A"
        pwd = creds.get(u.email, "(unknown)")
        print(f"{u.email:<40} {pwd:<16} {(u.name or ''):<20} {admin:<8} {created}")

    print(f"\nTotal: {len(users)} user(s)")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "create":
        if len(sys.argv) < 3:
            print("Usage: python manage_users.py create <email> [password]")
            sys.exit(1)
        email = sys.argv[2]
        password = sys.argv[3] if len(sys.argv) > 3 else None
        asyncio.run(create_user(email, password))

    elif command == "list":
        asyncio.run(list_users())

    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
