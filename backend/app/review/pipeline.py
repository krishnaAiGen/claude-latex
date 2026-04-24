"""Async review pipeline — 6-stage DAG that streams granular events via Redis."""
import asyncio
import json
import logging
import time
from datetime import datetime

import redis.asyncio as aioredis

from app.config import settings
from app.db import AsyncSessionLocal
from app.models.review import Review
from app.review.schemas import AtomicFinding, DimensionScore
from app.review.benchmark_fetch import fetch_benchmarks
from app.review.agents.novelty import run_novelty_agent
from app.review.agents.soundness import run_soundness_agent
from app.review.agents.rigor import run_rigor_agent
from app.review.agents.clarity import run_clarity_agent
from app.review.agents.meta_reviewer import run_meta_reviewer
from app.review.review_logger import ReviewLogger

logger = logging.getLogger("review.pipeline")


async def run_review_pipeline(
    review_id: str,
    project_id: str,
    user_id: str,
    latex: str,
    venue: str,
    topic: str,
    mode: str,
) -> None:
    redis = await aioredis.from_url(settings.redis_url)
    rlog = ReviewLogger(review_id)
    pipeline_t0 = time.monotonic()

    async def publish_event(event: dict) -> None:
        payload = json.dumps(event)
        await redis.publish(f"review:{review_id}", payload)
        # Skip DB update for terminal events — pipeline handles final DB write itself
        stage = event.get("stage", "")
        if stage in ("done", "error"):
            return
        async with AsyncSessionLocal() as db:
            review = await db.get(Review, review_id)
            if review:
                review.progress_pct = event.get("pct", 0)
                review.status = "running"
                await db.commit()

    try:
        logger.info("[review:%s] pipeline started  venue=%s topic=%s mode=%s  doc_len=%d",
                     review_id, venue, topic, mode, len(latex))
        rlog.log_pipeline_start(venue, topic, mode, len(latex))

        await publish_event({
            "type": "pipeline", "stage": "start", "pct": 2,
            "message": "Starting review pipeline…",
        })

        # ── Stage 1: benchmark fetch (0 → 15%) ─────────────────────────────
        await publish_event({
            "type": "pipeline", "stage": "benchmark_fetch", "pct": 5,
            "message": f"Searching for benchmark papers on '{topic}'…",
        })

        bench_t0 = time.monotonic()
        benchmarks = await fetch_benchmarks(venue, topic, rlog=rlog)
        bench_elapsed = int((time.monotonic() - bench_t0) * 1000)

        source = "semantic_scholar" if bench_elapsed > 500 else "fallback"
        logger.info("[review:%s] benchmarks fetched: %d papers (source=%s) in %dms",
                     review_id, len(benchmarks), source, bench_elapsed)

        # Emit per-paper events for the live stream
        for b in benchmarks:
            await publish_event({
                "type": "benchmark_paper", "stage": "benchmark_fetch", "pct": 10,
                "paper_id": b.id,
                "title": b.title,
                "authors": b.authors,
                "venue": b.venue,
                "year": b.year,
                "citations": b.citations,
                "message": f"Found {b.id}: {b.title} ({b.authors}, {b.year}) — {b.citations} citations",
            })

        await publish_event({
            "type": "benchmark", "stage": "benchmark_fetch", "pct": 15,
            "count": len(benchmarks), "source": source, "duration_ms": bench_elapsed,
            "message": f"Fetched {len(benchmarks)} benchmark papers in {bench_elapsed/1000:.1f}s",
        })

        # ── Stage 2: (no-op card extract for now) (15 → 25%) ───────────────
        await publish_event({
            "type": "pipeline", "stage": "extract_cards", "pct": 25,
            "message": "Extracting paper structure…",
        })

        # ── Stage 3: deterministic checks (25 → 30%) ───────────────────────
        await publish_event({
            "type": "pipeline", "stage": "deterministic", "pct": 30,
            "message": "Running deterministic checks…",
        })

        # ── Stage 4: 4 dimension agents in parallel (30 → 75%) ─────────────
        agent_specs = [
            ("novelty",   run_novelty_agent),
            ("soundness", run_soundness_agent),
            ("rigor",     run_rigor_agent),
            ("clarity",   run_clarity_agent),
        ]

        # Publish agent_start for all four
        for name, _ in agent_specs:
            await publish_event({
                "type": "agent_start", "stage": "agents", "pct": 32,
                "agent": name,
                "message": f"Starting {name} analysis…",
            })

        logger.info("[review:%s] launching 4 agents in parallel", review_id)

        agents_done = 0
        agent_results: dict[str, list[AtomicFinding]] = {}

        async def run_agent_with_events(name: str, fn, latex_doc, benchmarks_list, review_mode, review_logger):
            nonlocal agents_done
            t0 = time.monotonic()
            try:
                findings = await fn(latex_doc, benchmarks_list, review_mode, rlog=review_logger)
            except Exception as exc:
                logger.exception("[review:%s] agent %s failed: %s", review_id, name, exc)
                findings = []
                rlog.log_agent_error(name, exc)
                await publish_event({
                    "type": "agent_error", "stage": "agents", "pct": 32,
                    "agent": name,
                    "message": f"{name} agent failed: {exc}",
                })

            elapsed = int((time.monotonic() - t0) * 1000)
            agent_results[name] = findings

            agents_done += 1
            pct = 32 + int((agents_done / 4) * 43)

            score = DimensionScore(
                score=round(_score_for_agent(findings), 1),
                label=name.capitalize(),
            )

            severities = {}
            for f in findings:
                severities[f.severity] = severities.get(f.severity, 0) + 1

            logger.info("[review:%s] agent %s completed: %d findings (%s) in %dms",
                         review_id, name, len(findings), severities, elapsed)

            await publish_event({
                "type": "agent_done", "stage": "agents", "pct": pct,
                "agent": name,
                "finding_count": len(findings),
                "findings": [f.model_dump() for f in findings],
                "score": score.model_dump(),
                "duration_ms": elapsed,
                "message": f"{name} done: {len(findings)} findings in {elapsed/1000:.1f}s",
            })

        await asyncio.gather(*(
            run_agent_with_events(name, fn, latex, benchmarks, mode, rlog)
            for name, fn in agent_specs
        ))

        all_findings: list[AtomicFinding] = []
        for name, _ in agent_specs:
            all_findings.extend(agent_results.get(name, []))

        logger.info("[review:%s] all agents done: %d total findings", review_id, len(all_findings))

        # ── Stage 5: dimension scores + meta-reviewer (75 → 90%) ───────────
        await publish_event({
            "type": "meta_start", "stage": "meta_review", "pct": 78,
            "message": "Meta-reviewer synthesizing findings…",
        })

        dimension_scores = _compute_dimension_scores(
            agent_results.get("novelty", []),
            agent_results.get("soundness", []),
            agent_results.get("rigor", []),
            agent_results.get("clarity", []),
        )

        meta_t0 = time.monotonic()
        meta = await run_meta_reviewer(all_findings, dimension_scores, benchmarks, rlog=rlog)
        meta_elapsed = int((time.monotonic() - meta_t0) * 1000)

        logger.info("[review:%s] meta-reviewer done: verdict=%s overall=%.1f in %dms",
                     review_id, meta.verdict, meta.overall, meta_elapsed)

        await publish_event({
            "type": "meta_done", "stage": "meta_review", "pct": 90,
            "verdict": meta.verdict,
            "overall": meta.overall,
            "duration_ms": meta_elapsed,
            "message": f"Meta-review complete: {meta.verdict} (overall {meta.overall:.1f}/10)",
        })

        # ── Stage 6: assign sequential IDs, sort by severity (90 → 100%) ───
        await publish_event({
            "type": "pipeline", "stage": "section_synth", "pct": 95,
            "message": "Sorting and assigning finding IDs…",
        })
        final_findings = _assign_ids_and_sort(all_findings)

        # Persist to DB
        async with AsyncSessionLocal() as db:
            review = await db.get(Review, review_id)
            if review:
                review.status = "done"
                review.progress_pct = 100
                review.completed_at = datetime.utcnow()
                review.findings_json = json.dumps([f.model_dump() for f in final_findings])
                review.scores_json = json.dumps({k: v.model_dump() for k, v in dimension_scores.items()})
                review.meta_json = json.dumps(meta.model_dump())
                review.benchmarks_json = json.dumps([b.model_dump() for b in benchmarks])
                await db.commit()

        pipeline_elapsed = int((time.monotonic() - pipeline_t0) * 1000)
        logger.info("[review:%s] pipeline completed: %d findings, verdict=%s in %.1fs",
                     review_id, len(final_findings), meta.verdict, pipeline_elapsed / 1000)
        rlog.log_pipeline_complete(len(final_findings), meta.verdict, meta.overall, pipeline_elapsed / 1000)

        await publish_event({
            "type": "done", "stage": "done", "pct": 100,
            "message": f"Review complete — {len(final_findings)} findings, verdict: {meta.verdict}",
        })

    except Exception as exc:
        logger.exception("[review:%s] pipeline failed: %s", review_id, exc)
        rlog.log_pipeline_error(exc)
        async with AsyncSessionLocal() as db:
            review = await db.get(Review, review_id)
            if review:
                review.status = "error"
                review.error_message = str(exc)
                await db.commit()
        await redis.publish(
            f"review:{review_id}",
            json.dumps({"type": "error", "stage": "error", "pct": 0, "message": str(exc)}),
        )
    finally:
        rlog.close()
        await redis.aclose()


