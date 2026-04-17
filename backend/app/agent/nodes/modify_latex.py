import re

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.state import AgentState
from app.config import settings
from app.services.diff import compute_diff
from app.utils.section_extractor import extract_sections, extract_full_document


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
6. If adding new content, use a SEARCH block that matches the line BEFORE where you want to insert
7. Do NOT include line numbers in SEARCH blocks — they are for reference only
8. When adding new LaTeX environments (theorem, lemma, etc.), also add required \\newtheorem declarations to the preamble if they are missing"""


def apply_patches(original: str, response_text: str) -> str:
    """Apply SEARCH/REPLACE blocks to the original document."""
    result = original

    pattern = r"<<<SEARCH\n(.*?)>>>REPLACE\n(.*?)<<<END"
    blocks = re.findall(pattern, response_text, re.DOTALL)

    applied = 0
    for search, replace in blocks:
        search = search.rstrip("\n")
        replace = replace.rstrip("\n")

        if search in result:
            result = result.replace(search, replace, 1)
            applied += 1
        else:
            print(f"[MODIFY] WARN: SEARCH block not found ({len(search)} chars): {search[:60]}...")

    print(f"[MODIFY] Patches: {len(blocks)} total, {applied} applied, {len(blocks) - applied} failed")
    return result


async def modify_latex(state: AgentState) -> dict:
    instruction = state["user_instruction"]
    latex = state["latex_content"]
    classification = state.get("classification") or {}
    actions = classification.get("actions", [{}])

    # Determine scope and target sections from classification
    first_action = actions[0] if actions else {}
    scope = first_action.get("scope", "global")
    target_sections = first_action.get("sections", [])
    include_preamble = first_action.get("include_preamble", False)

    # Build the document context based on scope
    if scope == "local" and target_sections:
        doc_context = extract_sections(latex, target_sections, include_preamble)
        context_note = f"(showing only relevant sections: {', '.join(target_sections)})"
    else:
        doc_context = extract_full_document(latex)
        context_note = "(full document)"

    # Build conversation context from checkpointed messages (last 5 turns)
    conversation_context = ""
    messages = state.get("messages", [])
    # Filter to human/AI messages only, skip system messages, take last 10 (5 turns = 5 user + 5 AI)
    chat_history = [
        m for m in messages
        if hasattr(m, "type") and m.type in ("human", "ai")
    ]
    recent = chat_history[-11:-1]  # last 10 messages (exclude current), i.e., 5 turns
    if recent:
        history_parts = []
        for m in recent:
            role = "User" if m.type == "human" else "AI"
            # Truncate long AI responses to save tokens
            content = m.content[:300] + "..." if len(m.content) > 300 else m.content
            history_parts.append(f"{role}: {content}")
        conversation_context = "Recent conversation:\n" + "\n".join(history_parts) + "\n\n"
        print(f"[MODIFY] Including {len(recent)} messages of conversation context")

    user_msg = f"{conversation_context}Document {context_note}:\n```\n{doc_context}\n```\n\nInstruction: {instruction}"

    if state.get("selected_text"):
        user_msg += f"\n\nSelected text to modify:\n```latex\n{state['selected_text']}\n```"

    if state.get("selection_range"):
        r = state["selection_range"]
        user_msg += f"\n(Lines {r.get('start_line', '?')}-{r.get('end_line', '?')})"

    llm = _get_llm(state)
    model_name = state.get("model") or settings.heavy_model
    input_tokens_approx = len(user_msg) // 4  # rough estimate
    print(f"[MODIFY] Using model: {model_name}")
    print(f"[MODIFY] Scope: {scope} | Sections: {target_sections} | Preamble: {include_preamble}")
    print(f"[MODIFY] Context: {len(doc_context)} chars (~{input_tokens_approx} tokens est.) vs full doc {len(latex)} chars")

    response = await llm.ainvoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ]
    )

    response_text = response.content.strip()
    usage = response.usage_metadata or {}
    print(f"[MODIFY] Tokens: input={usage.get('input_tokens', '?')} output={usage.get('output_tokens', '?')} total={usage.get('total_tokens', '?')}")

    # Apply patches to the FULL document (not the extracted section)
    modified = apply_patches(latex, response_text)

    # Fallback: if no patches applied and response looks like a full document
    if modified == latex and "<<<SEARCH" not in response_text:
        fallback = response_text
        if fallback.startswith("```"):
            lines = fallback.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            fallback = "\n".join(lines)
        if len(fallback) > 50:
            modified = fallback
            print(f"[MODIFY] Used fallback (full doc response)")

    changed = modified != latex
    diff = compute_diff(latex, modified)
    print(f"[MODIFY] Applied: {'YES' if changed else 'NO'} | Diff entries: {len(diff)}")

    return {"modified_latex": modified, "diff": diff, "raw_patches": response_text}
