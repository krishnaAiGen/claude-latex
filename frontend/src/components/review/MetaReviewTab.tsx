"use client";

import type { ReviewFinding, MetaRecommendation, DimensionScore } from "@/lib/types";
import { REVIEW_AGENTS } from "@/lib/reviewConstants";
import FindingCard from "./FindingCard";

interface Props {
  findings: ReviewFinding[];
  all: ReviewFinding[];
  meta: MetaRecommendation;
  scores: Record<string, DimensionScore>;
  active: string | null;
  setActive: (id: string | null) => void;
}

export default function MetaReviewTab({ findings, all, meta, scores, active, setActive }: Props) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Left: scores + strengths/weaknesses */}
      <div>
        {/* Overall score */}
        <div className="card" style={{ padding: 18, marginBottom: 16, background: "var(--bg-2)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                overall score
              </div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 56, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {meta.overall.toFixed(1)}
                <span style={{ color: "var(--ink-4)", fontSize: 24 }}> / 10</span>
              </div>
            </div>
            <div style={{ flex: 1, paddingBottom: 8 }}>
              <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
                {meta.summary}
              </div>
            </div>
          </div>
        </div>

        {/* Dimension scores */}
        <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>
          Dimension scores
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {REVIEW_AGENTS.map(a => {
            const s = scores[a.id];
            if (!s) return null;
            const count = all.filter(f => f.agent === a.id).length;
            return (
              <div key={a.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{a.label}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>· {count} findings</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--ink)" }}>
                    {s.score.toFixed(1)}<span style={{ color: "var(--ink-4)", fontSize: 12 }}>/{s.of}</span>
                  </span>
                </div>
                <div style={{ height: 5, background: "var(--bg-2)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${(s.score / s.of) * 100}%`, background: a.color, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Strengths / Weaknesses */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="card" style={{ padding: 14, background: "color-mix(in oklab, var(--ok) 5%, var(--bg-2))", borderColor: "color-mix(in oklab, var(--ok) 20%, var(--rule))" }}>
            <div style={{ fontSize: 11, color: "var(--ok)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
              strengths
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: 5 }}>
              {meta.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="card" style={{ padding: 14, background: "color-mix(in oklab, var(--warn) 6%, var(--bg-2))", borderColor: "color-mix(in oklab, var(--warn) 24%, var(--rule))" }}>
            <div style={{ fontSize: 11, color: "var(--warn)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
              weaknesses
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, display: "flex", flexDirection: "column", gap: 5 }}>
              {meta.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Right: action plan + findings list */}
      <div>
        {/* Action plan */}
        <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>
          Action plan
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {meta.actionPlan.map((group, gi) => (
            <div key={gi} className="card" style={{ padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginBottom: 6 }}>{group.label}</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {group.items.map(fid => {
                  const f = all.find(x => x.id === fid);
                  if (!f) return null;
                  const agent = REVIEW_AGENTS.find(a => a.id === f.agent)!;
                  return (
                    <button
                      key={fid}
                      onClick={() => setActive(active === fid ? null : fid)}
                      className="chip"
                      style={{ cursor: "pointer", fontSize: 10.5, borderColor: agent.color, color: agent.color, background: `color-mix(in oklab, ${agent.color} 8%, transparent)` }}
                    >
                      {fid}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Findings */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>
            Findings ({findings.length})
          </h3>
          <span style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>click any to open auto-fix</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {findings.map(f => (
            <FindingCard
              key={f.id}
              finding={f}
              active={active === f.id}
              onClick={() => setActive(active === f.id ? null : f.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
