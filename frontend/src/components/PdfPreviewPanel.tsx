"use client";

import { useEditorStore } from "@/store/editorStore";

export default function PdfPreviewPanel() {
  const { pdfUrl, pdfTimestamp, compilationStatus } = useEditorStore();

  const fileUrl = pdfUrl ? `${pdfUrl}&t=${pdfTimestamp}` : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1 text-xs border-b"
        style={{
          backgroundColor: "var(--bg-3)",
          borderColor: "var(--rule)",
          color: "var(--ink-3)",
        }}
      >
        <span>PDF Preview</span>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-hidden" style={{ backgroundColor: "#525659" }}>
        {compilationStatus === "compiling" && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="animate-spin w-8 h-8 border-2 rounded-full mx-auto mb-2"
                style={{
                  borderColor: "var(--rule)",
                  borderTopColor: "var(--accent)",
                }}
              />
              <p className="text-sm" style={{ color: "var(--ink-3)" }}>
                Compiling...
              </p>
            </div>
          </div>
        )}

        {!fileUrl && compilationStatus !== "compiling" && (
          <div className="flex items-center justify-center h-full">
            <p
              className="text-sm text-center"
              style={{ color: "var(--ink-3)" }}
            >
              Click &quot;Compile&quot; to generate PDF
            </p>
          </div>
        )}

        {fileUrl && compilationStatus !== "compiling" && (
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title="PDF Preview"
          />
        )}
      </div>
    </div>
  );
}
