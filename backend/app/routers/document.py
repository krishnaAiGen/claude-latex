from fastapi import APIRouter, Depends

from app.models.document import DocumentContent, DocumentResponse
from app.services.document_store import read_document, write_document
from app.middleware.auth import get_current_user

router = APIRouter()


@router.get("/projects/{project_id}/document", response_model=DocumentResponse)
async def get_document(project_id: str, user: dict = Depends(get_current_user)):
    content, last_modified = read_document(user["id"], project_id)
    return DocumentResponse(latex_content=content, last_modified=last_modified)


@router.put("/projects/{project_id}/document")
async def update_document(project_id: str, body: DocumentContent, user: dict = Depends(get_current_user)):
    last_modified = write_document(user["id"], project_id, body.latex_content)
    return {"last_modified": last_modified}
