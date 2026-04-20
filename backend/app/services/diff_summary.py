"""
Generate an AI-powered commit summary and diff stats when pushing a draft to main.
"""
import difflib
import re

from langchain_openai import ChatOpenAI

from app.config import settings


def compute_diff_stats(old_content: str, new_content: str) -> dict:
    """Count added/removed lines and identify changed LaTeX sections."""
    old_lines = old_content.splitlines()
    new_lines = new_content.splitlines()

    lines_added = 0
    lines_removed = 0
    for group in difflib.SequenceMatcher(None, old_lines, new_lines).get_grouped_opcodes(n=0):
        for tag, i1, i2, j1, j2 in group:
            if tag in ("replace", "delete"):
                lines_removed += i2 - i1
            if tag in ("replace", "insert"):
                lines_added += j2 - j1

    # Detect changed section headings
    section_re = re.compile(r"\\(?:section|subsection|subsubsection|chapter)\{([^}]+)\}")
    old_sections = set(section_re.findall(old_content))
    new_sections = set(section_re.findall(new_content))
    sections_changed = list(
        (old_sections - new_sections) | (new_sections - old_sections)
    )

    return {
        "lines_added": lines_added,
        "lines_removed": lines_removed,
        "sections_changed": sections_changed,
    }


async def generate_diff_summary(
    old_content: str,
    new_content: str,
    model: str | None = None,
) -> str:
    """
    Call the LLM to generate a 2-3 sentence commit-style summary of what changed
    between old_content and new_content.
    Returns a plain-text summary string.
    """
    llm = ChatOpenAI(
        model=model or settings.light_model,
        openai_api_key=settings.openrouter_api_key,
        openai_api_base=settings.openrouter_base_url,
        max_tokens=200,
    )

    # Build a compact unified diff (first 80 lines to avoid huge prompts)
    diff_lines = list(difflib.unified_diff(
        old_content.splitlines(keepends=True),
        new_content.splitlines(keepends=True),
        fromfile="main (before)",
        tofile="draft (after)",
        n=3,
    ))[:80]
    compact_diff = "".join(diff_lines)

    prompt = (
        "You are summarising changes to a LaTeX academic paper for a version history log.\n"
        "Write a 2-3 sentence commit message in plain English describing what changed in "
        "the content (sections added/removed/rewritten, equations updated, etc.). "
        "Do NOT describe formatting details. Be specific but concise.\n\n"
        f"Diff:\n```\n{compact_diff}\n```\n\n"
        "Summary:"
    )

    response = await llm.ainvoke(prompt)
    return response.content.strip()
