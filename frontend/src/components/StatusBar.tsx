"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Loader2, ChevronUp, ChevronDown, Copy, Check } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";

export default function StatusBar() {
  const { compilationStatus, compilationErrors, selectionRange } =
    useEditorStore();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasErrors = compilationErrors.length > 0;

  const copyErrors = () => {
    const text = compilationErrors
      .map((e) => `${e.line ? `Line ${e.line}: ` : ""}${e.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      {/* Expandable error panel */}
      {hasErrors && expanded && (
        <div
          className="border-t px-4 py-2 max-h-40 overflow-y-auto animate-slideDown"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--error)",
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--error)" }}>
              Compilation Errors
            </span>
            <button
              onClick={copyErrors}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
              }}
            >
              {copied ? <Check size={10} style={{ color: "var(--success)" }} /> : <Copy size={10} />}
              {copied ? "Copied" : "Copy All"}
            </button>
          </div>
          {compilationErrors.map((err, i) => (
            <div
              key={i}
              className="text-xs font-mono py-0.5 border-b last:border-0"
              style={{
                color: "var(--text-primary)",
                borderColor: "var(--border)",
              }}
            >
              {err.line && (
                <span className="font-semibold" style={{ color: "var(--error)" }}>
                  Line {err.line}:{" "}
                </span>
              )}
              {err.message}
            </div>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 py-1 text-xs border-t"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        <div className="flex items-center gap-4">
          {/* Compilation status */}
          <div className="flex items-center gap-1.5">
            {compilationStatus === "compiling" && (
              <>
                <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                <span>Compiling...</span>
              </>
            )}
            {compilationStatus === "success" && (
              <>
                <CheckCircle size={12} style={{ color: "var(--success)" }} />
                <span>Compiled</span>
              </>
            )}
            {compilationStatus === "error" && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5"
                style={{ color: "var(--error)" }}
              >
                <AlertCircle size={12} />
                <span>
                  {compilationErrors.length} error{compilationErrors.length !== 1 ? "s" : ""}
                </span>
                {expanded ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
              </button>
            )}
            {compilationStatus === "idle" && <span>Ready</span>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {selectionRange && (
            <span>
              Ln {selectionRange.startLine}
              {selectionRange.endLine !== selectionRange.startLine
                ? `-${selectionRange.endLine}`
                : ""}
            </span>
          )}
          <span>LaTeX</span>
        </div>
      </div>
    </div>
  );
}
