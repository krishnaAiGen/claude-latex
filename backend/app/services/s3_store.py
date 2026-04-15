import os

import boto3
from botocore.exceptions import ClientError

from app.config import settings

_client = None


def get_s3():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            region_name=settings.s3_region,
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
        )
    return _client


def _prefix(user_id: str, project_id: str) -> str:
    return f"users/{user_id}/projects/{project_id}/"


def _skip_file(name: str) -> bool:
    skip_exts = {".aux", ".log", ".out", ".toc", ".fls", ".fdb_latexmk", ".synctex.gz"}
    ext = os.path.splitext(name)[1]
    return name.startswith(".") or ext in skip_exts


def list_files(user_id: str, project_id: str) -> list[dict]:
    """List all files for a user as a nested tree."""
    s3 = get_s3()
    prefix = _prefix(user_id, project_id)

    paginator = s3.get_paginator("list_objects_v2")
    all_keys = []
    for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            rel = obj["Key"][len(prefix):]
            if rel and not _skip_file(os.path.basename(rel)):
                all_keys.append({"key": rel, "size": obj["Size"]})

    # Build tree from flat keys
    return _build_tree(all_keys)


def _build_tree(keys: list[dict]) -> list[dict]:
    """Convert flat S3 keys to nested tree structure."""
    root: dict = {}

    for item in keys:
        parts = item["key"].split("/")
        current = root
        for i, part in enumerate(parts):
            if part not in current:
                current[part] = {} if i < len(parts) - 1 else {"__size__": item["size"]}
            current = current[part]

    def to_list(node: dict, parent_path: str = "") -> list[dict]:
        result = []
        for name, value in sorted(node.items(), key=lambda x: (not isinstance(x[1], dict) or "__size__" in x[1], x[0].lower())):
            path = f"{parent_path}/{name}".lstrip("/")
            if "__size__" in value:
                result.append({"name": name, "path": path, "type": "file", "size": value["__size__"]})
            else:
                children = to_list(value, path)
                result.append({"name": name, "path": path, "type": "folder", "children": children})
        return result

    return to_list(root)


def read_file(user_id: str, project_id: str, path: str) -> bytes:
    s3 = get_s3()
    key = _prefix(user_id, project_id) + path
    try:
        response = s3.get_object(Bucket=settings.s3_bucket, Key=key)
        return response["Body"].read()
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            raise FileNotFoundError(f"File not found: {path}")
        raise


def read_file_text(user_id: str, project_id: str, path: str) -> str:
    return read_file(user_id, project_id, path).decode("utf-8")


def write_file(user_id: str, project_id: str, path: str, data: bytes) -> None:
    s3 = get_s3()
    key = _prefix(user_id, project_id) + path
    s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=data)


def write_file_text(user_id: str, project_id: str, path: str, content: str) -> None:
    write_file(user_id, project_id, path, content.encode("utf-8"))


def delete_file(user_id: str, project_id: str, path: str) -> None:
    s3 = get_s3()
    prefix = _prefix(user_id, project_id) + path

    # Check if it's a "folder" (prefix with multiple objects)
    response = s3.list_objects_v2(Bucket=settings.s3_bucket, Prefix=prefix + "/", MaxKeys=1)
    if response.get("KeyCount", 0) > 0:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix + "/"):
            objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
            if objects:
                s3.delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": objects})
    else:
        s3.delete_object(Bucket=settings.s3_bucket, Key=prefix)


def delete_project_files(user_id: str, project_id: str) -> None:
    """Delete ALL files for a project from S3."""
    s3 = get_s3()
    prefix = _prefix(user_id, project_id)
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if objects:
            s3.delete_objects(Bucket=settings.s3_bucket, Delete={"Objects": objects})


def upload_file(user_id: str, project_id: str, path: str, data: bytes) -> None:
    write_file(user_id, project_id, path, data)


def create_folder(user_id: str, project_id: str, path: str) -> None:
    """S3 doesn't have real folders — create a zero-byte marker."""
    s3 = get_s3()
    key = _prefix(user_id, project_id) + path.rstrip("/") + "/"
    s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=b"")


def download_all_to_dir(user_id: str, project_id: str, local_dir: str) -> None:
    """Download all project files from S3 to a local directory (for compilation)."""
    s3 = get_s3()
    prefix = _prefix(user_id, project_id)

    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            rel = obj["Key"][len(prefix):]
            if not rel or rel.endswith("/"):
                continue
            local_path = os.path.join(local_dir, rel)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            s3.download_file(settings.s3_bucket, obj["Key"], local_path)


def upload_from_dir(user_id: str, project_id: str, local_dir: str, filename: str) -> None:
    """Upload a specific file from local dir back to S3."""
    local_path = os.path.join(local_dir, filename)
    if os.path.exists(local_path):
        with open(local_path, "rb") as f:
            write_file(user_id, project_id, filename, f.read())


def ensure_default_tex(user_id: str, project_id: str, default_content: str) -> None:
    """Create main.tex for a new project if it doesn't exist."""
    try:
        read_file(user_id, project_id, "main.tex")
    except FileNotFoundError:
        write_file_text(user_id, project_id, "main.tex", default_content)
