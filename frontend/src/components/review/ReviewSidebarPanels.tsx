"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { REVIEW_AGENTS } from "@/lib/reviewConstants";
import type { ReviewFinding } from "@/lib/types";

// ─── Agents Panel ─────────────────────────────────────────────────────────────
export function ReviewAgentsPanel() {
  const { reviewFindings, reviewDimensionScores, reviewMetaRecommendation } = useEditorStore();
  const meta = reviewMetaRecommendation;

  return (
    <>
      <div style={{ padding: "12px 12px 6px" }}>
        <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
          Agents · NeurIPS 2026
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
          last run · 4m ago · in-depth
        </div>
      </div>

      <div style={{ padding: "2px 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
        {REVIEW_AGENTS.map(a => {
          const s = reviewDimensionScores[a.id];
          const count = reviewFindings.filter(f => f.agent === a.id).length;
          return (
            <div key={a.id} style={{ padding: "9px 11px", border: "1px solid var(--rule)", borderRadius: 7, background: "var(--bg-2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: a.color }} />
                  {a.label}
                </div>
                <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                  {s ? `${s.score.toFixed(1)}/10` : "—"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 3, borderRadius: 2, background: "var(--rule)", overflow: "hidden" }}>
                  {s && <div style={{ width: `${(s.score / s.of) * 100}%`, height: "100%", background: a.color }} />}
                </div>
                <span style={{ fontSize: 10.5, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{count} findings</span>
              </div>
            </div>
          );
        })}

        {/* Meta-reviewer */}
        {meta && (
          <div style={{ padding: "9px 11px", border: "1px dashed var(--rule)", borderRadius: 7, background: "var(--bg-2)", marginTop: 2 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 3,
                  background: "conic-gradient(from 200deg, var(--accent), var(--accent-2), var(--accent-3), #7C6CF6, var(--accent))",
                  display: "grid", placeItems: "center", color: "white", fontSize: 9, fontWeight: 700,
                }}>Σ</span>
                Meta-reviewer
              </div>
              <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                {meta.overall.toFixed(1)}/10
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.4 }}>{meta.verdict}</div>
          </div>
        )}
      </div>

      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", borderTop: "1px solid var(--rule)", marginTop: "auto", display: "flex", justifyContent: "space-between" }}>
        <span>{reviewFindings.length} findings</span>
        {meta && <span>conf {meta.confidence.toFixed(2)}</span>}
      </div>
    </>
  );
}

// ─── Findings Panel ────────────────────────────────────────────────────────────
export function ReviewFindingsPanel() {
  const { reviewFindings, setActiveReviewFinding, activeReviewFinding, setReviewOutputTab, setAppMode } = useEditorStore();
  const [sev, setSev] = useState<"all" | ReviewFinding["severity"]>("all");

  const filtered = reviewFindings.filter(f => sev === "all" || f.severity === sev);
  const sevCounts: [string, string, number][] = [
    ["all", "All", reviewFindings.length],
    ["critical", "Crit", reviewFindings.filter(f => f.severity === "critical").length],
    ["major", "Maj", reviewFindings.filter(f => f.severity === "major").length],
    ["minor", "Min", reviewFindings.filter(f => f.severity === "minor").length],
  ];

  return (
    <>
      <div style={{ padding: "12px 12px 6px" }}>
        <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
          Findings · {reviewFindings.length}
        </div>
      </div>

      <div style={{ padding: "0 10px 8px", display: "flex", gap: 3 }}>
        {sevCounts.map(([id, label, n]) => {
          const on = sev === id;
          return (
            <button
              key={id}
              onClick={() => setSev(id as typeof sev)}
              className="btn ghost sm"
              style={{
                flex: 1, padding: "3px 0", fontSize: 10.5, fontFamily: "var(--font-mono)",
                background: on ? "color-mix(in oklab, var(--accent-3) 10%, transparent)" : "transparent",
                color: on ? "var(--accent-3)" : "var(--ink-3)",
              }}
            >
              {label} <span style={{ color: "var(--ink-4)" }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map(f => {
          const agent = REVIEW_AGENTS.find(a => a.id === f.agent)!;
          const sevColor = {
            critical: "var(--err)", major: "var(--warn)", minor: "var(--accent-2)", nit: "var(--ink-4)",
          }[f.severity];
          const isActive = activeReviewFinding === f.id;
          return (
            <button
              key={f.id}
              onClick={() => {
                setActiveReviewFinding(f.id);
                setReviewOutputTab("meta");
              }}
              style={{
                width: "100%", textAlign: "left", padding: "7px 9px", borderRadius: 6,
                border: `1px solid ${isActive ? agent.color : "var(--rule)"}`,
                background: isActive ? `color-mix(in oklab, ${agent.color} 6%, var(--bg-2))` : "var(--bg-2)",
                cursor: "pointer", display: "flex", flexDirection: "column", gap: 3,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 3%, var(--bg-2))"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "var(--bg-2)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: sevColor, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", fontWeight: 600 }}>{f.id}</span>
                <span style={{ fontSize: 10, color: agent.color, fontWeight: 600, marginLeft: "auto" }}>{agent.label}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.3 }}>{f.title}</div>
              <div style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{f.section}</div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--rule)", fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", display: "flex", justifyContent: "space-between" }}>
        <span>{filtered.length} shown</span>
        <span>click → expand</span>
      </div>
    </>
  );
}

// ─── Benchmarks Panel ──────────────────────────────────────────────────────────
export function ReviewBenchmarksPanel() {
  const { reviewBenchmarkPapers } = useEditorStore();
  const [q, setQ] = useState("");

  const list = reviewBenchmarkPapers
    .filter(p => !q || p.title.toLowerCase().includes(q.toLowerCase()) || p.id.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.similarity - a.similarity);

  return (
    <>
      <div style={{ padding: "12px 12px 6px" }}>
        <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
          {reviewBenchmarkPapers.length} benchmark papers
        </div>
        <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
          by similarity
        </div>
      </div>

      <div style={{ padding: "4px 10px 6px" }}>
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 8, top: 7, color: "var(--ink-4)" }} />
          <input
            placeholder="filter…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{
              width: "100%", padding: "5px 8px 5px 28px", fontSize: 12,
              background: "var(--bg-2)", border: "1px solid var(--rule)", borderRadius: 6,
              color: "var(--ink)", outline: "none", fontFamily: "var(--font-ui)",
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
        {list.map(p => (
          <button
            key={p.id}
            style={{ width: "100%", textAlign: "left", padding: "7px 9px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer" }}
            onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 4%, transparent)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--accent-3)", fontWeight: 700 }}>{p.id}</span>
              <span style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{p.year}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{Math.round(p.similarity * 100)}%</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink)", lineHeight: 1.3 }}>{p.title}</div>
            <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginTop: 1 }}>{p.authors}</div>
          </button>
        ))}
        {list.length === 0 && (
          <div style={{ padding: "20px", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>
            No papers match
          </div>
        )}
      </div>
    </>
  );
}
