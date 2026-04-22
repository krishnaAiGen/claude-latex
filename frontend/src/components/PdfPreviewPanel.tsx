"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useEditorStore } from "@/store/editorStore";
import { synctexLookup } from "@/lib/api";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const BASE_WIDTH =
  typeof window !== "undefined" ? Math.min(800, window.innerWidth - 60) : 800;

export default function PdfPreviewPanel() {
  const { pdfUrl, pdfTimestamp, compilationStatus, currentProjectId } = useEditorStore();
  const [numPages, setNumPages] = useState(0);
  // zoom: live visual zoom (updates every wheel frame)
  // renderZoom: the width prop passed to <Page> — debounced to avoid canvas redraws
  const [zoom, setZoom] = useState(1.0);
  const [renderZoom, setRenderZoom] = useState(1.0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Natural page dimensions in PDF points (at scale=1), keyed by pageNumber
  const pageSizes = useRef<Record<number, { width: number; height: number }>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const fileUrl = pdfUrl ? `${pdfUrl}&t=${pdfTimestamp}` : null;

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((prev) => {
        const next = Math.min(3, Math.max(0.5, prev - e.deltaY * 0.005));
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setRenderZoom(next), 250);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePageLoadSuccess = useCallback((page: { pageNumber: number; getViewport: (opts: { scale: number }) => { width: number; height: number } }) => {
    const vp = page.getViewport({ scale: 1 });
    pageSizes.current[page.pageNumber] = { width: vp.width, height: vp.height };
  }, []);

  const handlePageDoubleClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>, pageNumber: number) => {
      if (!currentProjectId) return;
      const natural = pageSizes.current[pageNumber];
      if (!natural) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPx = e.clientX - rect.left;
      const yPx = e.clientY - rect.top;
      const renderScale = rect.width / natural.width;
      // PDF convention: origin bottom-left, Y increases upward
      const xPt = xPx / renderScale;
      const yPt = natural.height - yPx / renderScale;
      try {
        // Extract clicked word from the PDF text layer for word-level fallback
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const clickedWord = el?.closest?.(".react-pdf__Page__textContent span")?.textContent?.trim() ?? null;

        const { line, column } = await synctexLookup(currentProjectId, pageNumber, xPt, yPt);
        window.dispatchEvent(new CustomEvent("reveal-comment-line", { detail: { line, column, word: clickedWord } }));
      } catch {
        // No source mapping for this position — ignore silently
      }
    },
    [currentProjectId],
  );

  const zoomBy = useCallback((delta: number) => {
    const next = +(Math.min(3, Math.max(0.5, zoom + delta)).toFixed(2));
    setZoom(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRenderZoom(next); // immediate re-render for button clicks
  }, [zoom]);

  // CSS scale ratio: visually corrects between zoom and renderZoom during pinch
  const cssScale = zoom / renderZoom;

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
        <div className="flex items-center gap-2">
          {numPages > 0 && (
            <span style={{ color: "var(--ink-4)" }}>
              {numPages} page{numPages !== 1 ? "s" : ""}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              className="btn icon ghost sm"
              onClick={() => zoomBy(-0.25)}
              title="Zoom out"
              style={{ color: "var(--ink-3)" }}
            >
              <ZoomOut size={13} />
            </button>
            <span style={{ color: "var(--ink-3)", minWidth: 36, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="btn icon ghost sm"
              onClick={() => zoomBy(0.25)}
              title="Zoom in"
              style={{ color: "var(--ink-3)" }}
            >
              <ZoomIn size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* PDF Content */}
      <div ref={containerRef} className="flex-1 overflow-auto" style={{ backgroundColor: "#525659" }}>
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
            <p className="text-sm text-center" style={{ color: "var(--ink-3)" }}>
              Click &quot;Compile&quot; to generate PDF
            </p>
          </div>
        )}

        {fileUrl && compilationStatus !== "compiling" && (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            className="flex flex-col items-center py-4 gap-4"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
              <div
                key={pageNumber}
                onDoubleClick={(e) => handlePageDoubleClick(e, pageNumber)}
                style={{
                  cursor: "crosshair",
                  lineHeight: 0,
                  transform: cssScale !== 1 ? `scale(${cssScale})` : undefined,
                  transformOrigin: "top center",
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  onLoadSuccess={handlePageLoadSuccess}
                  width={BASE_WIDTH * renderZoom}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}
