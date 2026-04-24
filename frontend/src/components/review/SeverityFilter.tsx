"use client";

import type { ReviewFinding } from "@/lib/types";

type Severity = "all" | ReviewFinding["severity"];

interface Props {
  filter: Severity;
  setFilter: (f: Severity) => void;
  findings: ReviewFinding[];
}

const OPTS: { id: Severity; label: string; color: string | null }[] = [
  { id: "all",      label: "All",      color: null },
  { id: "critical", label: "Critical", color: "var(--err)" },
  { id: "major",    label: "Major",    color: "var(--warn)" },
  { id: "minor",    label: "Minor",    color: "var(--accent-2)" },
  { id: "nit",      label: "Nit",      color: "var(--ink-4)" },
];

export default function SeverityFilter({ filter, setFilter, findings }: Props) {
  return (
    <div style={{
      display: "flex", gap: 3,
      background: "var(--bg)", border: "1px solid var(--rule)",
      borderRadius: 7, padding: 3,
    }}>
      {OPTS.map(({ id, label, color }) => {
        const on = filter === id;
        const count = id === "all" ? findings.length : findings.filter(f => f.severity === id).length;
        return (
          <button
            key={id}
            onClick={() => setFilter(id)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 5, cursor: "pointer",
              border: "none", fontSize: 11, fontWeight: 600,
              fontFamily: "var(--font-mono)",
              background: on ? "var(--bg-2)" : "transparent",
              color: on ? "var(--ink)" : "var(--ink-3)",
              boxShadow: on ? "0 0 0 1px var(--rule)" : "none",
              transition: "all .12s",
            }}
          >
            {color && (
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            )}
            {label}
            {on && id !== "all" && (
              <span style={{ color: "var(--ink-4)" }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
