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
    applyAgentResponse,
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
            // Build proper PDF URL with token for iframe access
            const pid = useEditorStore.getState().currentProjectId;
            const fullPdfUrl = data.pdf_url && pid ? getPdfUrl(pid) : null;
            applyAgentResponse(
              data.latex_content,
              data.diff || null,
              fullPdfUrl
            );
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
    applyAgentResponse,
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

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { sendMessage };
}
