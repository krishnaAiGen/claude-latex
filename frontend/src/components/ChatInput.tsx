"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Code, Square } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
}

export default function ChatInput({ onSend, onStop }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { selectedText, selectionRange, isAgentProcessing, setSelectedText } =
    useEditorStore();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  }, [input]);

  // Listen for "focus-chat" events from editor
  useEffect(() => {
    const handler = () => {
      textareaRef.current?.focus();
    };
    window.addEventListener("focus-chat", handler);
    return () => window.removeEventListener("focus-chat", handler);
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isAgentProcessing) return;
    onSend(trimmed);
    setInput("");
  }, [input, isAgentProcessing, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div
      className="border-t p-3"
      style={{
        backgroundColor: "var(--bg-2)",
        borderColor: "var(--rule)",
      }}
    >
      {/* Show selected text indicator */}
      {selectedText && (
        <div
          className="flex items-center justify-between mb-2 p-2 rounded text-xs border"
          style={{
            backgroundColor: "var(--bg-3)",
            borderColor: "var(--accent)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <Code size={12} style={{ color: "var(--accent)" }} />
            <span style={{ color: "var(--accent)" }}>
              Selection attached (lines {selectionRange?.startLine}-
              {selectionRange?.endLine})
            </span>
          </div>
          <button
            onClick={() => setSelectedText(null, null)}
            className="hover:opacity-80"
          >
            <X size={12} style={{ color: "var(--ink-3)" }} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isAgentProcessing
              ? "AI is processing..."
              : "Ask AI to modify your LaTeX..."
          }
          disabled={isAgentProcessing}
          rows={1}
          className="textarea flex-1 resize-none text-sm disabled:opacity-50"
          style={{ fontSize: 13, minHeight: 36, padding: "8px 12px" }}
        />
        {isAgentProcessing && onStop ? (
          <button
            onClick={onStop}
            className="btn icon sm animate-fadeIn"
            style={{ background: "var(--err)", borderColor: "var(--err)", color: "white" }}
            title="Stop generating"
          >
            <Square size={14} fill="white" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || isAgentProcessing}
            className="btn accent icon sm"
            title="Send (Enter)"
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
