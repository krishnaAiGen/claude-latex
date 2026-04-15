import os
import shutil

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import Response

from app.models.files import CreateFileRequest, RenameRequest, FileContentUpdate
from app.services import file_store
from app.services.compiler import get_cache_dir
from app.middleware.auth import get_current_user

router = APIRouter()


def _sync_to_cache(user_id: str, project_id: str, rel_path: str, data: bytes):
    """Write a file to local cache so it's available for compilation."""
    cache_dir = get_cache_dir(user_id, project_id)
    local_path = os.path.join(cache_dir, rel_path)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "wb") as f:
        f.write(data)


def _delete_from_cache(user_id: str, project_id: str, rel_path: str):
    """Remove a file/folder from local cache."""
    cache_dir = get_cache_dir(user_id, project_id)
    local_path = os.path.join(cache_dir, rel_path)
    if os.path.isdir(local_path):
        shutil.rmtree(local_path, ignore_errors=True)
    elif os.path.exists(local_path):
        os.remove(local_path)


@router.get("/projects/{project_id}/files")
async def list_files(project_id: str, user: dict = Depends(get_current_user)):
    return {"files": file_store.list_files(user["id"], project_id)}


@router.post("/projects/{project_id}/files")
async def create_file_or_folder(project_id: str, body: CreateFileRequest, user: dict = Depends(get_current_user)):
    try:
        if body.type == "folder":
            path = file_store.create_folder(user["id"], project_id, body.name, body.parent_path)
        else:
            path = file_store.create_file(user["id"], project_id, body.name, body.parent_path)
            _sync_to_cache(user["id"], project_id, path, b"")
        return {"path": path}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/projects/{project_id}/files/{file_path:path}")
async def read_file(project_id: str, file_path: str, user: dict = Depends(get_current_user)):
    try:
        text_extensions = {".tex", ".bib", ".cls", ".sty", ".txt", ".md", ".csv", ".bst"}
        ext = "." + file_path.rsplit(".", 1)[-1] if "." in file_path else ""

        if ext.lower() in text_extensions:
            content = file_store.read_file(user["id"], project_id, file_path)
            return {"content": content, "path": file_path}
        else:
            data = file_store.read_file_bytes(user["id"], project_id, file_path)
            return Response(content=data, media_type="application/octet-stream")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/projects/{project_id}/files/{file_path:path}")
async def update_file(project_id: str, file_path: str, body: FileContentUpdate, user: dict = Depends(get_current_user)):
    try:
        file_store.write_file(user["id"], project_id, file_path, body.content)
        _sync_to_cache(user["id"], project_id, file_path, body.content.encode("utf-8"))
        return {"path": file_path}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/projects/{project_id}/files/{file_path:path}")
async def delete_file(project_id: str, file_path: str, user: dict = Depends(get_current_user)):
    try:
        file_store.delete_path(user["id"], project_id, file_path)
        _delete_from_cache(user["id"], project_id, file_path)
        return {"deleted": file_path}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/files/upload")
async def upload_files(
    project_id: str,
    file: UploadFile = File(...),
    parent_path: str = Form(default=""),
    user: dict = Depends(get_current_user),
):
    try:
        data = await file.read()
        path = file_store.save_upload(user["id"], project_id, file.filename or "upload", parent_path, data)
        _sync_to_cache(user["id"], project_id, path, data)
        return {"path": path}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/projects/{project_id}/files/rename")
async def rename_file(project_id: str, body: RenameRequest, user: dict = Depends(get_current_user)):
    try:
        file_store.rename_path(user["id"], project_id, body.old_path, body.new_path)
        # Update local cache
        cache_dir = get_cache_dir(user["id"], project_id)
        old_local = os.path.join(cache_dir, body.old_path)
        new_local = os.path.join(cache_dir, body.new_path)
        if os.path.exists(old_local):
            os.makedirs(os.path.dirname(new_local), exist_ok=True)
            os.rename(old_local, new_local)
        return {"path": body.new_path}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
