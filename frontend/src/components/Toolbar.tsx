"use client";

import { useEffect, useState, useRef } from "react";
import { Play, Square, Download, FileText, Circle, Sun, Moon, PanelLeft, LogOut, LayoutDashboard, Loader2, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import { useCompilation } from "@/hooks/useCompilation";
import { getPdfUrl } from "@/lib/api";
import { AVAILABLE_MODELS } from "@/lib/types";

const TIER_COLORS: Record<string, string> = {
  Best: "var(--success)",
  Medium: "var(--accent)",
  Lowest: "var(--warning)",
};

export default function Toolbar() {
  const { compilationStatus, isDirty, wsConnected, theme, toggleTheme, toggleSidebar, sidebarOpen, user, logout, currentProjectId, selectedModel, setSelectedModel } =
    useEditorStore();
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

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      theme === "light" ? "light" : ""
    );
  }, [theme]);

  return (
    <div
      className="flex items-center justify-between px-4 py-2 border-b"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard")}
          className="p-1.5 rounded transition-colors"
          style={{ backgroundColor: "var(--bg-tertiary)" }}
          title="Back to projects"
        >
          <LayoutDashboard size={16} style={{ color: "var(--text-primary)" }} />
        </button>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded transition-colors"
          style={{
            backgroundColor: sidebarOpen ? "var(--accent)" : "var(--bg-tertiary)",
            color: sidebarOpen ? "white" : "var(--text-primary)",
          }}
          title="Toggle file sidebar"
        >
          <PanelLeft size={16} />
        </button>
        <FileText size={20} style={{ color: "var(--accent)" }} />
        <h1 className="text-sm font-semibold">Claude LaTeX Editor</h1>
        {isDirty && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              color: "var(--warning)",
            }}
          >
            unsaved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div className="flex items-center gap-1.5 mr-4">
          <Circle
            size={8}
            fill={wsConnected ? "var(--success)" : "var(--error)"}
            stroke="none"
          />
          <span
            className="text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {wsConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* Model selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: TIER_COLORS[AVAILABLE_MODELS.find(m => m.id === selectedModel)?.tier || "Medium"] }}
            />
            {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || "Select Model"}
            <ChevronDown size={12} style={{ color: "var(--text-secondary)" }} />
          </button>

          {modelDropdownOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-72 rounded border shadow-lg z-50 animate-fadeIn"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
              }}
            >
              {(["Best", "Medium", "Lowest"] as const).map(tier => (
                <div key={tier}>
                  <div
                    className="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: TIER_COLORS[tier], backgroundColor: "var(--bg-tertiary)" }}
                  >
                    {tier}
                  </div>
                  {AVAILABLE_MODELS.filter(m => m.tier === tier).map(model => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setModelDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs"
                      style={{
                        backgroundColor: selectedModel === model.id ? "var(--accent)" : "transparent",
                        color: selectedModel === model.id ? "white" : "var(--text-primary)",
                      }}
                      onMouseEnter={e => {
                        if (selectedModel !== model.id) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                      }}
                      onMouseLeave={e => {
                        if (selectedModel !== model.id) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <span>{model.name}</span>
                      <span style={{ color: selectedModel === model.id ? "rgba(255,255,255,0.7)" : "var(--text-secondary)" }}>
                        {model.inputPrice}/{model.outputPrice} per 1M
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded transition-colors"
          style={{ backgroundColor: "var(--bg-tertiary)" }}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun size={16} style={{ color: "var(--warning)" }} />
          ) : (
            <Moon size={16} style={{ color: "var(--text-primary)" }} />
          )}
        </button>

        {/* Compile / Stop button */}
        {isCompiling ? (
          <button
            onClick={stopCompile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
            style={{
              backgroundColor: "var(--error)",
              color: "white",
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            Stop
          </button>
        ) : (
          <button
            onClick={compile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
            style={{
              backgroundColor: "var(--accent)",
              color: "white",
            }}
          >
            <Play size={14} />
            Compile
          </button>
        )}

        <a
          href={currentProjectId ? getPdfUrl(currentProjectId) : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            color: "var(--text-primary)",
          }}
        >
          <Download size={14} />
          PDF
        </a>

        {/* User info + logout */}
        {user && (
          <>
            <span className="text-xs ml-2" style={{ color: "var(--text-secondary)" }}>
              {user.email}
            </span>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="p-1.5 rounded transition-colors"
              style={{ backgroundColor: "var(--bg-tertiary)" }}
              title="Sign out"
            >
              <LogOut size={14} style={{ color: "var(--text-secondary)" }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
