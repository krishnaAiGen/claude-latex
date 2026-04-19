"use client";

import { useCallback, useRef, useEffect } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import { useEditorStore } from "@/store/editorStore";
import { useDocument } from "@/hooks/useDocument";
import { readFile } from "@/lib/api";
import ReviewBanner from "./ReviewBanner";
import type { editor } from "monaco-editor";

export default function EditorPanel() {
  const {
    latexContent,
    editorReadOnly,
    isAgentProcessing,
    theme,
    activeFilePath,
    currentProjectId,
    reviewMode,
    originalLatex,
    pendingLatex,
  } = useEditorStore();
  const { handleContentChange } = useDocument();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const prevFileRef = useRef(activeFilePath);

  // Load file content when active file changes
  useEffect(() => {
    if (!currentProjectId) return;
    if (activeFilePath !== prevFileRef.current) {
      prevFileRef.current = activeFilePath;
      readFile(currentProjectId, activeFilePath)
        .then((content) => {
          useEditorStore.getState().setLatexContent(content);
          useEditorStore.getState().setSavedContent(content);
        })
        .catch(console.error);
    }
  }, [activeFilePath, currentProjectId]);

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;

    // Track selection changes
    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel();
      if (!model) return;

      const selection = e.selection;
      const selectedText = model.getValueInRange(selection);

      if (selectedText) {
        useEditorStore.getState().setSelectedText(selectedText, {
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber,
        });
      } else {
        useEditorStore.getState().setSelectedText(null, null);
      }
    });

    // Add "Ask AI" context menu action
    editor.addAction({
      id: "ask-ai",
      label: "Ask AI About Selection",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 0,
      run: () => {
        const selection = editor.getSelection();
        if (!selection) return;
        const model = editor.getModel();
        if (!model) return;
        const text = model.getValueInRange(selection);
        if (text) {
          useEditorStore.getState().setSelectedText(text, {
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
          });
          window.dispatchEvent(
            new CustomEvent("focus-chat", { detail: { text } })
          );
        }
      },
    });
  }, []);

  // Track edits to pendingLatex in review mode (user can edit the right side)
  const handleDiffEditorMount = useCallback(
    (diffEditor: editor.IStandaloneDiffEditor) => {
      const modifiedEditor = diffEditor.getModifiedEditor();
      modifiedEditor.onDidChangeModelContent(() => {
        const newContent = modifiedEditor.getValue();
        useEditorStore.setState({ pendingLatex: newContent });
      });
    },
    []
  );

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-1 text-xs border-b"
        style={{
          backgroundColor: "var(--bg-3)",
          borderColor: "var(--rule)",
          color: "var(--ink-3)",
        }}
      >
        <span>{activeFilePath}</span>
        {isAgentProcessing && (
          <span className="animate-pulse-subtle" style={{ color: "var(--warn)" }}>
            AI editing...
          </span>
        )}
        {reviewMode && (
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
            Review Mode
          </span>
        )}
      </div>

      {/* Review banner with Accept/Reject */}
      <ReviewBanner />

      <div className="flex-1">
        {reviewMode && originalLatex !== null && pendingLatex !== null ? (
          <DiffEditor
            height="100%"
            language="latex"
            theme={theme === "dark" ? "vs-dark" : "vs"}
            original={originalLatex}
            modified={pendingLatex}
            onMount={handleDiffEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderSideBySide: false,  // inline diff (red/green)
              originalEditable: false,
              readOnly: false,  // modified side is editable
              renderIndicators: true,
              renderOverviewRuler: true,
            }}
          />
        ) : (
          <Editor
            height="100%"
            defaultLanguage="latex"
            theme={theme === "dark" ? "vs-dark" : "vs"}
            value={latexContent}
            onChange={(value) => handleContentChange(value || "")}
            onMount={handleEditorMount}
            options={{
              readOnly: editorReadOnly,
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: "on",
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              renderWhitespace: "selection",
            }}
          />
        )}
      </div>
    </div>
  );
}
