import type { ReviewFinding, DimensionScore, MetaRecommendation, BenchmarkPaper } from "./types";

export interface ReviewAgent {
  id: "novelty" | "soundness" | "rigor" | "clarity";
  label: string;
  blurb: string;
  color: string;
}

export const REVIEW_AGENTS: ReviewAgent[] = [
  { id: "novelty",   label: "Novelty",   blurb: "contribution vs prior work",   color: "oklch(60% 0.18 270)" },
  { id: "soundness", label: "Soundness", blurb: "proofs, assumptions, validity", color: "oklch(60% 0.18 30)"  },
  { id: "rigor",     label: "Rigor",     blurb: "experiments, baselines, seeds", color: "oklch(60% 0.18 200)" },
  { id: "clarity",   label: "Clarity",   blurb: "writing, notation, figures",    color: "oklch(60% 0.14 150)" },
];

export const REVIEW_MODES = [
  { id: "speed",    label: "Speed review",  time: "~3 min",  icon: "⚡", blurb: "Fast triage — surfaces the top 10 issues across all four dimensions. Ideal for a quick sanity check." },
  { id: "depth",    label: "In-depth",      time: "~12 min", icon: "🔬", blurb: "Full benchmark fetch, deep proof checking, and meta-reviewer synthesis. Closest to a real referee report." },
  { id: "novelty",  label: "Novelty-only",  time: "~5 min",  icon: "✦",  blurb: "Focused novelty audit — compares your contribution against the 20 benchmark papers only." },
  { id: "rebuttal", label: "Rebuttal prep", time: "~8 min",  icon: "↩",  blurb: "Anticipates objections from all four angles and drafts a structured response outline." },
];

export const PAPER_SECTIONS = [
  { id: "abstract",     label: "Abstract" },
  { id: "introduction", label: "§1 Introduction" },
  { id: "related",      label: "§2 Related work" },
  { id: "method",       label: "§3 Method" },
  { id: "experiments",  label: "§4 Experiments" },
  { id: "ablations",    label: "§4.3 Ablations" },
  { id: "conclusion",   label: "§5 Conclusion" },
];

// ─── Mock data (used until backend is wired) ──────────────────────────────────

