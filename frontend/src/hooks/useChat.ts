"use client";

import { useCallback, useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useWebSocket } from "./useWebSocket";
import { fetchChatMessages, saveChatMessage } from "@/lib/api";
import type { ChatMessageData } from "@/lib/types";

export function useChat() {
  const {
    selectedText,
    selectionRange,
    addMessage,
    setMessages,
    setAgentProcessing,
    clearStreamingContent,
    token,
    currentProjectId,
  } = useEditorStore();

  const { sendMessage: wsSend, stopStream } = useWebSocket();

  // Load persisted chat history on mount
  useEffect(() => {
    if (!token || !currentProjectId) return;

    fetchChatMessages(currentProjectId)
      .then((data) => {
        const msgs: ChatMessageData[] = data.messages.map((m: { id: string; role: "user" | "assistant"; content: string; created_at: string; context?: object }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          context: m.context || undefined,
        }));
        setMessages(msgs);
      })
      .catch(console.error);
  }, [token, currentProjectId, setMessages]);

  const sendMessage = useCallback(
    (
      content: string,
      overrideContext?: {
        selected_text?: string;
        selection_range?: { start_line: number; end_line: number };
        comment_line?: number;
        comment_text?: string;
      },
    ) => {
      const resolvedSelectedText = overrideContext?.selected_text ?? selectedText ?? null;
      const resolvedRange = overrideContext?.selection_range
        ?? (selectionRange ? { start_line: selectionRange.startLine, end_line: selectionRange.endLine } : null);

      const context = resolvedSelectedText
        ? { selected_text: resolvedSelectedText, selection_range: resolvedRange ?? { start_line: 0, end_line: 0 } }
        : undefined;

      // Add user message to store
      const userMsg: ChatMessageData = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date(),
        context,
      };

      addMessage(userMsg);
      setAgentProcessing(true);
      clearStreamingContent();

      // Persist to DB
      const pid = useEditorStore.getState().currentProjectId;
      if (pid) saveChatMessage(pid, "user", content, context).catch(console.error);

      // Send via WebSocket
      wsSend(content, {
        selected_text: context?.selected_text || undefined,
        selection_range: context?.selection_range ?? undefined,
        comment_line: overrideContext?.comment_line,
        comment_text: overrideContext?.comment_text,
      });
    },
    [
      selectedText,
      selectionRange,
      addMessage,
      setAgentProcessing,
      clearStreamingContent,
      wsSend,
    ]
  );

  return { sendMessage, stopStream };
}
