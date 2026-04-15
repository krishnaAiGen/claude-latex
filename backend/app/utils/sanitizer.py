from pathlib import Path

from app.config import settings


def is_safe_path(path: str) -> bool:
    resolved = Path(path).resolve()
    storage = settings.storage_dir.resolve()
    return str(resolved).startswith(str(storage))
