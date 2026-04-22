"use client";

import { useCallback, useRef, useEffect } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import { useEditorStore } from "@/store/editorStore";
import { useDocument } from "@/hooks/useDocument";
import { readFile } from "@/lib/api";
import ReviewBanner from "./ReviewBanner";
import SelectionToolbar from "./SelectionToolbar";
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
    comments,
  } = useEditorStore();
  const { handleContentChange } = useDocument();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const prevFileRef = useRef(activeFilePath);
  const selectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Scroll + flash Monaco when a comment card is clicked
  useEffect(() => {
    const handler = (e: Event) => {
      const { line, column, word } = (e as CustomEvent).detail as { line: number; column?: number | null; word?: string | null };
      const ed = editorRef.current;
      const mo = monacoRef.current;
      if (!ed || !mo) return;
      const model = ed.getModel();
      if (!model) return;

      // Resolve column: use synctex column if valid, else search for word in source line
      let col: number | null = (column != null && column > 0) ? column : null;
      if (col == null && word) {
        const lineText = model.getLineContent(line);
        const idx = lineText.indexOf(word);
        if (idx !== -1) col = idx + 1; // Monaco columns are 1-based
      }

      if (col != null) {
        ed.setPosition({ lineNumber: line, column: col });
        ed.revealPositionInCenter({ lineNumber: line, column: col });
      } else {
        ed.revealLineInCenter(line);
      }

      const temp = ed.createDecorationsCollection([{
        range: new mo.Range(line, 1, line, model.getLineMaxColumn(line)),
        options: { className: "comment-highlight-active" },
      }]);
      setTimeout(() => temp.clear(), 1200);
    };

    window.addEventListener("reveal-comment-line", handler);
    return () => window.removeEventListener("reveal-comment-line", handler);
  }, []);

  // Apply Monaco comment decorations whenever comments change
  useEffect(() => {
    const editorInstance = editorRef.current;
    const monacoInstance = monacoRef.current;
    if (!editorInstance || !monacoInstance) return;
    const model = editorInstance.getModel();
    if (!model) return;

    const decorations = comments
      .filter((c) => !c.resolved && c.lineNumber != null)
      .map((c) => ({
        range: new monacoInstance.Range(
          c.lineNumber!,
          1,
          c.lineNumber!,
          model.getLineMaxColumn(c.lineNumber!)
        ),
        options: { inlineClassName: "comment-highlight" },
      }));

    if (!decorationsRef.current) {
      decorationsRef.current = editorInstance.createDecorationsCollection(decorations);
    } else {
      decorationsRef.current.set(decorations);
    }
  }, [comments]);

  const handleEditorMount: OnMount = useCallback((editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;

    // Track selection — debounced so dragging never re-renders EditorPanel
    editorInstance.onDidChangeCursorSelection((e) => {
      const model = editorInstance.getModel();
      if (!model) return;

      const selection = e.selection;
      const text = model.getValueInRange(selection);

      if (selectionDebounceRef.current) clearTimeout(selectionDebounceRef.current);

      if (!text) {
        useEditorStore.getState().setSelectedText(null, null);
        return;
      }

      selectionDebounceRef.current = setTimeout(() => {
        useEditorStore.getState().setSelectedText(text, {
          startLine: selection.startLineNumber,
          endLine: selection.endLineNumber,
        });
      }, 120);
    });

    // Add "Ask AI" context menu action
    editorInstance.addAction({
      id: "ask-ai",
      label: "Ask AI About Selection",
      contextMenuGroupId: "navigation",
      contextMenuOrder: 0,
      run: () => {
        const sel = editorInstance.getSelection();
        if (!sel) return;
        const model = editorInstance.getModel();
        if (!model) return;
        const text = model.getValueInRange(sel);
        if (text) {
          useEditorStore.getState().setSelectedText(text, {
            startLine: sel.startLineNumber,
            endLine: sel.endLineNumber,
          });
          window.dispatchEvent(new CustomEvent("focus-chat", { detail: { text } }));
        }
      },
    });
  }, []);

  // Track edits to pendingLatex in review mode
  const handleDiffEditorMount = useCallback(
    (diffEditor: editor.IStandaloneDiffEditor) => {
      const modifiedEditor = diffEditor.getModifiedEditor();
      modifiedEditor.onDidChangeModelContent(() => {
        useEditorStore.setState({ pendingLatex: modifiedEditor.getValue() });
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

      <ReviewBanner />

      <div className="flex-1 overflow-hidden">
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
              renderSideBySide: false,
              originalEditable: false,
              readOnly: false,
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

      {/* Selection toolbar lives in its own component with its own store subscription
          so EditorPanel never re-renders when selectedText changes */}
      {!reviewMode && <SelectionToolbar />}
    </div>
  );
}
