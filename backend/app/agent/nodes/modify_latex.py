import re

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.state import AgentState
from app.config import settings
from app.services.diff import compute_diff


def _get_llm(state: AgentState, max_tokens: int = 4096) -> ChatOpenAI:
    model = state.get("model") or settings.heavy_model
    return ChatOpenAI(
        model=model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        max_tokens=max_tokens,
    )

SYSTEM_PROMPT = """You are an expert LaTeX editor. Modify the document using SEARCH/REPLACE blocks.

For each change, output a block in this exact format:

<<<SEARCH
exact lines from the original document to find
>>>REPLACE
the new lines to replace them with
<<<END

Rules:
1. The SEARCH block must match the original document EXACTLY (including whitespace)
2. Only include the minimal lines needed for each change
3. You can output multiple SEARCH/REPLACE blocks for multiple changes
4. Do NOT output the full document — only the changes
5. Add a brief one-line explanation before each block
6. If adding new content, use a SEARCH block that matches the line BEFORE where you want to insert"""


def apply_patches(original: str, response_text: str) -> str:
    """Apply SEARCH/REPLACE blocks to the original document."""
    result = original

    # Parse all SEARCH/REPLACE blocks
    pattern = r"<<<SEARCH\n(.*?)>>>REPLACE\n(.*?)<<<END"
    blocks = re.findall(pattern, response_text, re.DOTALL)

    for search, replace in blocks:
        search = search.rstrip("\n")
        replace = replace.rstrip("\n")

        if search in result:
            result = result.replace(search, replace, 1)

    return result


async def modify_latex(state: AgentState) -> dict:
    instruction = state["user_instruction"]
    latex = state["latex_content"]

    # Add line numbers to help the model reference specific lines
    numbered_lines = "\n".join(
        f"{i+1:4d} | {line}" for i, line in enumerate(latex.split("\n"))
    )

    user_msg = f"Document (with line numbers for reference, do NOT include line numbers in SEARCH blocks):\n```\n{numbered_lines}\n```\n\nInstruction: {instruction}"

    if state.get("selected_text"):
        user_msg += f"\n\nSelected text to modify:\n```latex\n{state['selected_text']}\n```"

    if state.get("selection_range"):
        r = state["selection_range"]
        user_msg += f"\n(Lines {r.get('start_line', '?')}-{r.get('end_line', '?')})"

    llm = _get_llm(state)
    response = await llm.ainvoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ]
    )

    response_text = response.content.strip()

    # Apply patches to get the modified document
    modified = apply_patches(latex, response_text)

    # If no patches were applied (model didn't follow format), fall back to treating response as full doc
    if modified == latex and "<<<SEARCH" not in response_text:
        # Strip markdown fences if present
        fallback = response_text
        if fallback.startswith("```"):
            lines = fallback.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            fallback = "\n".join(lines)
        if len(fallback) > 50:  # sanity check — looks like a real document
            modified = fallback

    diff = compute_diff(latex, modified)

    return {"modified_latex": modified, "diff": diff}


async def generate_latex(state: AgentState) -> dict:
    """Handle 'generate' intent - create new content from scratch.
    For generation, we still need the full output."""
    instruction = state["user_instruction"]
    latex = state["latex_content"]

    gen_llm = _get_llm(state, max_tokens=8192)

    response = await gen_llm.ainvoke(
        [
            SystemMessage(content="You are an expert LaTeX editor. Return ONLY the complete modified LaTeX document. Do NOT wrap in markdown code blocks."),
            HumanMessage(content=f"Current document:\n```latex\n{latex}\n```\n\nInstruction: {instruction}"),
        ]
    )

    modified = response.content.strip()
    if modified.startswith("```"):
        lines = modified.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        modified = "\n".join(lines)

    diff = compute_diff(latex, modified)
    return {"modified_latex": modified, "diff": diff}
