"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";

const COLORS = [
  "#7C6CF6", "#2BB673", "#E0833F", "#C94F7C",
  "#3A8FD6", "#B06AB3", "#E0A030", "#4CA8A0",
];

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface Props {
  onInvite: () => void;
}

export default function PresenceStack({ onInvite }: Props) {
  const { presence } = useEditorStore();
  const [hoverId, setHoverId] = useState<string | null>(null);

  const shown = presence.slice(0, 4);
  const more = Math.max(0, presence.length - shown.length);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex" }}>
        {shown.map((p, i) => {
          const color = nameToColor(p.name);
          const initials = (p.name || "?").slice(0, 2).toUpperCase();
          const isHovered = hoverId === p.userId;
          return (
            <div
              key={p.userId}
              onMouseEnter={() => setHoverId(p.userId)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                position: "relative",
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: color,
                color: "white",
                fontWeight: 700,
                fontSize: 10,
                display: "grid",
                placeItems: "center",
                marginLeft: i === 0 ? 0 : -8,
                border: "2px solid var(--bg-2)",
                boxShadow: "var(--shadow-1)",
                zIndex: 10 - i,
                transition: "transform .18s var(--spring), margin .18s var(--ease)",
                transform: isHovered ? "translateY(-2px) scale(1.08)" : "none",
                cursor: "default",
              }}
            >
              {initials}
              {p.activity === "ai_thinking" ? (
                <span
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    border: "2px solid var(--bg-2)",
                  }}
                />
              ) : (
                <span
                  style={{
                    position: "absolute",
                    right: -1,
                    bottom: -1,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "var(--ok)",
                    border: "2px solid var(--bg-2)",
                  }}
                />
              )}
              {isHovered && (
                <div
                  className="fadein"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    whiteSpace: "nowrap",
                    zIndex: 50,
                    background: "var(--ink)",
                    color: "var(--bg)",
                    padding: "6px 10px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontFamily: "var(--font-ui)",
                    boxShadow: "var(--shadow-2)",
                    pointerEvents: "none",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div
                    style={{
                      opacity: 0.7,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                    }}
                  >
                    {p.role} · {p.activity === "ai_thinking" ? "using AI" : "active"}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {more > 0 && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--bg)",
              color: "var(--ink-3)",
              fontWeight: 600,
              fontSize: 10,
              display: "grid",
              placeItems: "center",
              marginLeft: -8,
              border: "2px solid var(--bg-2)",
              boxShadow: "var(--shadow-1)",
            }}
          >
            +{more}
          </div>
        )}
      </div>
      <button className="btn sm" onClick={onInvite} style={{ marginLeft: 4 }}>
        <Plus size={14} /> Invite
      </button>
    </div>
  );
}
