"""Rigor dimension agent — evaluates mathematical and statistical rigor."""
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

logger = logging.getLogger("review.agents.rigor")

SYSTEM_PROMPT = """You are a specialist peer reviewer focused on RIGOR.
Your task: identify weaknesses in mathematical formulation, statistical analysis, reproducibility,
hyperparameter reporting, and experimental completeness.

For each issue, output a JSON array with objects matching this schema:
{
  "severity": "critical|major|minor|nit",
  "title": "one-line headline (max 80 chars)",
  "section": "section name",
  "line": null or integer,
  "body": "2-3 sentence explanation",
  "fix": "concrete suggested change",
  "relatedBenchmarks": [],
  "confidence": 0.0-1.0
}

Rules:
- Output ONLY the JSON array, no prose, no markdown fences.
- Produce 3-6 findings total.
- Flag: undefined notation, missing confidence intervals, no significance tests, insufficient seeds,
  unreported hyperparameters, non-reproducible setups, missing code/data availability statements.
"""


def _format_benchmarks(benchmarks: list[BenchmarkPaper]) -> str:
    lines = []
    for b in benchmarks:
        lines.append(f"[{b.id}] {b.title} ({b.venue} {b.year})")
    return "\n".join(lines)


async def run_rigor_agent(
    latex: str,
    benchmarks: list[BenchmarkPaper],
    mode: str,
    rlog: ReviewLogger | None = None,
) -> list[AtomicFinding]:
    llm = get_llm()
    bench_summary = _format_benchmarks(benchmarks)
    paper_excerpt = latex[:14000]

    system_prompt = SYSTEM_PROMPT
    user_prompt = f"BENCHMARK PAPERS:\n{bench_summary}\n\nPAPER (excerpt):\n{paper_excerpt}"

    logger.info("Starting LLM call with %d benchmarks, paper excerpt %d chars", len(benchmarks), len(paper_excerpt))
    if rlog:
        rlog.log_agent_start("rigor", len(paper_excerpt), len(benchmarks))
        rlog.log_agent_prompt("rigor", system_prompt, user_prompt)

    t0 = time.monotonic()
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    elapsed = time.monotonic() - t0
    logger.info("LLM responded in %.1fs, parsing JSON...", elapsed)
    if rlog:
        rlog.log_agent_response("rigor", response.content, elapsed)

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
            id=f"rigor-{i}",
            agent="rigor",
            severity=f.get("severity", "minor"),
            title=f.get("title", "Untitled finding"),
            section=f.get("section", "Unknown"),
            line=f.get("line"),
            body=f.get("body", ""),
            fix=f.get("fix", ""),
            relatedBenchmarks=f.get("relatedBenchmarks", []),
            confidence=float(f.get("confidence", 0.7)),
        ))

    severities = [f.severity for f in findings]
    logger.info("Produced %d findings: %s", len(findings), severities)
    if rlog:
        rlog.log_agent_findings("rigor", findings)
    return findings
