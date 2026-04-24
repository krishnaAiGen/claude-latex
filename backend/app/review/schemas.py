from pydantic import BaseModel, Field


class AtomicFinding(BaseModel):
    id: str                              # "F1", "F2", ...
    agent: str                           # "novelty"|"soundness"|"rigor"|"clarity"
    severity: str                        # "critical"|"major"|"minor"|"nit"
    title: str
    section: str
    line: int | None = None
    body: str
    fix: str
    relatedBenchmarks: list[str] = Field(default_factory=list)
    confidence: float
    auto_fix_possible: bool = False
    fix_category: str | None = None      # "paraphrase"|"equation"|"citation"|"section_expand"|"formatting"


class DimensionScore(BaseModel):
    score: float
    of: float = 10.0
    label: str


class MetaRecommendation(BaseModel):
    verdict: str
    confidence: float
    overall: float
    summary: str
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    actionPlan: list[dict] = Field(default_factory=list)  # [{label, items: [finding_id]}]


class BenchmarkPaper(BaseModel):
    id: str                              # "B1", "B2", ...
    title: str
    authors: str
    venue: str
    year: int
    citations: int
    similarity: float
    tags: list[str] = Field(default_factory=list)


class ReviewResult(BaseModel):
    review_id: str
    status: str
    progress_pct: int
    findings: list[AtomicFinding] = Field(default_factory=list)
    dimension_scores: dict[str, DimensionScore] = Field(default_factory=dict)
    meta: MetaRecommendation | None = None
    benchmarks: list[BenchmarkPaper] = Field(default_factory=list)