export const MOCK_FINDINGS: ReviewFinding[] = [
  { id: "F1",  agent: "novelty",   severity: "critical", title: "Novelty claim partially subsumed by FedNova (B12)",
    section: "1 · Introduction",    line: 42,
    body: `The claimed contribution of "normalized local steps under client drift" overlaps substantially with Wang et al. 2020 (FedNova). Your variance-reduction mechanism differs, but the framing in §1 does not surface this distinction.`,
    fix: "Add a one-sentence distinction in §1.2 and an explicit comparison row in Table 1.",
    relatedBenchmarks: ["B12", "B3"], confidence: 0.88 },
  { id: "F2",  agent: "soundness", severity: "critical", title: "Assumption A3 contradicts the stated non-IID setting",
    section: "3.1 · Assumptions",   line: 128,
    body: "Assumption A3 requires bounded gradient dissimilarity σ², but the non-IID setup in §4.1 allows client distributions to diverge arbitrarily. The proof of Theorem 1 silently relies on A3.",
    fix: "Either restrict §4.1 experiments to a bounded-dissimilarity regime or weaken A3 to an expectation-bound.",
    relatedBenchmarks: ["B7", "B3"], confidence: 0.92 },
  { id: "F3",  agent: "rigor",     severity: "major",    title: "No variance across seeds in Table 2",
    section: "4.2 · Main results",  line: 241,
    body: "All numbers in Table 2 are single runs. Every benchmark paper in your set reports mean ± std over ≥3 seeds (see B1, B12, B15). Single-seed numbers at this margin will be flagged by reviewers.",
    fix: "Rerun with 3 seeds and add ± std. Budget ≈ 4 hrs GPU time per config.",
    relatedBenchmarks: ["B1", "B12", "B15"], confidence: 0.95 },
  { id: "F4",  agent: "rigor",     severity: "major",    title: "Missing comparison to SCAFFOLD (B3)",
    section: "4.2 · Main results",  line: 268,
    body: "SCAFFOLD (Karimireddy et al., 2020) is the standard variance-reduction baseline in this literature. It appears in 14/20 of your benchmark papers but not in your Table 2.",
    fix: "Add a row for SCAFFOLD. Reference implementation available.",
    relatedBenchmarks: ["B3", "B12", "B19"], confidence: 0.97 },
  { id: "F5",  agent: "clarity",   severity: "major",    title: "Notation collision: η used for both learning rate and step count",
    section: "3.2 · Method",        line: 165,
    body: "η denotes the local learning rate in Eq. (4) but the number of local steps in Eq. (7). This is the single most flagged category of issue in prior NeurIPS reviews on similar work.",
    fix: "Rename step count to τ, matching convention from B3 and B19.",
    relatedBenchmarks: ["B3", "B19"], confidence: 0.99 },
  { id: "F6",  agent: "soundness", severity: "major",    title: "Theorem 2 proof omits the stochastic gradient case",
    section: "3.3 · Analysis",      line: 198,
    body: "Theorem 2 is stated for stochastic gradients but the proof in Appendix B.2 uses only the deterministic smoothness inequality. The cross-term E[⟨∇f, ξ⟩] is not bounded.",
    fix: "Add Lemma B.3 bounding the cross-term. Standard; see B3 Appendix.",
    relatedBenchmarks: ["B3", "B13"], confidence: 0.84 },
  { id: "F7",  agent: "novelty",   severity: "minor",    title: "Missed discussion of MOON (B11)",
    section: "2 · Related work",    line: 78,
    body: "MOON (Li et al., CVPR 2021) uses a contrastive loss for non-IID federated learning — relevant framing for your Section 2 discussion, absent from citations.",
    fix: "Add one-sentence citation in §2.3.",
    relatedBenchmarks: ["B11"], confidence: 0.78 },
  { id: "F8",  agent: "clarity",   severity: "minor",    title: "Figure 3 caption is too terse",
    section: "Figure 3",            line: 301,
    body: `Caption reads "Convergence on CIFAR-10." Reviewers need: axes, shaded region meaning, number of seeds, dataset split.`,
    fix: "Expand caption to 3–4 sentences. Suggested draft available.",
    relatedBenchmarks: [], confidence: 0.91 },
  { id: "F9",  agent: "rigor",     severity: "minor",    title: "No ablation on the β hyperparameter",
    section: "4.3 · Ablations",     line: 289,
    body: `β is introduced as "tuned per dataset" but no sensitivity analysis is shown. Reviewers will ask.`,
    fix: "Add a small sweep (β ∈ {0.01, 0.1, 1.0, 10}) in Table 5.",
    relatedBenchmarks: ["B15"], confidence: 0.83 },
  { id: "F10", agent: "clarity",   severity: "minor",    title: `Abstract overclaims with "state-of-the-art"`,
    section: "Abstract",            line: 8,
    body: `Your results are best on 2 of 4 datasets. "State-of-the-art" without qualification will draw reviewer skepticism.`,
    fix: `Soften to "competitive with the best prior work" or qualify as "best on CIFAR-10/100".`,
    relatedBenchmarks: [], confidence: 0.86 },
  { id: "F11", agent: "soundness", severity: "nit",      title: "Eq. (6) is missing a factor of 1/n",
    section: "3.2 · Method",        line: 170,
    body: "The update rule drops the 1/n averaging. Likely a typo — the proof and code both use 1/n.",
    fix: "Insert 1/n. One-character fix.",
    relatedBenchmarks: [], confidence: 0.99 },
  { id: "F12", agent: "clarity",   severity: "nit",      title: `Inconsistent capitalization of "Federated"`,
    section: "Throughout",          line: null,
    body: `"Federated" is capitalized 14 times and lowercase 9 times. Pick one per your house style.`,
    fix: "Run a find-replace; suggest lowercase except at sentence start.",
    relatedBenchmarks: [], confidence: 1.0 },
];

