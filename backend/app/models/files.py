from pydantic import BaseModel


class FileNode(BaseModel):
    name: str
    path: str
    type: str  # "file" or "folder"
    size: int | None = None
    children: list["FileNode"] | None = None


class CreateFileRequest(BaseModel):
    name: str
    parent_path: str = ""
    type: str = "file"  # "file" or "folder"


class RenameRequest(BaseModel):
    old_path: str
    new_path: str


class FileContentUpdate(BaseModel):
    content: str
