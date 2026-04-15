from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage
from langgraph.graph import StateGraph, END

from app.agent.state import AgentState
from app.agent.nodes.parse_instruction import parse_instruction
from app.agent.nodes.analyze_latex import analyze_latex
from app.agent.nodes.modify_latex import modify_latex, generate_latex
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
    response = await llm.ainvoke(
        [
            SystemMessage(
                content="You are a helpful LaTeX expert. Answer the user's question about their document concisely."
            ),
            HumanMessage(
                content=f"Document:\n```latex\n{state['latex_content']}\n```\n\n"
                f"Question: {state['user_instruction']}"
            ),
        ]
    )
    return {
        "response_message": response.content,
        "messages": [AIMessage(content=response.content)],
    }


async def respond_to_user(state: AgentState) -> dict:
    """Format the final response after modification + compilation."""
    parts = []

    if state.get("modified_latex"):
        parts.append("I've updated the document.")

    comp = state.get("compilation_result", {})
    if comp.get("success"):
        parts.append("PDF compiled successfully.")
    elif comp.get("errors"):
        error_msgs = [e.get("message", "") for e in comp["errors"]]
        parts.append("Compilation errors:\n" + "\n".join(f"- {m}" for m in error_msgs))

    message = " ".join(parts) if parts else "Done."

    return {
        "response_message": message,
        "latex_content": state.get("modified_latex") or state["latex_content"],
        "messages": [AIMessage(content=message)],
    }


def route_intent(state: AgentState) -> str:
    intent = state.get("parsed_intent", "modify")
    if intent == "question":
        return "answer_question"
    elif intent == "generate":
        return "generate_latex"
    return "analyze_latex"


def route_validation(state: AgentState) -> str:
    """After validation, retry modify if errors exist and retries < 2."""
    retry_count = state.get("retry_count", 0)
    # Check if there are validation error messages
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
    graph.add_node("parse_instruction", parse_instruction)
    graph.add_node("analyze_latex", analyze_latex)
    graph.add_node("modify_latex", modify_latex)
    graph.add_node("generate_latex", generate_latex)
    graph.add_node("validate_latex", validate_latex)
    graph.add_node("compile_pdf", compile_pdf)
    graph.add_node("answer_question", answer_question)
    graph.add_node("respond_to_user", respond_to_user)

    # Set entry point
    graph.set_entry_point("parse_instruction")

    # Conditional routing after intent classification
    graph.add_conditional_edges(
        "parse_instruction",
        route_intent,
        {
            "analyze_latex": "analyze_latex",
            "answer_question": "answer_question",
            "generate_latex": "generate_latex",
        },
    )

    # Linear flow for modify path
    graph.add_edge("analyze_latex", "modify_latex")
    graph.add_edge("modify_latex", "validate_latex")

    # Validation can retry or proceed
    graph.add_conditional_edges(
        "validate_latex",
        route_validation,
        {
            "modify_latex": "modify_latex",
            "compile_pdf": "compile_pdf",
        },
    )

    # Generate path
    graph.add_edge("generate_latex", "validate_latex")

    # After compilation and question, respond
    graph.add_edge("compile_pdf", "respond_to_user")
    graph.add_edge("answer_question", END)
    graph.add_edge("respond_to_user", END)

    return graph


# Compiled graph singleton
agent_graph = build_graph().compile()