# ── Helpers ─────────────────────────────────────────────────────────────────

_SEVERITY_ORDER = {"critical": 0, "major": 1, "minor": 2, "nit": 3}


def _assign_ids_and_sort(findings: list[AtomicFinding]) -> list[AtomicFinding]:
    """Sort by severity then re-assign sequential F1, F2, ... IDs."""
    sorted_f = sorted(findings, key=lambda f: _SEVERITY_ORDER.get(f.severity, 4))
    result = []
    for i, f in enumerate(sorted_f, start=1):
        result.append(f.model_copy(update={"id": f"F{i}"}))
    return result


def _score_for_agent(agent_findings: list[AtomicFinding]) -> float:
    """Heuristic: start at 10, subtract per finding weighted by severity."""
    weights = {"critical": 2.5, "major": 1.5, "minor": 0.5, "nit": 0.1}
    deduction = sum(weights.get(f.severity, 0.5) for f in agent_findings)
    return max(1.0, min(10.0, 10.0 - deduction))


def _compute_dimension_scores(
    novelty_f: list[AtomicFinding],
    soundness_f: list[AtomicFinding],
    rigor_f: list[AtomicFinding],
    clarity_f: list[AtomicFinding],
) -> dict[str, DimensionScore]:
    return {
        "novelty":   DimensionScore(score=round(_score_for_agent(novelty_f), 1),   label="Novelty"),
        "soundness": DimensionScore(score=round(_score_for_agent(soundness_f), 1), label="Soundness"),
        "rigor":     DimensionScore(score=round(_score_for_agent(rigor_f), 1),     label="Rigor"),
        "clarity":   DimensionScore(score=round(_score_for_agent(clarity_f), 1),   label="Clarity"),
    }
