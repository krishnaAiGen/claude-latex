from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph import add_messages


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    latex_content: str
    user_instruction: str
    selected_text: str | None
    selection_range: dict | None
    user_id: str
    project_id: str
    model: str | None
    parsed_intent: str | None  # "modify", "question", "generate"
    modified_latex: str | None
    diff: list[dict] | None
    compilation_result: dict | None
    response_message: str | None
    retry_count: int
