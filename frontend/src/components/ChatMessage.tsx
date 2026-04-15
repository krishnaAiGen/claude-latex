"use client";

import ReactMarkdown from "react-markdown";
import { User, Bot, Code } from "lucide-react";
import type { ChatMessageData } from "@/lib/types";

interface ChatMessageProps {
  message: ChatMessageData;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className="px-4 py-3 border-b animate-fadeIn"
      style={{
        backgroundColor: isUser ? "var(--bg-primary)" : "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            backgroundColor: isUser ? "var(--accent)" : "var(--success)",
          }}
        >
          {isUser ? (
            <User size={14} color="white" />
          ) : (
            <Bot size={14} color="white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Show selection context for user messages */}
          {isUser && message.context?.selected_text && (
            <div
              className="mb-2 p-2 rounded text-xs font-mono border"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
              }}
            >
              <div
                className="flex items-center gap-1 mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                <Code size={10} />
                <span>
                  Selected (lines{" "}
                  {message.context.selection_range.start_line}-
                  {message.context.selection_range.end_line})
                </span>
              </div>
              <pre className="whitespace-pre-wrap overflow-x-auto">
                {message.context.selected_text.slice(0, 300)}
                {message.context.selected_text.length > 300 ? "..." : ""}
              </pre>
            </div>
          )}

          <div className="text-sm prose prose-invert max-w-none prose-pre:bg-[var(--bg-tertiary)] prose-pre:border prose-pre:border-[var(--border)]">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>

          <div
            className="mt-1 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
