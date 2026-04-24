"use client";

import { Sparkles, Code, ChevronRight } from "lucide-react";
import type { ReviewFinding } from "@/lib/types";
import { REVIEW_AGENTS } from "@/lib/reviewConstants";

const SEVERITY_META: Record<ReviewFinding["severity"], { label: string; color: string }> = {
  critical: { label: "Critical", color: "var(--err)" },
  major:    { label: "Major",    color: "var(--warn)" },
  minor:    { label: "Minor",    color: "var(--accent-2)" },
  nit:      { label: "Nit",      color: "var(--ink-4)" },
};

interface Props {
  finding: ReviewFinding;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}

export default function FindingCard({ finding: f, active, onClick, compact }: Props) {
  const agent = REVIEW_AGENTS.find(a => a.id === f.agent)!;
  const sev = SEVERITY_META[f.severity];

  const handleAutoFix = (e: React.MouseEvent) => {
    e.stopPropagation();
    const lineInfo = f.line != null ? ` on line ${f.line}` : "";
    window.dispatchEvent(new CustomEvent("comment-ai-action", {
      detail: {
        message: `Apply this review suggestion${lineInfo}: "${f.fix}"`,
        commentLine: f.line ?? undefined,
        commentText: f.title,
      },
    }));
  };

  return (
    <button
      onClick={onClick}
      className="fadein"
      style={{
        textAlign: "left", padding: "10px 12px", borderRadius: 7, cursor: "pointer", width: "100%",
        background: active ? "var(--bg-2)" : "transparent",
        border: `1px solid ${active ? agent.color : "var(--rule)"}`,
        boxShadow: active ? `0 0 0 3px color-mix(in oklab, ${agent.color} 12%, transparent)` : "none",
        display: "flex", flexDirection: "column", gap: 5,
        transition: "all .14s",
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 3%, transparent)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Top row: id + severity + agent + section + confidence */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", fontWeight: 600 }}>
          {f.id}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
          color: sev.color, padding: "1px 6px", borderRadius: 3,
          background: `color-mix(in oklab, ${sev.color} 12%, transparent)`,
        }}>
          {sev.label}
        </span>
        <span style={{
          fontSize: 10.5, fontWeight: 600, color: agent.color, padding: "1px 6px", borderRadius: 3,
          background: `color-mix(in oklab, ${agent.color} 10%, transparent)`,
        }}>
          {agent.label}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
          {f.section}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
          conf {f.confidence.toFixed(2)}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
        {f.title}
      </div>

      {!compact && (
        <>
          {/* Body */}
          <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.45 }}>
            {f.body}
          </div>

          {/* Expanded: fix + actions */}
          {active && (
            <div className="fadein" style={{
              marginTop: 6, paddingTop: 8,
              borderTop: "1px dashed var(--rule)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: 11, color: agent.color, fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                suggested fix
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
                {f.fix}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  className="btn sm"
                  onClick={handleAutoFix}
                  style={{ background: agent.color, color: "white", borderColor: agent.color, gap: 5 }}
                >
                  <Sparkles size={12} /> Open auto-fix in diff
                </button>
                {f.line != null && (
                  <button
                    className="btn ghost sm"
                    onClick={e => e.stopPropagation()}
                    style={{ gap: 5 }}
                  >
                    <Code size={12} /> Jump to §{f.section.split(" ")[0]}
                  </button>
                )}
                {f.relatedBenchmarks.length > 0 && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, color: "var(--ink-3)", marginLeft: "auto" }}>
                    <span style={{ fontFamily: "var(--font-mono)" }}>related:</span>
                    {f.relatedBenchmarks.map(bid => (
                      <span key={bid} className="chip" style={{ fontSize: 10, padding: "1px 6px" }}>{bid}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Compact: just chevron hint when not expanded */}
      {compact && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
          <ChevronRight size={11} /> {f.section}
        </div>
      )}
    </button>
  );
}
