"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { generateDiffSummary, pushToMain, getDraft } from "@/lib/api";

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd > start && newEnd > start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  const ctxStart = Math.max(0, start - 3);
  for (let i = ctxStart; i < start; i++) {
    result.push({ type: "context", content: oldLines[i] });
  }
  for (let i = start; i <= oldEnd; i++) {
    result.push({ type: "remove", content: oldLines[i] });
  }
  for (let i = start; i <= newEnd; i++) {
    result.push({ type: "add", content: newLines[i] });
  }
  const ctxEndOld = Math.min(oldLines.length - 1, oldEnd + 3);
  for (let i = oldEnd + 1; i <= ctxEndOld; i++) {
    result.push({ type: "context", content: oldLines[i] });
  }

  return result;
}

interface Props {
  projectId: string;
  onClose: () => void;
  onPushed: (versionNumber: number) => void;
}

export default function PushModal({ projectId, onClose, onPushed }: Props) {
  const { latexContent, savedContent, setMainAhead, setDraftInfo } = useEditorStore();
  const [summary, setSummary] = useState("");
  const [diffStats, setDiffStats] = useState<{
    lines_added: number;
    lines_removed: number;
    sections_changed: string[];
  } | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [done, setDone] = useState(false);
  const initialized = useRef(false);

  const diffLines = computeDiff(savedContent, latexContent);
  const addCount = diffStats?.lines_added ?? diffLines.filter((l) => l.type === "add").length;
  const delCount = diffStats?.lines_removed ?? diffLines.filter((l) => l.type === "remove").length;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const load = async () => {
      setGeneratingSummary(true);
      try {
        const result = await generateDiffSummary(projectId, savedContent, latexContent);
        setSummary(result.summary);
        setDiffStats(result.diff_stats);
      } catch (e) {
        console.error(e);
      } finally {
        setGeneratingSummary(false);
      }
    };
    load();
  }, [projectId, latexContent, savedContent]);

  const handlePush = async () => {
    if (!summary.trim() || pushing) return;
    setPushing(true);
    try {
      const result = await pushToMain(projectId, summary);
      setMainAhead(false);
      const updated = await getDraft(projectId);
      setDraftInfo(updated.forked_from_version, updated.main_version, false);
      setDone(true);
      setTimeout(() => {
        onPushed(result.version_number);
        onClose();
      }, 1100);
    } catch (e) {
      console.error(e);
      setPushing(false);
    }
  };

  const hunkHeader = `@@ -1,${savedContent.split("\n").length} +1,${latexContent.split("\n").length} @@ main.tex`;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "color-mix(in oklab, var(--ink) 50%, transparent)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "min(1040px, 100%)",
          height: "min(720px, 90vh)",
          display: "flex",
          flexDirection: "column",
          animation: "rise .28s var(--spring)",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--rule)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "conic-gradient(from 200deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, letterSpacing: "-0.01em" }}>
                Review changes before push
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                main → main · {addCount} additions, {delCount} deletions
              </div>
            </div>
          </div>
          <button className="btn icon ghost" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Two-column body */}
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", flex: 1, minHeight: 0 }}>
          {/* Left: file list + AI summary */}
          <div
            style={{
              borderRight: "1px solid var(--rule)",
              background: "var(--bg-2)",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "12px 12px 6px",
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              Files · 1
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                fontSize: 12,
                background: "color-mix(in oklab, var(--accent) 12%, transparent)",
                borderLeft: "2px solid var(--accent)",
                color: "var(--ink)",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  background: "color-mix(in oklab, var(--warn) 22%, var(--bg))",
                  color: "var(--warn)",
                }}
              >
                M
              </span>
              <span style={{ flex: 1 }}>main.tex</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ok)" }}>+{addCount}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--err)" }}>−{delCount}</span>
            </div>

            {/* AI summary */}
            <div
              style={{
                padding: "12px 12px 4px",
                fontSize: 10.5,
                fontFamily: "var(--font-mono)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
                borderTop: "1px solid var(--rule)",
                marginTop: 8,
              }}
            >
              ◆ AI summary
            </div>
            <div style={{ padding: "6px 12px 12px", flex: 1 }}>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={generatingSummary ? "Generating summary…" : "Describe what changed…"}
                disabled={generatingSummary}
                rows={5}
                className="textarea"
                style={{ fontSize: 11.5, lineHeight: 1.45 }}
              />
              <div style={{ marginTop: 6, fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
                {generatingSummary ? "AI is drafting…" : "AI drafted this from your diff. Edit freely."}
              </div>
            </div>
          </div>

          {/* Right: diff view */}
          <div style={{ overflow: "auto", background: "var(--bg)" }}>
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid var(--rule)",
                background: "var(--bg-2)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--ink-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>main.tex</span>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                <span style={{ color: "var(--ok)" }}>+{addCount}</span>
                {"  "}
                <span style={{ color: "var(--err)" }}>−{delCount}</span>
              </span>
            </div>
            <div style={{ borderBottom: "1px solid var(--rule)" }}>
              <div
                style={{
                  padding: "6px 14px",
                  background: "color-mix(in oklab, var(--accent) 6%, var(--bg))",
                  color: "var(--accent)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
              >
                {hunkHeader}
              </div>
              <div style={{ padding: "4px 0" }}>
                {diffLines.length === 0 ? (
                  <div style={{ padding: "20px 14px", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-4)" }}>
                    No changes
                  </div>
                ) : (
                  diffLines.map((line, j) => (
                    <div
                      key={j}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        lineHeight: 1.55,
                        background:
                          line.type === "add"
                            ? "color-mix(in oklab, var(--ok) 10%, transparent)"
                            : line.type === "remove"
                            ? "color-mix(in oklab, var(--err) 9%, transparent)"
                            : "transparent",
                      }}
                    >
                      <div
                        style={{
                          textAlign: "center",
                          color:
                            line.type === "add"
                              ? "var(--ok)"
                              : line.type === "remove"
                              ? "var(--err)"
                              : "var(--ink-4)",
                          userSelect: "none",
                        }}
                      >
                        {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
                      </div>
                      <div
                        style={{
                          paddingRight: 14,
                          color:
                            line.type === "add"
                              ? "var(--ink)"
                              : line.type === "remove"
                              ? "var(--ink-3)"
                              : "var(--ink-2)",
                        }}
                      >
                        {line.content || "\u00a0"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--rule)",
            background: "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            {done ? "✓ pushed to main" : pushing ? "pushing…" : "commit to main"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn accent"
              onClick={handlePush}
              disabled={pushing || done || !summary.trim()}
            >
              {done ? (
                <><Check size={13} /> Pushed</>
              ) : pushing ? (
                <><span className="td" /><span className="td" /><span className="td" /></>
              ) : (
                "Push to main"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
