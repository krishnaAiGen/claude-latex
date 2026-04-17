import json

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.agent.state import AgentState
from app.config import settings

llm = ChatOpenAI(
    model=settings.light_model,
    api_key=settings.openrouter_api_key,
    base_url=settings.openrouter_base_url,
    max_tokens=512,
)

SYSTEM_PROMPT = """You are a LaTeX document editor assistant. Given a user instruction and the document's structure, classify the request.

Respond with ONLY a JSON object (no markdown, no explanation):

{
  "actions": [
    {
      "type": "modify" or "question",
      "scope": "local" or "global",
      "sections": ["Section Name 1", "Section Name 2"],
      "include_preamble": true or false
    }
  ],
  "confidence": "high" or "low",
  "clarification": null or "question to ask the user"
}

Rules:
- "type": "modify" = user wants to change/add/remove content. "question" = user is asking about the document.
- "scope": "local" = change affects specific sections only. "global" = change affects the whole document (e.g., renaming a variable everywhere, rewriting style).
- "sections": list the section TITLES that need to be read/modified. Use exact titles from the skeleton.
- "include_preamble": true if the change involves packages, \\newcommand, document class, or adding new environments.
- "confidence": "low" if the instruction is ambiguous (e.g., "remove that section" without specifying which one).
- "clarification": if confidence is low, write a short question to ask the user.
- An instruction can have multiple actions (e.g., "explain X and fix it" = question + modify).
- For "question" type, list the sections the user is asking about.
- If unsure which sections, set scope to "global"."""


async def parse_instruction(state: AgentState) -> dict:
    skeleton = state.get("skeleton") or "No skeleton available"
    ref_map = state.get("ref_map_summary") or "No references"
    instruction = state["user_instruction"]

    context_parts = [f"Document structure:\n{skeleton}"]
    if ref_map and ref_map != "No references":
        context_parts.append(f"\n{ref_map}")
    if state.get("selected_text"):
        context_parts.append(f"\nUser selected text:\n```\n{state['selected_text']}\n```")

    user_msg = "\n".join(context_parts) + f"\n\nInstruction: {instruction}"

    response = await llm.ainvoke(
        [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ]
    )

    raw = response.content.strip()

    # Parse JSON, fallback to global modify on failure
    try:
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
            if raw.endswith("```"):
                raw = raw[:-3]
        classification = json.loads(raw)
    except json.JSONDecodeError:
        print(f"[PARSE] JSON parse failed, falling back to global modify. Raw: {raw[:200]}")
        classification = {
            "actions": [{"type": "modify", "scope": "global", "sections": [], "include_preamble": False}],
            "confidence": "high",
            "clarification": None,
        }

    # Extract intent for backward compat
    actions = classification.get("actions", [])
    first_action = actions[0] if actions else {"type": "modify"}
    intent = first_action.get("type", "modify")

    usage = response.usage_metadata or {}
    print(f"[PARSE] Intent: {intent} | Scope: {first_action.get('scope', '?')} | Sections: {first_action.get('sections', [])} | Confidence: {classification.get('confidence', '?')} | Tokens: in={usage.get('input_tokens', '?')} out={usage.get('output_tokens', '?')}")

    return {
        "classification": classification,
        "parsed_intent": intent,
    }
