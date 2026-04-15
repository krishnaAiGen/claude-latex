import { getToken } from "@/lib/auth";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function createWebSocket(projectId: string): WebSocket {
  const token = getToken() || "";
  return new WebSocket(
    `${WS_BASE}/ws?token=${encodeURIComponent(token)}&project_id=${encodeURIComponent(projectId)}`
  );
}
