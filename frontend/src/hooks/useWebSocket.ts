"use client";

import { useEffect, useRef, useCallback } from "react";
import { createWebSocket } from "@/lib/ws";
import { useEditorStore } from "@/store/editorStore";
import { saveChatMessage, getPdfUrl } from "@/lib/api";
import type { WSMessage, ChatMessageData } from "@/lib/types";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout>(undefined);
  const reconnectDelay = useRef(1000);

  const {
    setWsConnected,
    addMessage,
    setAgentProcessing,
    appendStreamingContent,
    clearStreamingContent,
    startReview,
    setCompilationStatus,
  } = useEditorStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const projectId = useEditorStore.getState().currentProjectId;
    if (!projectId) return;

    const ws = createWebSocket(projectId);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onclose = () => {
      setWsConnected(false);
      reconnectTimeout.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      const data: WSMessage = JSON.parse(event.data);

      switch (data.type) {
        case "agent_thinking":
          setAgentProcessing(true);
          break;

        case "agent_message_delta":
          appendStreamingContent(data.content);
          break;

        case "agent_response": {
          clearStreamingContent();
          const assistantMsg: ChatMessageData = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.message,
            timestamp: new Date(),
          };
          addMessage(assistantMsg);

          // Persist assistant message to DB
          const pid = useEditorStore.getState().currentProjectId;
          if (pid) saveChatMessage(pid, "assistant", data.message).catch(console.error);

          if (data.latex_content) {
            // Check if content actually changed — if not, skip review mode
            const currentLatex = useEditorStore.getState().latexContent;
            if (data.latex_content !== currentLatex) {
              // Enter review mode instead of auto-applying
              const pid2 = useEditorStore.getState().currentProjectId;
              const fullPdfUrl = data.pdf_url && pid2 ? getPdfUrl(pid2) : null;
              startReview(data.latex_content, fullPdfUrl);
            }
            setAgentProcessing(false);
          } else {
            setAgentProcessing(false);
            setCompilationStatus("idle");
          }
          break;
        }

        case "compile_status":
          setCompilationStatus(
            data.status === "compile_pdf" ? "compiling" : "idle"
          );
          break;

        case "error": {
          clearStreamingContent();
          const errorMsg: ChatMessageData = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Error: ${data.message}`,
            timestamp: new Date(),
          };
          addMessage(errorMsg);
          setAgentProcessing(false);
          break;
        }
      }
    };
  }, [
    setWsConnected,
    addMessage,
    setAgentProcessing,
    appendStreamingContent,
    clearStreamingContent,
    startReview,
    setCompilationStatus,
  ]);

  const sendMessage = useCallback(
    (
      content: string,
      context?: {
        selected_text?: string;
        selection_range?: { start_line: number; end_line: number };
      }
    ) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      const model = useEditorStore.getState().selectedModel;
      wsRef.current.send(
        JSON.stringify({
          type: "chat_message",
          content,
          context: context || {},
          model,
        })
      );
    },
    []
  );

  // Stop the current stream by closing and reconnecting the WebSocket.
  // Since we use streaming with no server-side cancellation handler, closing
  // the connection is the simplest way to abort the in-flight agent run.
  const stopStream = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const store = useEditorStore.getState();

    // Save partial streamed content as a message + persist to DB
    const partial = store.streamingContent;
    if (partial) {
      const msg = partial + "\n\n*(stopped by user)*";
      store.addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: msg,
        timestamp: new Date(),
      });
      const pid = store.currentProjectId;
      if (pid) saveChatMessage(pid, "assistant", msg).catch(console.error);
    }

    store.setAgentProcessing(false);
    store.clearStreamingContent();
    store.setCompilationStatus("idle");
    setTimeout(() => connect(), 300);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { sendMessage, stopStream };
}
