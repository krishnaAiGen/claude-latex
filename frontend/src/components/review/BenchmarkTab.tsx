"use client";

import { useState } from "react";
import type { BenchmarkPaper, DimensionScore } from "@/lib/types";
import { REVIEW_AGENTS } from "@/lib/reviewConstants";

const FIELD_AVG: Record<string, number> = {
  novelty: 6.8, rigor: 7.2, clarity: 6.4, soundness: 6.9,
};

type SortKey = "similarity" | "year" | "citations";

interface Props {
  benchmarks: BenchmarkPaper[];
  scores: Record<string, DimensionScore>;
}

export default function BenchmarkTab({ benchmarks, scores }: Props) {
  const [sort, setSort] = useState<SortKey>("similarity");

  const sorted = [...benchmarks].sort((a, b) =>
    sort === "year" ? b.year - a.year :
    sort === "citations" ? b.citations - a.citations :
    b.similarity - a.similarity
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Your paper vs the field */}
      <div className="card" style={{ padding: 20, marginBottom: 22, background: "var(--bg-2)" }}>
        <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
          your paper vs the field
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {REVIEW_AGENTS.map(a => {
            const you = scores[a.id]?.score ?? 0;
            const field = FIELD_AVG[a.id] ?? 7;
            const delta = you - field;
            return (
              <div key={a.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: delta >= 0 ? "var(--ok)" : "var(--err)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
                  </div>
                </div>
                <div style={{ position: "relative", height: 30, background: "var(--bg)", borderRadius: 4, border: "1px solid var(--rule)", overflow: "hidden" }}>
                  {/* Field distribution band */}
                  <div style={{ position: "absolute", left: `${(field - 1.5) * 10}%`, width: "30%", top: 0, bottom: 0, background: `color-mix(in oklab, ${a.color} 15%, transparent)` }} />
                  {/* Field mean line */}
                  <div style={{ position: "absolute", left: `${field * 10}%`, top: 0, bottom: 0, width: 1, background: "var(--ink-3)" }} />
                  {/* Your score */}
                  <div style={{ position: "absolute", left: `${you * 10}%`, top: 0, bottom: 0, width: 3, background: a.color, transform: "translateX(-50%)", boxShadow: `0 0 0 3px color-mix(in oklab, ${a.color} 25%, transparent)`, borderRadius: 2 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)", marginTop: 3 }}>
                  <span>you {you.toFixed(1)}</span>
                  <span>field {field.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Benchmark papers */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 24, letterSpacing: "-0.01em" }}>
          {benchmarks.length} benchmark papers
        </h3>
        <div style={{ display: "flex", gap: 3, background: "var(--bg-2)", border: "1px solid var(--rule)", borderRadius: 7, padding: 3 }}>
          {(["similarity", "year", "citations"] as SortKey[]).map(id => {
            const on = sort === id;
            return (
              <button key={id} onClick={() => setSort(id)} style={{
                padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600,
                background: on ? "var(--bg)" : "transparent",
                color: on ? "var(--ink)" : "var(--ink-3)",
                boxShadow: on ? "0 0 0 1px var(--rule)" : "none",
                textTransform: "capitalize",
              }}>
                {id}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 10 }}>
        {sorted.map(p => (
          <div key={p.id} className="card" style={{ padding: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-3)", fontWeight: 600 }}>{p.id}</span>
              <span style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{p.venue} · {p.year}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
                {p.citations.toLocaleString()} cites
              </span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3, marginBottom: 4 }}>{p.title}</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>{p.authors}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 4, background: "var(--bg-2)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${p.similarity * 100}%`, background: "linear-gradient(90deg, var(--accent-3), var(--accent))", borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                {Math.round(p.similarity * 100)}% sim
              </span>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
              {p.tags.map(t => (
                <span key={t} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--bg-2)", color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
