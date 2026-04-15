from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.state import AgentState
from app.config import settings

llm = ChatOpenAI(
    model=settings.light_model,
    api_key=settings.openrouter_api_key,
    base_url=settings.openrouter_base_url,
    max_tokens=256,
)

SYSTEM_PROMPT = """You are a classifier. Given a user instruction about a LaTeX document, classify it as one of:
- "modify": The user wants to change, update, fix, or edit existing content
- "question": The user is asking a question about the document without wanting changes
- "generate": The user wants to create entirely new content or a new section from scratch

Respond with ONLY one word: modify, question, or generate."""


async def parse_instruction(state: AgentState) -> dict:
    instruction = state["user_instruction"]
    context = ""
    if state.get("selected_text"):
        context = f"\n\nSelected text from document:\n```\n{state['selected_text']}\n```"

    response = await llm.ainvoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=f"Instruction: {instruction}{context}"),
        ]
    )

    intent = response.content.strip().lower()
    if intent not in ("modify", "question", "generate"):
        intent = "modify"

    return {"parsed_intent": intent}
