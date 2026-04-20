"use client";

import { useEditorStore } from "@/store/editorStore";

interface OutlineEntry {
  level: 1 | 2 | 3;
  title: string;
  line: number;
}

const LEVEL_COLORS = ["var(--ink)", "var(--ink-2)", "var(--ink-3)"];

export default function OutlinePanel() {
  const { latexContent } = useEditorStore();

  const entries: OutlineEntry[] = [];
  const lines = latexContent.split("\n");
  lines.forEach((line, i) => {
    const s = line.match(/^\\section\*?\{(.+?)\}/);
    const ss = line.match(/^\\subsection\*?\{(.+?)\}/);
    const sss = line.match(/^\\subsubsection\*?\{(.+?)\}/);
    if (s) entries.push({ level: 1, title: s[1], line: i + 1 });
    else if (ss) entries.push({ level: 2, title: ss[1], line: i + 1 });
    else if (sss) entries.push({ level: 3, title: sss[1], line: i + 1 });
  });

  return (
    <>
      <div style={{ padding: "12px 12px 8px" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Outline
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
          main.tex · {entries.length} entries
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 6px", borderTop: "1px solid var(--rule)" }}>
        {entries.length === 0 && (
          <div style={{ padding: "28px 12px", textAlign: "center", color: "var(--ink-4)", fontSize: 12 }}>
            No sections found
          </div>
        )}
        {entries.map((e, i) => (
          <div
            key={i}
            className="tree-row"
            style={{ paddingLeft: 8 + (e.level - 1) * 14 }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: LEVEL_COLORS[e.level - 1],
                flexShrink: 0,
                display: "inline-block",
              }}
            />
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 12.5,
              }}
            >
              {e.title}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--ink-4)",
                fontFamily: "var(--font-mono)",
                flexShrink: 0,
              }}
            >
              {e.line}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
