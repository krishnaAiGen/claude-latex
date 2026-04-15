"use client";

import { useEffect, useRef, useCallback } from "react";
import { readFile, writeFile } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";
import { getToken } from "@/lib/auth";

export function useDocument() {
  const saveTimeout = useRef<NodeJS.Timeout>(undefined);
  const { setLatexContent, setSavedContent, activeFilePath, currentProjectId } = useEditorStore();

  // Load active file on mount — only when authenticated and project selected
  useEffect(() => {
    const token = getToken();
    if (!token || !currentProjectId) return;

    readFile(currentProjectId, activeFilePath)
      .then((content) => {
        setLatexContent(content);
        setSavedContent(content);
      })
      .catch(() => {
        setLatexContent("");
        setSavedContent("");
      });
  }, [setLatexContent, setSavedContent, activeFilePath, currentProjectId]);

  // Debounced auto-save to the active file
  const debouncedSave = useCallback(
    (content: string) => {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        const { activeFilePath, currentProjectId } = useEditorStore.getState();
        if (!currentProjectId) return;
        writeFile(currentProjectId, activeFilePath, content)
          .then(() => setSavedContent(content))
          .catch(console.error);
      }, 1000);
    },
    [setSavedContent]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      setLatexContent(content);
      debouncedSave(content);
    },
    [setLatexContent, debouncedSave]
  );

  return { handleContentChange };
}
