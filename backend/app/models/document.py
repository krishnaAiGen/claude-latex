from pydantic import BaseModel


class DocumentContent(BaseModel):
    latex_content: str


class DocumentResponse(BaseModel):
    latex_content: str
    last_modified: str
