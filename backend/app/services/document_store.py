from datetime import datetime, timezone

from app.services.s3_store import read_file_text, write_file_text


def read_document(user_id: str, project_id: str) -> tuple[str, str]:
    content = read_file_text(user_id, project_id, "main.tex")
    now = datetime.now(timezone.utc).isoformat()
    return content, now


def write_document(user_id: str, project_id: str, content: str) -> str:
    write_file_text(user_id, project_id, "main.tex", content)
    now = datetime.now(timezone.utc).isoformat()
    return now
