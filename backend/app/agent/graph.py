from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END

from app.agent.state import AgentState
from app.agent.nodes.parse_instruction import parse_instruction
from app.agent.nodes.analyze_latex import analyze_latex
from app.agent.nodes.modify_latex import modify_latex
from app.agent.nodes.validate_latex import validate_latex
from app.agent.nodes.compile_pdf import compile_pdf
from app.config import settings


async def answer_question(state: AgentState) -> dict:
    """Answer a question about the document without modifying it."""
    from langchain_core.messages import SystemMessage, HumanMessage

    model = state.get("model") or settings.heavy_model
    llm = ChatOpenAI(
        model=model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        max_tokens=1024,
    )
    # Build conversation context from checkpointed messages
    messages = state.get("messages", [])
    chat_history = [m for m in messages if hasattr(m, "type") and m.type in ("human", "ai")]
    recent = chat_history[-11:-1]
    conv_ctx = ""
    if recent:
        parts = []
        for m in recent:
            role = "User" if m.type == "human" else "AI"
            content = m.content[:300] + "..." if len(m.content) > 300 else m.content
            parts.append(f"{role}: {content}")
        conv_ctx = "Recent conversation:\n" + "\n".join(parts) + "\n\n"

    response = await llm.ainvoke(
        [
            SystemMessage(
                content="You are a helpful LaTeX expert. Answer the user's question about their document concisely. Use conversation history for context when available."
            ),
            HumanMessage(
                content=f"{conv_ctx}Document:\n```latex\n{state['latex_content']}\n```\n\n"
                f"Question: {state['user_instruction']}"
            ),
        ]
    )
    usage = response.usage_metadata or {}
    print(f"[ANSWER] Tokens: in={usage.get('input_tokens', '?')} out={usage.get('output_tokens', '?')} total={usage.get('total_tokens', '?')}")
    return {
        "response_message": response.content,
        "messages": [AIMessage(content=response.content)],
    }


async def respond_to_user(state: AgentState) -> dict:
    """Format the final response after modification + compilation."""
    parts = []

    if state.get("modified_latex"):
        parts.append("I've prepared the following changes:")

    patches = state.get("raw_patches")
    if patches:
        parts.append(f"\n```\n{patches}\n```\n")

    comp = state.get("compilation_result", {})
    if comp.get("success"):
        parts.append("Review the changes in the editor and click **Accept** or **Reject**.")
    elif comp.get("errors"):
        error_lines = []
        for e in comp["errors"]:
            line_prefix = f"Line {e['line']}: " if e.get("line") else ""
            error_lines.append(f"- `{line_prefix}{e.get('message', '')}`")
        parts.append("**Compilation errors:**\n" + "\n".join(error_lines))
        parts.append("\n*Copy the errors above and paste them back here to ask me to fix them.*")

    message = "\n".join(parts) if parts else "Done."

    return {
        "response_message": message,
        "latex_content": state.get("modified_latex") or state["latex_content"],
        "messages": [AIMessage(content=message)],
    }


async def handle_clarification(state: AgentState) -> dict:
    """When confidence is low, ask the user for clarification."""
    classification = state.get("classification") or {}
    clarification = classification.get("clarification", "Could you be more specific about what you'd like me to change?")

    print(f"[CLARIFY] Asking user: {clarification}")

    return {
        "response_message": clarification,
        "messages": [AIMessage(content=clarification)],
    }


def route_after_parse(state: AgentState) -> str:
    """Route based on classification result."""
    classification = state.get("classification") or {}

    # Low confidence → ask for clarification
    if classification.get("confidence") == "low" and classification.get("clarification"):
        return "handle_clarification"

    actions = classification.get("actions", [])
    if not actions:
        return "modify_latex"

    first_type = actions[0].get("type", "modify")
    if first_type == "question":
        # Check if there's also a modify action
        if len(actions) > 1 and actions[1].get("type") == "modify":
            return "answer_then_modify"
        return "answer_question"

    return "modify_latex"


async def answer_then_modify(state: AgentState) -> dict:
    """Handle combined question + modify: answer first, then proceed to modify."""
    result = await answer_question(state)
    # Store the answer and continue to modify
    return {
        "response_message": result["response_message"],
        "messages": result["messages"],
    }


def route_validation(state: AgentState) -> str:
    """After validation, retry modify if errors exist and retries < 2."""
    retry_count = state.get("retry_count", 0)
    messages = state.get("messages", [])
    last_msg = messages[-1] if messages else None

    has_errors = (
        last_msg
        and hasattr(last_msg, "content")
        and "Validation errors" in str(last_msg.content)
    )

    if has_errors and retry_count < 2:
        return "modify_latex"
    return "compile_pdf"


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("analyze_latex", analyze_latex)
    graph.add_node("parse_instruction", parse_instruction)
    graph.add_node("modify_latex", modify_latex)
    graph.add_node("validate_latex", validate_latex)
    graph.add_node("compile_pdf", compile_pdf)
    graph.add_node("answer_question", answer_question)
    graph.add_node("answer_then_modify", answer_then_modify)
    graph.add_node("respond_to_user", respond_to_user)
    graph.add_node("handle_clarification", handle_clarification)

    # Entry: analyze first (build skeleton + ref map), then classify
    graph.set_entry_point("analyze_latex")
    graph.add_edge("analyze_latex", "parse_instruction")

    # Route based on classification
    graph.add_conditional_edges(
        "parse_instruction",
        route_after_parse,
        {
            "modify_latex": "modify_latex",
            "answer_question": "answer_question",
            "answer_then_modify": "answer_then_modify",
            "handle_clarification": "handle_clarification",
        },
    )

    # answer_then_modify → proceed to modify
    graph.add_edge("answer_then_modify", "modify_latex")

    # Modify flow
    graph.add_edge("modify_latex", "validate_latex")

    graph.add_conditional_edges(
        "validate_latex",
        route_validation,
        {
            "modify_latex": "modify_latex",
            "compile_pdf": "compile_pdf",
        },
    )

    # Terminal nodes
    graph.add_edge("compile_pdf", "respond_to_user")
    graph.add_edge("answer_question", END)
    graph.add_edge("respond_to_user", END)
    graph.add_edge("handle_clarification", END)

    return graph


# Graph compiled at module level, checkpointer attached at startup
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from app.config import settings

_graph = build_graph()
agent_graph = None  # set in init_agent()


_checkpointer_cm = None
_checkpointer = None


async def init_agent():
    """Initialize the agent graph with PostgreSQL-backed checkpointer. Call at app startup."""
    global agent_graph, _checkpointer_cm, _checkpointer
    # psycopg needs raw postgresql:// not SQLAlchemy's postgresql+psycopg://
    raw_url = settings.database_url.replace("postgresql+psycopg://", "postgresql://")
    _checkpointer_cm = AsyncPostgresSaver.from_conn_string(raw_url)
    _checkpointer = await _checkpointer_cm.__aenter__()
    await _checkpointer.setup()  # creates checkpoint tables if needed
    agent_graph = _graph.compile(checkpointer=_checkpointer)
    print("[AGENT] Graph compiled with PostgresSaver checkpointer")
