"use client";

import { useEffect, useState, useCallback } from "react";
import { Code2, MessageSquare, Sparkles, X, CornerDownRight } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { createComment } from "@/lib/api";

export default function SelectionToolbar() {
  const {
    selectedText,
    selectionRange,
    myRole,
    currentProjectId,
    setSelectedText,
    addComment,
    setLeftTab,
    setSidebarOpen,
  } = useEditorStore();

  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canComment = myRole === "owner" || myRole === "editor" || myRole === "commenter";

  // Reset comment input when selection is cleared
  useEffect(() => {
    if (!selectedText) {
      setShowCommentInput(false);
      setCommentDraft("");
    }
  }, [selectedText]);

  const clearSelection = useCallback(() => {
    setShowCommentInput(false);
    setCommentDraft("");
    setSelectedText(null, null);
  }, [setSelectedText]);

  const handleAskAI = useCallback(() => {
    setShowCommentInput(false);
    window.dispatchEvent(new CustomEvent("focus-chat", { detail: { text: selectedText } }));
  }, [selectedText]);

  const handleSubmitComment = useCallback(async () => {
    if (!commentDraft.trim() || !currentProjectId || !selectionRange) return;
    setSubmitting(true);
    try {
      const comment = await createComment(
        currentProjectId,
        commentDraft.trim(),
        selectionRange.startLine
      );
      addComment(comment);
      setLeftTab("comments");
      setSidebarOpen(true);
      setCommentDraft("");
      setShowCommentInput(false);
      setSelectedText(null, null);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }, [commentDraft, currentProjectId, selectionRange, addComment, setLeftTab, setSidebarOpen, setSelectedText]);

  if (!selectedText) return null;

  return (
    <>
      {/* Selection info bar */}
      <div
        style={{
          padding: "7px 12px",
          borderTop: "1px solid var(--rule)",
          background: "color-mix(in oklab, var(--accent) 8%, var(--bg-2))",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        <Code2 size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <span style={{ color: "var(--ink-3)", flex: 1, fontFamily: "var(--font-mono)" }}>
          Lines {selectionRange?.startLine}–{selectionRange?.endLine}&nbsp;({selectedText.length} chars)
        </span>
        {canComment && (
          <button
            className="btn sm accent"
            style={{ gap: 5 }}
            onClick={() => setShowCommentInput((v) => !v)}
          >
            <MessageSquare size={12} /> Comment
          </button>
        )}
        <button className="btn sm" style={{ gap: 5 }} onClick={handleAskAI}>
          <Sparkles size={12} /> Ask AI
        </button>
        <button className="btn icon ghost sm" onClick={clearSelection}>
          <X size={12} />
        </button>
      </div>

      {/* Inline comment input */}
      {showCommentInput && (
        <div
          style={{
            padding: "6px 12px 9px",
            borderTop: "1px solid var(--rule)",
            background: "var(--bg-2)",
            display: "flex",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <input
            className="input"
            autoFocus
            placeholder="Add a comment… (Enter to submit)"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmitComment();
              }
              if (e.key === "Escape") {
                setShowCommentInput(false);
              }
            }}
            style={{ fontSize: 12, padding: "5px 8px", flex: 1 }}
          />
          <button
            className="btn sm accent"
            disabled={!commentDraft.trim() || submitting}
            onClick={handleSubmitComment}
          >
            <CornerDownRight size={12} />
          </button>
        </div>
      )}
    </>
  );
}
