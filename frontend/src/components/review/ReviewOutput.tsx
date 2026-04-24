"use client";

import { useState } from "react";
import { History, Download, Sparkles } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import SeverityFilter from "./SeverityFilter";
import MetaReviewTab from "./MetaReviewTab";
import BySectionTab from "./BySectionTab";
import BenchmarkTab from "./BenchmarkTab";
import type { ReviewFinding } from "@/lib/types";

type Severity = "all" | ReviewFinding["severity"];

export default function ReviewOutput() {
  const {
    reviewFindings, reviewDimensionScores, reviewMetaRecommendation,
    reviewBenchmarkPapers, activeReviewFinding, reviewOutputTab,
    setActiveReviewFinding, setReviewOutputTab, setReviewPhase, reviewConfig,
  } = useEditorStore();

  const [sevFilter, setSevFilter] = useState<Severity>("all");
  const meta = reviewMetaRecommendation;

  if (!meta) return null;

  const filtered = reviewFindings.filter(f =>
    sevFilter === "all" || f.severity === sevFilter
  );

  const TABS: { id: typeof reviewOutputTab; label: string }[] = [
    { id: "meta",      label: "Meta review" },
    { id: "sections",  label: "By section" },
    { id: "benchmark", label: "Benchmark comparison" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--rule)", background: "var(--bg-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
              review · {reviewConfig?.venue ?? "neurips26"} · {reviewConfig?.mode === "speed" ? "speed" : "in-depth"} · finished 4m ago
            </div>
            <div style={{ fontSize: 18, fontFamily: "var(--font-serif)", letterSpacing: "-0.01em", marginTop: 2, color: "var(--ink)" }}>
              {meta.verdict}{" "}
              <span style={{ color: "var(--ink-3)" }}>· confidence {meta.confidence.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn ghost sm" style={{ gap: 5 }}><History size={13} /> Compare runs</button>
            <button className="btn ghost sm" style={{ gap: 5 }}><Download size={13} /> Export</button>
            <button
              className="btn sm"
              onClick={() => setReviewPhase("setup")}
              style={{ background: "var(--accent-3)", color: "white", borderColor: "var(--accent-3)", gap: 5 }}
            >
              <Sparkles size={13} /> New review
            </button>
          </div>
        </div>

        {/* Tab bar + filter */}
        <div style={{ display: "flex", gap: 2, marginTop: 14, alignItems: "center" }}>
          {TABS.map(({ id, label }) => {
            const on = reviewOutputTab === id;
            return (
              <button key={id} onClick={() => setReviewOutputTab(id)} style={{
                padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: on ? "var(--bg)" : "transparent",
                color: on ? "var(--ink)" : "var(--ink-3)",
                boxShadow: on ? "0 1px 2px rgba(0,0,0,.06), 0 0 0 1px var(--rule)" : "none",
                transition: "all .12s",
              }}>
                {label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <SeverityFilter filter={sevFilter} setFilter={setSevFilter} findings={reviewFindings} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 22px" }}>
        {reviewOutputTab === "meta" && (
          <MetaReviewTab
            findings={filtered}
            all={reviewFindings}
            meta={meta}
            scores={reviewDimensionScores}
            active={activeReviewFinding}
            setActive={setActiveReviewFinding}
          />
        )}
        {reviewOutputTab === "sections" && (
          <BySectionTab
            findings={filtered}
            active={activeReviewFinding}
            setActive={setActiveReviewFinding}
          />
        )}
        {reviewOutputTab === "benchmark" && (
          <BenchmarkTab
            benchmarks={reviewBenchmarkPapers}
            scores={reviewDimensionScores}
          />
        )}
      </div>
    </div>
  );
}
