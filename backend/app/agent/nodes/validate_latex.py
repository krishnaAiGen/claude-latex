import re

from app.agent.state import AgentState


def check_balanced(content: str, open_char: str, close_char: str) -> list[str]:
    count = 0
    errors = []
    for i, ch in enumerate(content):
        if ch == open_char:
            count += 1
        elif ch == close_char:
            count -= 1
        if count < 0:
            errors.append(f"Unmatched '{close_char}' at position {i}")
            count = 0
    if count > 0:
        errors.append(f"{count} unmatched '{open_char}' found")
    return errors


def check_environments(content: str) -> list[str]:
    begins = re.findall(r"\\begin\{(\w+)\}", content)
    ends = re.findall(r"\\end\{(\w+)\}", content)
    errors = []

    stack = []
    all_markers = []

    for m in re.finditer(r"\\(begin|end)\{(\w+)\}", content):
        all_markers.append((m.group(1), m.group(2), m.start()))

    for kind, env, pos in all_markers:
        if kind == "begin":
            stack.append((env, pos))
        elif kind == "end":
            if not stack:
                errors.append(f"\\end{{{env}}} without matching \\begin at position {pos}")
            else:
                top_env, top_pos = stack.pop()
                if top_env != env:
                    errors.append(
                        f"Mismatched environments: \\begin{{{top_env}}} at {top_pos} "
                        f"closed by \\end{{{env}}} at {pos}"
                    )

    for env, pos in stack:
        errors.append(f"Unclosed \\begin{{{env}}} at position {pos}")

    return errors


async def validate_latex(state: AgentState) -> dict:
    content = state.get("modified_latex") or state["latex_content"]
    errors = []

    errors.extend(check_balanced(content, "{", "}"))
    errors.extend(check_balanced(content, "[", "]"))
    errors.extend(check_environments(content))

    if errors:
        retry_count = state.get("retry_count", 0) + 1
        from langchain_core.messages import SystemMessage

        return {
            "messages": [
                SystemMessage(
                    content=f"Validation errors found:\n"
                    + "\n".join(f"- {e}" for e in errors)
                    + "\nPlease fix these issues."
                )
            ],
            "retry_count": retry_count,
        }

    return {"retry_count": state.get("retry_count", 0)}
