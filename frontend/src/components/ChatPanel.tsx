"use client";

import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { useChat } from "@/hooks/useChat";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

export default function ChatPanel() {
  const { messages, isAgentProcessing, streamingContent } = useEditorStore();
  const { sendMessage, stopStream } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1 text-xs border-b"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          borderColor: "var(--border)",
          color: "var(--text-secondary)",
        }}
      >
        <Bot size={14} style={{ color: "var(--success)" }} />
        <span>Claude AI Assistant</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isAgentProcessing && (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center max-w-xs">
              <Bot
                size={40}
                className="mx-auto mb-3"
                style={{ color: "var(--text-secondary)" }}
              />
              <p
                className="text-sm mb-2"
                style={{ color: "var(--text-primary)" }}
              >
                AI LaTeX Assistant
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                Type instructions like &quot;add a table of contents&quot; or
                select code in the editor and ask to modify it.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Streaming response */}
        {isAgentProcessing && streamingContent && (
          <div
            className="px-4 py-3 border-b"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--success)" }}
              >
                <Bot size={14} color="white" />
              </div>
              <p className="text-sm whitespace-pre-wrap flex-1">{streamingContent}</p>
            </div>
          </div>
        )}

        {/* Processing indicator with animated dots */}
        {isAgentProcessing && !streamingContent && (
          <div
            className="px-4 py-3 flex items-center gap-3 animate-fadeIn"
            style={{ color: "var(--text-secondary)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
            <span className="text-xs">AI is thinking</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input with stop button */}
      <ChatInput onSend={sendMessage} onStop={stopStream} />
    </div>
  );
}
