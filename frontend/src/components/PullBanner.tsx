"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { getDraft, saveDraft, getVersionHistory } from "@/lib/api";
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

function PullModal({
  projectId,
  onClose,
  onPulled,
}: {
  projectId: string;
  onClose: () => void;
  onPulled: () => void;
}) {
  const { setMainAhead, setLatexContent, setSavedContent, setDraftInfo } = useEditorStore();
  const [pulling, setPulling] = useState(false);
  const [done, setDone] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load recent versions on mount
  useEffect(() => {
    getVersionHistory(projectId)
      .then((data) => {
        setVersions(data.versions.slice(0, 5));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [projectId]);

  const handlePull = async () => {
    setPulling(true);
    try {
      await saveDraft(projectId, useEditorStore.getState().latexContent);
      const updated = await getDraft(projectId);
      setLatexContent(updated.content);
      setSavedContent(updated.content);
      setDraftInfo(updated.forked_from_version, updated.main_version, false);
      setMainAhead(false);
      setDone(true);
      setTimeout(() => {
        onPulled();
        onClose();
      }, 1100);
    } catch (e) {
      console.error("Pull failed", e);
      setPulling(false);
    }
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "color-mix(in oklab, var(--ink) 50%, transparent)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "min(560px, 100%)",
          padding: 0,
          overflow: "hidden",
          animation: "rise .28s var(--spring)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid var(--rule)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>
              Pull latest from main
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                fontFamily: "var(--font-mono)",
                marginTop: 2,
              }}
            >
              origin/main · {versions.length} recent version{versions.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button className="btn icon ghost" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Version list */}
        <div style={{ padding: "10px 14px 14px" }}>
          {!loaded && (
            <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>
              Loading…
            </div>
          )}
          {loaded && versions.length === 0 && (
            <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>
              No version history available.
            </div>
          )}
          {versions.map((v) => {
            const name = v.pushed_by?.name || "Unknown";
            const color = nameToColor(name);
            const initials = name.slice(0, 2).toUpperCase();
            return (
              <div
                key={v.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 4px",
                  borderBottom: "1px dashed var(--rule)",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: color,
                    color: "white",
                    fontWeight: 700,
                    fontSize: 10,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>
                    {v.ai_summary || `Version ${v.version_number}`}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--ink-3)",
                      fontFamily: "var(--font-mono)",
                      marginTop: 2,
                    }}
                  >
                    <span style={{ color: "var(--ink-2)" }}>{name}</span>
                    {" · "}{timeAgo(v.created_at)} ago
                    {" · v"}{v.version_number}
                    {v.diff_stats && (
                      <>
                        {" · "}
                        <span style={{ color: "var(--ok)" }}>+{v.diff_stats.lines_added}</span>
                        {" "}
                        <span style={{ color: "var(--err)" }}>−{v.diff_stats.lines_removed}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 18px",
            borderTop: "1px solid var(--rule)",
            background: "var(--bg-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            {done ? "✓ pulled · fast-forward" : pulling ? "pulling…" : "fast-forward, no conflicts expected"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn accent"
              onClick={handlePull}
              disabled={pulling || done}
            >
              {done ? (
                <><Check size={13} /> Pulled</>
              ) : pulling ? (
                <><span className="td" /><span className="td" /><span className="td" /></>
              ) : (
                "Pull"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PullBanner({ projectId }: Props) {
  const { mainAhead, setMainAhead } = useEditorStore();
  const [modalOpen, setModalOpen] = useState(false);

  if (!mainAhead) return null;

  return (
    <>
      <div
        style={{
          padding: "7px 16px",
          borderBottom: "1px solid var(--rule)",
          background: "color-mix(in oklab, var(--accent) 6%, var(--bg-2))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          fontFamily: "var(--font-ui)",
        }}
      >
        <span style={{ color: "var(--ink-2)" }}>
          ↓ Main was updated by another collaborator
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="btn accent sm" onClick={() => setModalOpen(true)}>
            Pull latest
          </button>
          <button className="btn ghost sm" onClick={() => setMainAhead(false)}>
            <X size={12} />
          </button>
        </div>
      </div>

      {modalOpen && (
        <PullModal
          projectId={projectId}
          onClose={() => setModalOpen(false)}
          onPulled={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
