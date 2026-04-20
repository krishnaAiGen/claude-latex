"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Download, Sun, Moon, PanelLeft, LogOut, LayoutDashboard, Loader2, ChevronDown, Sparkles, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import { useCompilation } from "@/hooks/useCompilation";
import { getPdfUrl } from "@/lib/api";
import { AVAILABLE_MODELS } from "@/lib/types";
import DraftStatusChip from "@/components/DraftStatusChip";
import PresenceStack from "@/components/PresenceStack";
import PushModal from "@/components/PushModal";
import ShareModal from "@/components/ShareModal";

const TIER_COLORS: Record<string, string> = {
  Best: "var(--ok)",
  Medium: "var(--accent)",
  Lowest: "var(--warn)",
};

export default function Toolbar() {
  const {
    compilationStatus, isDirty, wsConnected, theme, toggleTheme,
    toggleSidebar, sidebarOpen, user, logout, currentProjectId, currentProjectName,
    selectedModel, setSelectedModel, isAgentProcessing,
    myRole, showPushModal, setShowPushModal, showShareModal, setShowShareModal,
  } = useEditorStore();
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const router = useRouter();
  const { compile, stopCompile } = useCompilation();
  const isCompiling = compilationStatus === "compiling";
  const isActive = isCompiling || isAgentProcessing;

  // Apply theme on mount and toggle
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme === "dark" ? "dark" : ""
    );
  }, [theme]);

  return (
    <>
    <div
      className="flex items-center justify-between px-3 py-2 border-b relative"
      style={{ backgroundColor: "var(--bg-2)", borderColor: "var(--rule)" }}
    >
      {/* Prism bar during active work */}
      {isActive && (
        <div className="prism-bar absolute bottom-0 left-0 right-0" style={{ borderRadius: 0 }} />
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/dashboard")}
          className="btn ghost icon"
          title="Back to projects"
        >
          <LayoutDashboard size={16} />
        </button>
        <button
          onClick={toggleSidebar}
          className="btn icon"
          style={{
            background: sidebarOpen ? "var(--accent)" : undefined,
            color: sidebarOpen ? "white" : undefined,
            borderColor: sidebarOpen ? "var(--accent)" : undefined,
          }}
          title="Toggle file sidebar"
        >
          <PanelLeft size={16} />
        </button>

        <div className="w-px h-4 mx-1" style={{ background: "var(--rule)" }} />

        {/* Brand mark */}
        <div className="mark">
          <div className="mark-glyph" style={{ width: 22, height: 22, borderRadius: 6, fontSize: 15 }}>
            <span>C</span>
          </div>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--ink-2)" }}>
            ai<em style={{ fontStyle: "italic", color: "var(--ink-3)" }}>·latex</em>
          </span>
        </div>

        {isDirty && (
          <span className="chip" style={{ color: "var(--warn)", borderColor: "color-mix(in oklab, var(--warn) 30%, var(--rule))" }}>
            unsaved
          </span>
        )}

        {currentProjectId && (
          <DraftStatusChip
            onPush={() => setShowPushModal(true)}
            onPull={() => {}}
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div className="chip" style={{ gap: 6 }}>
          <span
            style={{
              width: 6, height: 6, borderRadius: "50%", display: "inline-block",
              background: wsConnected ? "var(--ok)" : "var(--err)",
              boxShadow: wsConnected ? "0 0 0 2px color-mix(in oklab, var(--ok) 25%, transparent)" : undefined,
            }}
          />
          <span>{wsConnected ? "Connected" : "Disconnected"}</span>
        </div>

        {/* Model selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="btn sm"
            style={{ gap: 6 }}
          >
            <Sparkles size={13} style={{ color: "var(--accent)" }} />
            {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || "Select Model"}
            <ChevronDown size={12} style={{ color: "var(--ink-3)" }} />
          </button>

          {modelDropdownOpen && (
            <div
              className="card absolute right-0 top-full mt-1 w-72 z-50 animate-fadeIn overflow-hidden"
              style={{ padding: 0 }}
            >
              {(["Best", "Medium", "Lowest"] as const).map(tier => (
                <div key={tier}>
                  <div
                    className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: TIER_COLORS[tier], background: "var(--bg-2)", fontFamily: "var(--font-mono)" }}
                  >
                    {tier}
                  </div>
                  {AVAILABLE_MODELS.filter(m => m.tier === tier).map(model => (
                    <button
                      key={model.id}
                      onClick={() => { setSelectedModel(model.id); setModelDropdownOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                      style={{
                        background: selectedModel === model.id ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "transparent",
                        color: "var(--ink)",
                        borderLeft: selectedModel === model.id ? "2px solid var(--accent)" : "2px solid transparent",
                      }}
                      onMouseEnter={e => {
                        if (selectedModel !== model.id) e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 5%, transparent)";
                      }}
                      onMouseLeave={e => {
                        if (selectedModel !== model.id) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span
                        style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: TIER_COLORS[model.tier],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{model.name}</span>
                        <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                          {model.inputPrice} / {model.outputPrice}
                        </span>
                      </span>
                      {selectedModel === model.id && (
                        <Check size={13} style={{ color: "var(--accent)", marginLeft: "auto" }} />
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Presence avatars + Invite */}
        <PresenceStack onInvite={() => setShowShareModal(true)} />

        <div className="w-px h-4" style={{ background: "var(--rule)" }} />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn ghost icon"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun size={15} style={{ color: "var(--warn)" }} />
          ) : (
            <Moon size={15} style={{ color: "var(--ink-3)" }} />
          )}
        </button>

        {/* Compile / Stop */}
        {isCompiling ? (
          <button onClick={stopCompile} className="btn sm" style={{ background: "var(--err)", color: "white", borderColor: "var(--err)" }}>
            <Loader2 size={13} className="animate-spin" />
            Stop
          </button>
        ) : (
          <button onClick={compile} className="btn accent sm">
            <Play size={13} />
            Compile
          </button>
        )}

        <a
          href={currentProjectId ? getPdfUrl(currentProjectId) : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn ghost sm"
        >
          <Download size={13} />
          PDF
        </a>

        {/* User info + logout */}
        {user && (
          <>
            <span className="text-xs" style={{ color: "var(--ink-3)", fontFamily: "var(--font-mono)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </span>
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="btn ghost icon"
              title="Sign out"
            >
              <LogOut size={14} style={{ color: "var(--ink-3)" }} />
            </button>
          </>
        )}
      </div>
    </div>

    {/* Modals */}
    {showPushModal && currentProjectId && (
      <PushModal
        projectId={currentProjectId}
        onClose={() => setShowPushModal(false)}
        onPushed={() => setShowPushModal(false)}
      />
    )}
    {showShareModal && currentProjectId && (
      <ShareModal
        projectId={currentProjectId}
        projectName={currentProjectName || "this project"}
        onClose={() => setShowShareModal(false)}
      />
    )}
  </>
  );
}
