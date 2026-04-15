"""File store - delegates to S3 with user+project scoped paths."""

from app.services import s3_store


def list_files(user_id: str, project_id: str) -> list[dict]:
    return s3_store.list_files(user_id, project_id)


def read_file(user_id: str, project_id: str, path: str) -> str:
    return s3_store.read_file_text(user_id, project_id, path)


def read_file_bytes(user_id: str, project_id: str, path: str) -> bytes:
    return s3_store.read_file(user_id, project_id, path)


def write_file(user_id: str, project_id: str, path: str, content: str) -> None:
    s3_store.write_file_text(user_id, project_id, path, content)


def create_file(user_id: str, project_id: str, name: str, parent_path: str = "") -> str:
    rel = f"{parent_path}/{name}".lstrip("/") if parent_path else name
    s3_store.write_file_text(user_id, project_id, rel, "")
    return rel


def create_folder(user_id: str, project_id: str, name: str, parent_path: str = "") -> str:
    rel = f"{parent_path}/{name}".lstrip("/") if parent_path else name
    s3_store.create_folder(user_id, project_id, rel)
    return rel


def delete_path(user_id: str, project_id: str, path: str) -> None:
    s3_store.delete_file(user_id, project_id, path)


def rename_path(user_id: str, project_id: str, old_path: str, new_path: str) -> None:
    data = s3_store.read_file(user_id, project_id, old_path)
    s3_store.write_file(user_id, project_id, new_path, data)
    s3_store.delete_file(user_id, project_id, old_path)


def save_upload(user_id: str, project_id: str, filename: str, parent_path: str, data: bytes) -> str:
    rel = f"{parent_path}/{filename}".lstrip("/") if parent_path else filename
    s3_store.upload_file(user_id, project_id, rel, data)
    return rel
