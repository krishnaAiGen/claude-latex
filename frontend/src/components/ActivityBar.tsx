"use client";

import { useState } from "react";
import { Folder, MessageSquare, AlignLeft, GitBranch, Clock, BarChart2, List, BookOpen } from "lucide-react";
import type { AppMode } from "@/lib/types";

type WritingTabId = "files" | "comments" | "outline" | "source" | "history";
type ReviewTabId = "review-agents" | "review-findings" | "review-benchmarks";
export type TabId = WritingTabId | ReviewTabId;

interface Props {
  tab: TabId;
  setTab: (tab: TabId) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  unreadComments: number;
  uncommittedCount: number;
  appMode?: AppMode;
}

const WRITING_TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "files", label: "Files", Icon: Folder },
  { id: "comments", label: "Comments", Icon: MessageSquare },
  { id: "outline", label: "Outline", Icon: AlignLeft },
  { id: "source", label: "Source Control", Icon: GitBranch },
  { id: "history", label: "History", Icon: Clock },
];

const REVIEW_TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "review-agents", label: "Agents", Icon: BarChart2 },
  { id: "review-findings", label: "Findings", Icon: List },
  { id: "review-benchmarks", label: "Benchmarks", Icon: BookOpen },
];

export default function ActivityBar({ tab, setTab, sidebarOpen, setSidebarOpen, unreadComments, uncommittedCount, appMode }: Props) {
  const [hovered, setHovered] = useState<TabId | null>(null);
  const TABS = appMode === "review" ? REVIEW_TABS : WRITING_TABS;
  const accentVar = appMode === "review" ? "var(--accent-3)" : "var(--accent)";

  return (
    <div
      style={{
        width: 44,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        gap: 4,
        background: "var(--bg-2)",
      }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = tab === id && sidebarOpen;
        const badge = appMode === "review" ? 0 :
          id === "comments" && unreadComments > 0 ? unreadComments :
          id === "source" && uncommittedCount > 0 ? uncommittedCount : 0;
        return (
          <button
            key={id}
            title={label}
            onClick={() => {
              if (sidebarOpen && tab === id) {
                setSidebarOpen(false);
              } else {
                setTab(id);
                setSidebarOpen(true);
              }
            }}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: "relative",
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              background: isActive
                ? `color-mix(in oklab, ${accentVar} 12%, transparent)`
                : hovered === id
                ? "color-mix(in oklab, var(--ink) 6%, transparent)"
                : "transparent",
              color: isActive ? accentVar : "var(--ink-3)",
              transition: "background .12s, color .12s",
            }}
          >
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  left: -5,
                  top: 6,
                  bottom: 6,
                  width: 2.5,
                  background: accentVar,
                  borderRadius: 2,
                }}
              />
            )}
            <Icon size={16} />
            {badge > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  minWidth: 14,
                  height: 14,
                  padding: "0 4px",
                  borderRadius: 7,
                  background: "var(--accent)",
                  color: "white",
                  fontSize: 9,
                  fontWeight: 700,
                  border: "1.5px solid var(--bg-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
