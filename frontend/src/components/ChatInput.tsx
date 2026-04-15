"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, X, Code } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";

interface ChatInputProps {
  onSend: (content: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
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
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      {/* Show selected text indicator */}
      {selectedText && (
        <div
          className="flex items-center justify-between mb-2 p-2 rounded text-xs border"
          style={{
            backgroundColor: "var(--bg-tertiary)",
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
            <X size={12} style={{ color: "var(--text-secondary)" }} />
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
          className="flex-1 resize-none rounded px-3 py-2 text-sm outline-none border disabled:opacity-50"
          style={{
            backgroundColor: "var(--bg-primary)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isAgentProcessing}
          className="p-2 rounded transition-colors disabled:opacity-30"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <Send size={16} color="white" />
        </button>
      </div>
    </div>
  );
}
