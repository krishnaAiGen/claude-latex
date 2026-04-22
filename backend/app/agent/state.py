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

    # Stage 1 classification result
    classification: dict | None  # {actions, confidence, clarification}
    skeleton: str | None         # document structure summary
    ref_map_summary: str | None  # reference dependency summary

    # Comment-targeted context
    comment_line: int | None
    comment_text: str | None

    # Stage 2 results
    modified_latex: str | None
    raw_patches: str | None
    diff: list[dict] | None
    compilation_result: dict | None
    response_message: str | None
    retry_count: int
