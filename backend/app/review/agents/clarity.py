"""Clarity dimension agent — evaluates writing quality, structure, and presentation."""
from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING

from langchain_core.messages import SystemMessage, HumanMessage

from app.review.schemas import AtomicFinding, BenchmarkPaper
from app.review.agents.base import get_llm

if TYPE_CHECKING:
    from app.review.review_logger import ReviewLogger

logger = logging.getLogger("review.agents.clarity")

SYSTEM_PROMPT = """You are a specialist peer reviewer focused on CLARITY.
Your task: identify writing, presentation, and structural issues that impede understanding.

For each issue, output a JSON array with objects matching this schema:
{
  "severity": "critical|major|minor|nit",
  "title": "one-line headline (max 80 chars)",
  "section": "section name",
  "line": null or integer,
  "body": "2-3 sentence explanation",
  "fix": "concrete rewrite or structural suggestion",
  "relatedBenchmarks": [],
  "confidence": 0.0-1.0,
  "auto_fix_possible": true or false,
  "fix_category": "paraphrase|equation|citation|section_expand|formatting|null"
}

Rules:
- Output ONLY the JSON array, no prose, no markdown fences.
- Produce 4-8 findings (clarity issues are usually more numerous than technical ones).
- Flag: undefined acronyms, ambiguous notation, missing figure captions, unclear contributions,
  overly long sentences, inconsistent terminology, missing motivation, poor abstract structure.
- Set auto_fix_possible=true for paraphrases, formatting fixes, and citation additions.
"""


async def run_clarity_agent(
    latex: str,
    benchmarks: list[BenchmarkPaper],
    mode: str,
    rlog: ReviewLogger | None = None,
) -> list[AtomicFinding]:
    llm = get_llm()
    paper_excerpt = latex[:14000]

    system_prompt = SYSTEM_PROMPT
    user_prompt = f"PAPER (excerpt):\n{paper_excerpt}"

    logger.info("Starting LLM call, paper excerpt %d chars", len(paper_excerpt))
    if rlog:
        rlog.log_agent_start("clarity", len(paper_excerpt), 0)
        rlog.log_agent_prompt("clarity", system_prompt, user_prompt)

    t0 = time.monotonic()
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    elapsed = time.monotonic() - t0
    logger.info("LLM responded in %.1fs, parsing JSON...", elapsed)
    if rlog:
        rlog.log_agent_response("clarity", response.content, elapsed)

    try:
        raw = json.loads(response.content)
        logger.info("JSON parsed successfully")
    except json.JSONDecodeError:
        logger.warning("JSON parse failed, attempting extraction from content")
        content = response.content
        start = content.find("[")
        end = content.rfind("]") + 1
        raw = json.loads(content[start:end]) if start != -1 else []

    findings = []
    for i, f in enumerate(raw, start=1):
        findings.append(AtomicFinding(
            id=f"clarity-{i}",
            agent="clarity",
            severity=f.get("severity", "minor"),
            title=f.get("title", "Untitled finding"),
            section=f.get("section", "Unknown"),
            line=f.get("line"),
            body=f.get("body", ""),
            fix=f.get("fix", ""),
            relatedBenchmarks=f.get("relatedBenchmarks", []),
            confidence=float(f.get("confidence", 0.7)),
            auto_fix_possible=bool(f.get("auto_fix_possible", False)),
            fix_category=f.get("fix_category"),
        ))

    severities = [f.severity for f in findings]
    logger.info("Produced %d findings: %s", len(findings), severities)
    if rlog:
        rlog.log_agent_findings("clarity", findings)
    return findings
