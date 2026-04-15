from pydantic import BaseModel


class SelectionContext(BaseModel):
    selected_text: str | None = None
    selection_range: dict | None = None  # {start_line, end_line}


class ChatMessage(BaseModel):
    type: str = "chat_message"
    content: str
    context: SelectionContext | None = None


class AgentResponse(BaseModel):
    type: str = "agent_response"
    message: str
    latex_content: str | None = None
    diff: list[dict] | None = None
    pdf_url: str | None = None
    compilation: dict | None = None
