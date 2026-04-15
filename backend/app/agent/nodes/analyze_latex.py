from app.agent.state import AgentState
from app.utils.latex_parser import get_structure_summary


async def analyze_latex(state: AgentState) -> dict:
    summary = get_structure_summary(state["latex_content"])
    from langchain_core.messages import SystemMessage

    return {
        "messages": [
            SystemMessage(content=f"Document structure analysis:\n{summary}")
        ]
    }
