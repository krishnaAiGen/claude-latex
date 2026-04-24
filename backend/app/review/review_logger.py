"""Per-review file logger.

Creates a detailed .log file for each review run under backend/logs/reviews/.
Controlled by the REVIEW_LOG env var (default: false).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from app.config import settings
from app.review.schemas import AtomicFinding, BenchmarkPaper, DimensionScore, MetaRecommendation

LOGS_DIR = Path(__file__).resolve().parents[2] / "logs" / "reviews"


class ReviewLogger:
    """Detailed per-review logger that writes to ``logs/reviews/{review_id}.log``."""

    def __init__(self, review_id: str) -> None:
        self.review_id = review_id
        self.enabled = settings.review_log
        self._logger: logging.Logger | None = None
        self._handler: logging.FileHandler | None = None

        if not self.enabled:
            return

        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        log_path = LOGS_DIR / f"{review_id}.log"

        self._logger = logging.getLogger(f"review.file.{review_id}")
        self._logger.setLevel(logging.DEBUG)
        self._logger.propagate = False

        self._handler = logging.FileHandler(log_path, encoding="utf-8")
        self._handler.setFormatter(logging.Formatter("%(message)s"))
        self._logger.addHandler(self._handler)

    def _write(self, msg: str) -> None:
        if self._logger:
            self._logger.info(msg)

    def _ts(self) -> str:
        return datetime.now(timezone.utc).strftime("%H:%M:%S")

    # ── Pipeline ──────────────────────────────────────────────────────────────

    def log_pipeline_start(self, venue: str, topic: str, mode: str, doc_len: int) -> None:
        self._write(
            "=" * 78 + "\n"
            f"REVIEW LOG: {self.review_id}\n"
            f"Started: {datetime.now(timezone.utc).isoformat()}\n"
            f"Venue: {venue} | Topic: {topic} | Mode: {mode}\n"
            f"Document length: {doc_len:,} chars\n"
            + "=" * 78
        )

    def log_pipeline_complete(self, total_findings: int, verdict: str, overall: float, elapsed_s: float) -> None:
        self._write(
            f"\n[{self._ts()}] PIPELINE COMPLETE\n"
            f"  Total findings: {total_findings} | Verdict: {verdict} | Overall: {overall:.1f}/10\n"
            f"  Duration: {elapsed_s:.1f}s\n"
            + "=" * 78
        )

    def log_pipeline_error(self, error: Exception) -> None:
        self._write(f"\n[{self._ts()}] PIPELINE ERROR\n  {type(error).__name__}: {error}")

    # ── Benchmark fetch ───────────────────────────────────────────────────────

    def log_benchmark_request(self, topic: str) -> None:
        self._write(
            f"\n[{self._ts()}] BENCHMARK_FETCH -- REQUEST\n"
            f"  Query: \"{topic}\"\n"
            f"  API: https://api.semanticscholar.org/graph/v1/paper/search"
        )

    def log_benchmark_retry(self, attempt: int, wait: int, status: int) -> None:
        self._write(
            f"\n[{self._ts()}] BENCHMARK_FETCH -- {status} RATE LIMITED "
            f"(attempt {attempt}/3, retrying in {wait}s)"
        )

    def log_benchmark_response(self, papers: list[BenchmarkPaper], source: str, elapsed_ms: int) -> None:
        lines = [
            f"\n[{self._ts()}] BENCHMARK_FETCH -- RESPONSE ({elapsed_ms}ms)",
            f"  Source: {source}",
            f"  Papers: {len(papers)}",
        ]
        for p in papers:
            lines.append(f"    {p.id}: \"{p.title}\" ({p.authors}, {p.venue} {p.year}) -- {p.citations} citations")
        self._write("\n".join(lines))

    def log_benchmark_error(self, error: Exception) -> None:
        self._write(f"\n[{self._ts()}] BENCHMARK_FETCH -- ERROR\n  {type(error).__name__}: {error}")

    # ── Agents ────────────────────────────────────────────────────────────────

    def log_agent_start(self, agent_name: str, excerpt_len: int, benchmarks_count: int) -> None:
        self._write(
            f"\n[{self._ts()}] AGENT {agent_name} -- START\n"
            f"  Benchmarks: {benchmarks_count} | Paper excerpt: {excerpt_len} chars"
        )

    def log_agent_prompt(self, agent_name: str, system_prompt: str, user_prompt: str) -> None:
        self._write(
            f"\n[{self._ts()}] AGENT {agent_name} -- PROMPT\n"
            f"  System ({len(system_prompt)} chars):\n{_indent(system_prompt, 4)}\n"
            f"  User ({len(user_prompt)} chars):\n{_indent(user_prompt, 4)}"
        )

    def log_agent_response(self, agent_name: str, raw_response: str, elapsed_s: float) -> None:
        self._write(
            f"\n[{self._ts()}] AGENT {agent_name} -- LLM RESPONSE ({elapsed_s:.1f}s, {len(raw_response)} chars)\n"
            f"  Raw:\n{_indent(raw_response, 4)}"
        )

    def log_agent_findings(self, agent_name: str, findings: list[AtomicFinding]) -> None:
        lines = [f"\n[{self._ts()}] AGENT {agent_name} -- FINDINGS ({len(findings)})"]
        for f in findings:
            lines.append(f"  {f.id} [{f.severity}] {f.title} (confidence: {f.confidence:.2f})")
        self._write("\n".join(lines))

    def log_agent_error(self, agent_name: str, error: Exception) -> None:
        self._write(f"\n[{self._ts()}] AGENT {agent_name} -- ERROR\n  {type(error).__name__}: {error}")

    # ── Meta-reviewer ─────────────────────────────────────────────────────────

    def log_meta_start(self, findings_count: int, scores: dict[str, DimensionScore]) -> None:
        score_str = ", ".join(f"{k}: {v.score:.1f}" for k, v in scores.items())
        self._write(
            f"\n[{self._ts()}] META_REVIEWER -- START\n"
            f"  Findings: {findings_count} | Dimension scores: {score_str}"
        )

    def log_meta_prompt(self, system_prompt: str, user_prompt: str) -> None:
        self._write(
            f"\n[{self._ts()}] META_REVIEWER -- PROMPT\n"
            f"  System ({len(system_prompt)} chars):\n{_indent(system_prompt, 4)}\n"
            f"  User ({len(user_prompt)} chars):\n{_indent(user_prompt, 4)}"
        )

    def log_meta_response(self, raw_response: str, elapsed_s: float) -> None:
        self._write(
            f"\n[{self._ts()}] META_REVIEWER -- LLM RESPONSE ({elapsed_s:.1f}s, {len(raw_response)} chars)\n"
            f"  Raw:\n{_indent(raw_response, 4)}"
        )

    def log_meta_result(self, meta: MetaRecommendation) -> None:
        self._write(
            f"\n[{self._ts()}] META_REVIEWER -- RESULT\n"
            f"  Verdict: {meta.verdict} | Overall: {meta.overall:.1f}/10 | Confidence: {meta.confidence:.2f}\n"
            f"  Summary: {meta.summary}\n"
            f"  Strengths: {meta.strengths}\n"
            f"  Weaknesses: {meta.weaknesses}"
        )

    # ── Cleanup ───────────────────────────────────────────────────────────────

    def close(self) -> None:
        if self._handler and self._logger:
            self._handler.flush()
            self._logger.removeHandler(self._handler)
            self._handler.close()


def _indent(text: str, spaces: int) -> str:
    prefix = " " * spaces
    return "\n".join(prefix + line for line in text.splitlines())