export const MOCK_DIMENSION_SCORES: Record<string, DimensionScore> = {
  novelty:   { score: 5.5, of: 10, label: "Marginal novelty — positioning needs tightening" },
  soundness: { score: 6.0, of: 10, label: "One critical assumption gap; otherwise solid" },
  rigor:     { score: 5.0, of: 10, label: "Experimental scope is below venue expectations" },
  clarity:   { score: 7.0, of: 10, label: "Readable with a few notation and claim issues" },
};

export const MOCK_META: MetaRecommendation = {
  verdict: "Borderline — leaning weak accept",
  confidence: 0.72,
  overall: 6.2,
  summary: "A technically reasonable contribution with a novelty distinction that needs to be made explicit. The two critical findings (F1 novelty framing, F2 assumption gap) are both addressable in a rebuttal. Experimental rigor is the weakest axis — single-seed results and missing SCAFFOLD comparison will be flagged.",
  strengths: [
    "Clean theoretical framing, Theorem 1 proof is mostly complete",
    "Strong writing and structure (Clarity 7.0)",
    "Timely topic, well-cited in recent venue papers",
  ],
  weaknesses: [
    "Experimental setup does not match venue norms (single seeds, missing baselines)",
    "Novelty claim needs one extra paragraph vs FedNova",
    "Assumption A3 contradicts the stated non-IID setting",
  ],
  actionPlan: [
    { label: "Must-fix before submission",  items: ["F1", "F2", "F4"] },
    { label: "Strongly recommended",        items: ["F3", "F5", "F6"] },
    { label: "Nice-to-have",               items: ["F7", "F8", "F9", "F10"] },
    { label: "Cosmetic",                   items: ["F11", "F12"] },
  ],
};

export const MOCK_BENCHMARKS: BenchmarkPaper[] = [
  { id: "B1",  title: "FedAvg: Communication-Efficient Learning of Deep Networks",                  authors: "McMahan et al.",        venue: "AISTATS", year: 2017, citations: 14820, similarity: 0.81, tags: ["federated", "optimization", "communication"] },
  { id: "B3",  title: "SCAFFOLD: Stochastic Controlled Averaging for Federated Learning",           authors: "Karimireddy et al.",     venue: "ICML",    year: 2020, citations: 2310,  similarity: 0.77, tags: ["variance-reduction", "non-IID", "federated"] },
  { id: "B7",  title: "Tackling the Objective Inconsistency Problem in Heterogeneous FL",           authors: "Wang et al.",            venue: "NeurIPS", year: 2020, citations: 980,   similarity: 0.69, tags: ["non-IID", "objective", "federated"] },
  { id: "B11", title: "MOON: Model-Contrastive Federated Learning",                                 authors: "Li et al.",              venue: "CVPR",    year: 2021, citations: 720,   similarity: 0.64, tags: ["contrastive", "non-IID", "federated"] },
  { id: "B12", title: "FedNova: Tackling the Objective Inconsistency Problem via Normalized Averaging", authors: "Wang et al.",        venue: "NeurIPS", year: 2020, citations: 1450,  similarity: 0.88, tags: ["normalization", "federated", "heterogeneous"] },
  { id: "B13", title: "On the Convergence of FedProx",                                              authors: "Li et al.",              venue: "ICLR",    year: 2020, citations: 1820,  similarity: 0.72, tags: ["convergence", "proximal", "federated"] },
  { id: "B15", title: "Adaptive Federated Optimization",                                            authors: "Reddi et al.",           venue: "ICLR",    year: 2021, citations: 1090,  similarity: 0.71, tags: ["adaptive", "momentum", "federated"] },
  { id: "B19", title: "FedProx: Federated Optimization for Heterogeneous Networks",                  authors: "Li et al.",              venue: "MLSys",   year: 2020, citations: 3240,  similarity: 0.72, tags: ["proximal", "heterogeneous", "federated"] },
];
