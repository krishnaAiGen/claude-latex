"use client";

import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";

export default function StatusBar() {
  const { compilationStatus, compilationErrors, selectionRange } =
    useEditorStore();

  return (
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
            <>
              <AlertCircle size={12} style={{ color: "var(--error)" }} />
              <span>
                {compilationErrors.length} error
                {compilationErrors.length !== 1 ? "s" : ""}
              </span>
            </>
          )}
          {compilationStatus === "idle" && <span>Ready</span>}
        </div>

        {/* Errors list */}
        {compilationErrors.length > 0 && (
          <div className="flex items-center gap-2">
            {compilationErrors.slice(0, 3).map((err, i) => (
              <span key={i} style={{ color: "var(--error)" }}>
                {err.line ? `L${err.line}: ` : ""}
                {err.message.slice(0, 50)}
              </span>
            ))}
          </div>
        )}
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
  );
}
