"""Meta-reviewer agent — synthesizes all dimension findings into a final recommendation."""
from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING

from langchain_core.messages import SystemMessage, HumanMessage

from app.review.schemas import AtomicFinding, DimensionScore, BenchmarkPaper, MetaRecommendation
from app.review.agents.base import get_llm

if TYPE_CHECKING:
    from app.review.review_logger import ReviewLogger

logger = logging.getLogger("review.agents.meta")

SYSTEM_PROMPT = """You are the meta-reviewer for an academic paper submission.
You have received findings from four specialist reviewers (novelty, soundness, rigor, clarity)
and their dimension scores. Your job is to synthesize these into a final recommendation.

Output a single JSON object matching this schema:
{
  "verdict": "strong_accept|accept|weak_accept|borderline|weak_reject|reject|strong_reject",
  "confidence": 0.0-1.0,
  "overall": 0.0-10.0,
  "summary": "3-4 sentence executive summary of the paper's strengths and weaknesses",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "actionPlan": [
    {"label": "Before submission", "items": ["F1", "F3"]},
    {"label": "Nice to have", "items": ["F2", "F5"]}
  ]
}

Rules:
- Output ONLY the JSON object, no prose, no markdown fences.
- verdict must be one of the 7 values listed above.
- overall is a weighted average informed by dimension scores (novelty 30%, soundness 30%, rigor 20%, clarity 20%).
- actionPlan groups finding IDs into priority buckets. Use the finding IDs from the input.
- strengths and weaknesses: 2-4 items each, concrete and specific.
"""


def _format_findings(findings: list[AtomicFinding]) -> str:
    lines = []
    for f in findings:
        lines.append(f"[{f.id}] [{f.agent.upper()}] [{f.severity}] {f.title}\n  {f.body}")
    return "\n\n".join(lines)


def _format_scores(scores: dict[str, DimensionScore]) -> str:
    lines = []
    for dim, s in scores.items():
        lines.append(f"{dim}: {s.score:.1f}/{s.of} — {s.label}")
    return "\n".join(lines)


async def run_meta_reviewer(
    all_findings: list[AtomicFinding],
    dimension_scores: dict[str, DimensionScore],
    benchmarks: list[BenchmarkPaper],
    rlog: ReviewLogger | None = None,
) -> MetaRecommendation:
    llm = get_llm(max_tokens=2048)

    findings_text = _format_findings(all_findings)
    scores_text = _format_scores(dimension_scores)

    system_prompt = SYSTEM_PROMPT
    user_prompt = f"DIMENSION SCORES:\n{scores_text}\n\nFINDINGS:\n{findings_text}"

    logger.info("Starting meta-review LLM call with %d findings", len(all_findings))
    if rlog:
        rlog.log_meta_start(len(all_findings), dimension_scores)
        rlog.log_meta_prompt(system_prompt, user_prompt)

    t0 = time.monotonic()
    response = await llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    elapsed = time.monotonic() - t0
    logger.info("LLM responded in %.1fs, parsing JSON...", elapsed)
    if rlog:
        rlog.log_meta_response(response.content, elapsed)

    try:
        raw = json.loads(response.content)
        logger.info("JSON parsed successfully")
    except json.JSONDecodeError:
        logger.warning("JSON parse failed, attempting extraction from content")
        content = response.content
        start = content.find("{")
        end = content.rfind("}") + 1
        raw = json.loads(content[start:end]) if start != -1 else {}

    result = MetaRecommendation(
        verdict=raw.get("verdict", "borderline"),
        confidence=float(raw.get("confidence", 0.6)),
        overall=float(raw.get("overall", 5.0)),
        summary=raw.get("summary", ""),
        strengths=raw.get("strengths", []),
        weaknesses=raw.get("weaknesses", []),
        actionPlan=raw.get("actionPlan", []),
    )

    logger.info("Meta-review: verdict=%s overall=%.1f confidence=%.2f",
                result.verdict, result.overall, result.confidence)
    if rlog:
        rlog.log_meta_result(result)
    return result
