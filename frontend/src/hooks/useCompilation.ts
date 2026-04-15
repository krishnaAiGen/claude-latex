"use client";

import { useCallback, useRef } from "react";
import { compileDocument, getPdfUrl } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";

export function useCompilation() {
  const {
    latexContent,
    currentProjectId,
    setCompilationStatus,
    setCompilationErrors,
    setPdfUrl,
    refreshPdf,
  } = useEditorStore();

  const abortRef = useRef<AbortController | null>(null);

  const compile = useCallback(async () => {
    if (!currentProjectId) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setCompilationStatus("compiling");
    setCompilationErrors([]);

    try {
      const result = await compileDocument(currentProjectId, latexContent);

      if (abortRef.current?.signal.aborted) return;

      if (result.success) {
        setCompilationStatus("success");
        setPdfUrl(getPdfUrl(currentProjectId));
        refreshPdf();
      } else {
        setCompilationStatus("error");
        setCompilationErrors(result.errors || []);
      }
    } catch {
      if (abortRef.current?.signal.aborted) return;
      setCompilationStatus("error");
      setCompilationErrors([
        { line: null, message: "Failed to connect to server", file: null },
      ]);
    }
  }, [
    latexContent,
    currentProjectId,
    setCompilationStatus,
    setCompilationErrors,
    setPdfUrl,
    refreshPdf,
  ]);

  const stopCompile = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setCompilationStatus("idle");
  }, [setCompilationStatus]);

  return { compile, stopCompile };
}
