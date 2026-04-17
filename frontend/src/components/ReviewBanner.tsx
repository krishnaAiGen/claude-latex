"use client";

import { Check, X, Sparkles } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { compileDocument, getPdfUrl } from "@/lib/api";

export default function ReviewBanner() {
  const {
    reviewMode,
    pendingLatex,
    originalLatex,
    acceptReview,
    rejectReview,
    currentProjectId,
    setCompilationStatus,
    setPdfUrl,
    refreshPdf,
  } = useEditorStore();

  if (!reviewMode || !pendingLatex || !originalLatex) return null;

  // Count changed lines (rough estimate)
  const oldLines = originalLatex.split("\n");
  const newLines = pendingLatex.split("\n");
  const changedCount = Math.abs(newLines.length - oldLines.length) +
    oldLines.filter((l, i) => newLines[i] !== undefined && newLines[i] !== l).length;

  const handleAccept = async () => {
    acceptReview();
    // Trigger compile after accepting
    if (currentProjectId && pendingLatex) {
      setCompilationStatus("compiling");
      try {
        const result = await compileDocument(currentProjectId, pendingLatex);
        if (result.success) {
          setCompilationStatus("success");
          setPdfUrl(getPdfUrl(currentProjectId));
          refreshPdf();
        } else {
          setCompilationStatus("error");
        }
      } catch {
        setCompilationStatus("error");
      }
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b animate-fadeIn"
      style={{
        backgroundColor: "var(--bg-tertiary)",
        borderColor: "var(--accent)",
        borderBottomWidth: "2px",
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={16} style={{ color: "var(--accent)" }} />
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          AI suggested changes
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            backgroundColor: "var(--accent)",
            color: "white",
          }}
        >
          ~{changedCount} line{changedCount !== 1 ? "s" : ""}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Review below • You can edit before accepting
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={rejectReview}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors"
          style={{
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          <X size={14} />
          Reject All
        </button>
        <button
          onClick={handleAccept}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium"
          style={{
            backgroundColor: "var(--success)",
            color: "white",
          }}
        >
          <Check size={14} />
          Accept All
        </button>
      </div>
    </div>
  );
}
