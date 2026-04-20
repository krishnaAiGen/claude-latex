"use client";

import { useState } from "react";
import { GitBranch, GitPullRequest, Upload, Sparkles, Loader2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { saveDraft, getDraft, generateDiffSummary } from "@/lib/api";

interface Props {
  projectId: string;
}

export default function SourceControlPanel({ projectId }: Props) {
  const {
    isDirty, latexContent, savedContent,
    myRole, mainAhead,
    setLatexContent, setSavedContent, setDraftInfo, setMainAhead,
    setShowPushModal,
  } = useEditorStore();

  const [commitMsg, setCommitMsg] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullDone, setPullDone] = useState(false);

  const canPush = myRole === "owner" || myRole === "editor";

  const changes = isDirty
    ? [{ file: "main.tex", status: "M" as const }]
    : [];

  const handleGenerate = async () => {
    if (genLoading || !isDirty) return;
    setGenLoading(true);
    try {
      const result = await generateDiffSummary(projectId, savedContent, latexContent);
      setCommitMsg(result.summary);
    } catch {
      // silently fail — user can type manually
    } finally {
      setGenLoading(false);
    }
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      await saveDraft(projectId, latexContent);
      const updated = await getDraft(projectId);
      setLatexContent(updated.content);
      setSavedContent(updated.content);
      setDraftInfo(updated.forked_from_version, updated.main_version, false);
      setMainAhead(false);
      setPullDone(true);
      setTimeout(() => setPullDone(false), 2000);
    } catch {
      // ignore
    } finally {
      setPulling(false);
    }
  };

  return (
    <>
      {/* Header */}
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
          Source Control
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
          origin/main
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 10px 12px",
          borderTop: "1px solid var(--rule)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Branch status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px",
            background: "var(--bg)",
            border: "1px solid var(--rule)",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <GitBranch size={13} style={{ color: "var(--ink-3)" }} />
            <span style={{ fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>main</span>
          </div>
          {mainAhead && (
            <span style={{ fontSize: 10, color: "var(--warn)", fontFamily: "var(--font-mono)" }}>
              ↓ behind
            </span>
          )}
          {!mainAhead && isDirty && (
            <span style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
              ↑ ahead
            </span>
          )}
          {!mainAhead && !isDirty && (
            <span style={{ fontSize: 10, color: "var(--ok)", fontFamily: "var(--font-mono)" }}>
              up to date
            </span>
          )}
        </div>

        {/* Pull / Push buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="btn sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={handlePull}
            disabled={pulling || !mainAhead}
          >
            {pulling ? (
              <Loader2 size={12} className="animate-spin" />
            ) : pullDone ? (
              "✓"
            ) : (
              <GitPullRequest size={12} />
            )}
            {pullDone ? "Pulled" : "Pull"}
          </button>
          <button
            className="btn accent sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setShowPushModal(true)}
            disabled={!isDirty || !canPush}
          >
            <Upload size={12} />
            Push
          </button>
        </div>

        {/* Commit message */}
        {canPush && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--ink-3)",
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                Message
              </span>
              <button
                className="btn ghost sm"
                style={{ padding: "2px 7px", fontSize: 10.5, gap: 4 }}
                onClick={handleGenerate}
                disabled={genLoading || !isDirty}
                title="Generate AI summary"
              >
                {genLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                AI
              </button>
            </div>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Describe your changes…"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              style={{ fontSize: 12, padding: "7px 9px", resize: "none" }}
            />
          </div>
        )}

        {/* Changed files */}
        {changes.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--ink-3)",
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: ".06em",
                marginBottom: 4,
              }}
            >
              Changes ({changes.length})
            </div>
            {changes.map((c) => (
              <div key={c.file} className="tree-row" style={{ cursor: "default" }}>
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
                    flexShrink: 0,
                    background: "color-mix(in oklab, var(--warn) 22%, var(--bg))",
                    color: "var(--warn)",
                  }}
                >
                  {c.status}
                </span>
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                    color: "var(--ink-2)",
                  }}
                >
                  {c.file}
                </span>
              </div>
            ))}
          </div>
        )}

        {!isDirty && (
          <div
            style={{
              textAlign: "center",
              padding: "24px 0",
              color: "var(--ink-4)",
              fontSize: 12,
            }}
          >
            No changes
          </div>
        )}
      </div>
    </>
  );
}
