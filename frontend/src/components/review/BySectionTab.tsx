"use client";

import type { ReviewFinding } from "@/lib/types";
import FindingCard from "./FindingCard";

interface Props {
  findings: ReviewFinding[];
  active: string | null;
  setActive: (id: string | null) => void;
}

export default function BySectionTab({ findings, active, setActive }: Props) {
  // Group by section
  const bySec = findings.reduce<Record<string, ReviewFinding[]>>((acc, f) => {
    (acc[f.section] = acc[f.section] || []).push(f);
    return acc;
  }, {});

  const sections = Object.keys(bySec).sort((a, b) => {
    const na = parseFloat(a), nb = parseFloat(b);
    if (isNaN(na) && isNaN(nb)) return a.localeCompare(b);
    if (isNaN(na)) return 1;
    if (isNaN(nb)) return -1;
    return na - nb;
  });

  if (findings.length === 0) {
    return (
      <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--ink-3)", maxWidth: 1000, margin: "0 auto" }}>
        No findings match the current filter.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      {sections.map(sec => (
        <div key={sec}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid var(--rule)" }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 22, letterSpacing: "-0.01em" }}>{sec}</h3>
            <span style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
              {bySec[sec].length} finding{bySec[sec].length > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bySec[sec].map(f => (
              <FindingCard
                key={f.id}
                finding={f}
                active={active === f.id}
                onClick={() => setActive(active === f.id ? null : f.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
