"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FolderOpen, Loader2, LayoutGrid, List, X, Search, LogOut, Sun, Moon } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { listProjects, createProject, deleteProject } from "@/lib/api";
import type { Project } from "@/lib/types";

const MATH_SYMBOLS = ["∫", "Σ", "∇"];
const TAG_LABELS = ["LaTeX", "Research", "Report"];
const TAG_COLORS = [
  "color-mix(in oklab, var(--accent) 15%, transparent)",
  "color-mix(in oklab, var(--accent-2) 15%, transparent)",
  "color-mix(in oklab, var(--accent-3) 15%, transparent)",
];

function ProjectCard({
  project,
  index,
  onOpen,
  onDelete,
  deleting,
}: {
  project: Project;
  index: number;
  onOpen: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  deleting: boolean;
}) {
  const symbol = MATH_SYMBOLS[index % 3];
  const tag = TAG_LABELS[index % 3];
  const tagColor = TAG_COLORS[index % 3];
  const barColor = ["var(--accent)", "var(--accent-2)", "var(--accent-3)"][index % 3];
  const barWidth = [72, 55, 88][index % 3];

  return (
    <div
      className="card animate-fadeIn"
      style={{ cursor: "pointer", position: "relative", overflow: "hidden", padding: 0 }}
      onClick={() => onOpen(project.id)}
    >
      {/* Colored progress bar top */}
      <div style={{ height: 3, background: barColor, width: `${barWidth}%`, borderRadius: "0 0 3px 0" }} />

      {/* Decorative math symbol */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 16,
          top: 20,
          fontSize: 56,
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          color: "color-mix(in oklab, var(--ink) 6%, transparent)",
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {symbol}
      </div>

      <div style={{ padding: "16px 20px 18px" }}>
        <div className="flex items-start justify-between gap-4">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 600,
                fontSize: 14,
                color: "var(--ink)",
                marginBottom: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {project.name}
            </h3>
            {project.description && (
              <p style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>{project.description}</p>
            )}
            <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
              <span
                className="chip"
                style={{ background: tagColor, borderColor: "transparent", fontSize: 10 }}
              >
                {tag}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
                {new Date(project.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(project.id);
            }}
            className="btn accent sm"
            style={{ flex: 1, justifyContent: "center" }}
          >
            <FolderOpen size={12} />
            Open
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project.id, project.name);
            }}
            disabled={deleting}
            className="btn ghost icon sm"
            style={{ color: "var(--err)" }}
            title="Delete project"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  index,
  onOpen,
  onDelete,
  deleting,
}: {
  project: Project;
  index: number;
  onOpen: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  deleting: boolean;
}) {
  const barColor = ["var(--accent)", "var(--accent-2)", "var(--accent-3)"][index % 3];

  return (
    <div
      className="animate-fadeIn"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: "var(--r)",
        background: "var(--paper)",
        border: "1px solid var(--rule)",
        cursor: "pointer",
        transition: "border-color 0.15s ease",
      }}
      onClick={() => onOpen(project.id)}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--rule)")}
    >
      <div style={{ width: 3, height: 32, borderRadius: 2, background: barColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </p>
        <p style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
          {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(project.id); }}
          className="btn accent sm"
        >
          <FolderOpen size={12} />
          Open
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(project.id, project.name); }}
          disabled={deleting}
          className="btn ghost icon sm"
          style={{ color: "var(--err)" }}
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  const { user, logout, theme, toggleTheme } = useEditorStore();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadProjects = useCallback(() => {
    listProjects()
      .then((data) => setProjects(data.projects))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreatingLoading(true);
    try {
      await createProject(name);
      setNewName("");
      setCreating(false);
      loadProjects();
      showToast(`Project "${name}" created`);
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingLoading(false);
    }
  }, [newName, loadProjects]);

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
      setDeletingId(id);
      try {
        await deleteProject(id);
        loadProjects();
        showToast(`Project "${name}" deleted`);
      } catch (e) {
        console.error(e);
      } finally {
        setDeletingId(null);
      }
    },
    [loadProjects]
  );

  const handleOpen = useCallback(
    (id: string) => {
      router.push(`/editor/${id}`);
    },
    [router]
  );

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          borderBottom: "1px solid var(--rule)",
          background: "color-mix(in oklab, var(--bg-2) 92%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 24px",
            height: 52,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* Brand */}
          <div className="mark" style={{ marginRight: 8 }}>
            <div className="mark-glyph">
              <span>C</span>
            </div>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-2)" }}>
              ai<em style={{ fontStyle: "italic", color: "var(--ink-3)" }}>·latex</em>
            </span>
          </div>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 360, position: "relative" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-4)",
                pointerEvents: "none",
              }}
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter projects…"
              style={{
                width: "100%",
                height: 32,
                paddingLeft: 30,
                paddingRight: 36,
                background: "var(--paper)",
                border: "1px solid var(--rule)",
                borderRadius: "var(--r)",
                color: "var(--ink)",
                fontSize: 13,
                fontFamily: "var(--font-ui)",
                outline: "none",
              }}
            />
            <span
              className="kbd"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 10,
              }}
            >
              ⌘K
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {/* User + logout */}
          {user && (
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
                  display: "grid",
                  placeItems: "center",
                  color: "white",
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {user.name ? user.name[0].toUpperCase() : user.email[0].toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.email}
              </span>
              <button
                onClick={toggleTheme}
                className="btn ghost icon sm"
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark"
                  ? <Sun size={13} style={{ color: "var(--warn)" }} />
                  : <Moon size={13} style={{ color: "var(--ink-3)" }} />}
              </button>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="btn ghost icon sm"
                title="Sign out"
              >
                <LogOut size={13} style={{ color: "var(--ink-4)" }} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 36,
              fontWeight: 400,
              color: "var(--ink)",
              lineHeight: 1.15,
              marginBottom: 6,
            }}
          >
            {greeting()},{" "}
            <em style={{ fontStyle: "italic", color: "var(--ink-3)" }}>
              {user?.name || user?.email?.split("@")[0] || "scholar"}
            </em>
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-3)" }}>
            Your LaTeX workspace — powered by Claude.
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-3" style={{ marginTop: 20 }}>
            {[
              { label: "Projects", value: loading ? "—" : String(projects.length) },
              { label: "Compiled today", value: "—" },
              { label: "Pages written", value: "—" },
            ].map((s) => (
              <div
                key={s.label}
                className="card"
                style={{ padding: "10px 18px", display: "flex", flexDirection: "column", gap: 2 }}
              >
                <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
                  {s.value}
                </span>
                <span style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
            Projects
            {filtered.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--font-mono)", marginLeft: 8 }}>
                {filtered.length}
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center" style={{ border: "1px solid var(--rule)", borderRadius: "var(--r)", overflow: "hidden" }}>
              <button
                onClick={() => setView("grid")}
                className="btn ghost icon sm"
                style={{
                  borderRadius: 0,
                  background: view === "grid" ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "transparent",
                  color: view === "grid" ? "var(--accent)" : "var(--ink-3)",
                  borderColor: "transparent",
                }}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setView("list")}
                className="btn ghost icon sm"
                style={{
                  borderRadius: 0,
                  background: view === "list" ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "transparent",
                  color: view === "list" ? "var(--accent)" : "var(--ink-3)",
                  borderColor: "transparent",
                }}
              >
                <List size={13} />
              </button>
            </div>

            <button onClick={() => setCreating(true)} className="btn accent sm">
              <Plus size={13} />
              New project
            </button>
          </div>
        </div>

        {/* Create project form */}
        {creating && (
          <div
            className="card animate-fadeIn"
            style={{ padding: "14px 16px", marginBottom: 16, borderColor: "var(--accent)" }}
          >
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Project name…"
                className="input"
                style={{ flex: 1, height: 36, fontSize: 13 }}
              />
              <button
                onClick={handleCreate}
                disabled={creatingLoading || !newName.trim()}
                className="btn accent sm"
              >
                {creatingLoading && <Loader2 size={13} className="animate-spin" />}
                {creatingLoading ? "Creating…" : "Create"}
              </button>
              <button
                onClick={() => { setCreating(false); setNewName(""); }}
                className="btn ghost icon sm"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: view === "grid" ? "repeat(auto-fill, minmax(260px, 1fr))" : "1fr",
              gap: 12,
            }}
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 11, width: "40%" }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div
            className="card"
            style={{ textAlign: "center", padding: "56px 24px" }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "var(--r-lg)",
                background: "conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
                fontSize: 26,
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                color: "white",
              }}
            >
              ∫
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
              No projects yet
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
              Start your first LaTeX document with AI assistance.
            </p>
            <button onClick={() => setCreating(true)} className="btn accent sm">
              <Plus size={13} />
              New project
            </button>
          </div>
        )}

        {/* No filter results */}
        {!loading && projects.length > 0 && filtered.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--ink-3)", padding: "24px 0" }}>
            No projects match &ldquo;{filter}&rdquo;
          </p>
        )}

        {/* Projects grid/list */}
        {!loading && filtered.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: view === "grid" ? "repeat(auto-fill, minmax(260px, 1fr))" : "1fr",
              gap: 12,
            }}
          >
            {filtered.map((project, i) =>
              view === "grid" ? (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={i}
                  onOpen={handleOpen}
                  onDelete={handleDelete}
                  deleting={deletingId === project.id}
                />
              ) : (
                <ProjectRow
                  key={project.id}
                  project={project}
                  index={i}
                  onOpen={handleOpen}
                  onDelete={handleDelete}
                  deleting={deletingId === project.id}
                />
              )
            )}
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className="toast animate-fadeIn">
          {toast}
        </div>
      )}
    </div>
  );
}
