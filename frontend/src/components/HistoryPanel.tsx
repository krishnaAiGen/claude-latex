"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { getVersionHistory, restoreVersion } from "@/lib/api";
import type { DocumentVersion } from "@/lib/types";

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

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  projectId: string;
}

export default function HistoryPanel({ projectId }: Props) {
  const { myRole } = useEditorStore();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    getVersionHistory(projectId)
      .then((data) => setVersions(data.versions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleRestore = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Restore to v${versionNumber}? This will become the new main.`)) return;
    setRestoring(versionId);
    try {
      await restoreVersion(projectId, versionId);
    } catch (e) {
      console.error(e);
    } finally {
      setRestoring(null);
    }
  };

  const canRestore = myRole === "owner";

  return (
    <>
      {/* Header */}
      <div style={{ padding: "12px 12px 8px" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Activity
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
          version history
        </div>
      </div>

      {/* Event list */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "4px 12px 12px",
          borderTop: "1px solid var(--rule)",
        }}
      >
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        )}

        {!loading && versions.length === 0 && (
          <div style={{ padding: "28px 12px", textAlign: "center", color: "var(--ink-4)", fontSize: 12 }}>
            No versions pushed yet.
          </div>
        )}

        {versions.map((v, i) => {
          const name = v.pushed_by?.name || "Unknown";
          const color = nameToColor(name);
          const initials = name.slice(0, 2).toUpperCase();
          return (
            <div
              key={v.id}
              style={{
                display: "flex",
                gap: 8,
                padding: "9px 0",
                borderBottom: i < versions.length - 1 ? "1px dashed var(--rule)" : "none",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: color,
                  color: "white",
                  fontWeight: 700,
                  fontSize: 9,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{name}</span>
                  {" "}pushed to main
                </div>
                {v.ai_summary && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--ink-3)",
                      marginTop: 2,
                      lineHeight: 1.4,
                      fontStyle: "italic",
                    }}
                  >
                    {v.ai_summary}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 3,
                    fontSize: 10,
                    color: "var(--ink-4)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>{timeAgo(v.created_at)} ago · v{v.version_number}</span>
                  {v.diff_stats && (
                    <>
                      <span style={{ color: "var(--ok)" }}>+{v.diff_stats.lines_added}</span>
                      <span style={{ color: "var(--err)" }}>−{v.diff_stats.lines_removed}</span>
                    </>
                  )}
                </div>
              </div>
              {canRestore && (
                <button
                  onClick={() => handleRestore(v.id, v.version_number)}
                  disabled={restoring === v.id}
                  className="btn ghost sm"
                  style={{ flexShrink: 0, padding: "3px 8px" }}
                  title="Restore this version"
                >
                  {restoring === v.id ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <RotateCcw size={11} />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
