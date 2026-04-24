"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Loader2, X, Search, LogOut, Sun, Moon,
  BookOpen, PenLine, MessageSquare, Settings, ChevronDown, Clock, Check,
} from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { listSharedProjects, createProject, deleteProject, listReviews } from "@/lib/api";
import type { ReviewSummary } from "@/lib/api";
import type { Project } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

type DashMode = "writing" | "research" | "review";

const MODE_META = {
  writing:  { label: "Writing",  noun: "paper",      accent: "var(--accent)",   blurb: "LaTeX drafts, preprints, and working manuscripts." },
  research: { label: "Research", noun: "collection", accent: "var(--accent-2)", blurb: "Reading lists, literature reviews, and annotated libraries." },
  review:   { label: "Review",   noun: "venue",      accent: "var(--accent-3)", blurb: "Assigned conferences, journals, and rebuttal rounds." },
} as const;

const STATS: Record<DashMode, [string, string, string][]> = {
  writing:  [["Words", "16,080", "this month"],  ["Equations", "94", "rendered"],  ["Compiles", "312", "99.1% ok"]],
  research: [["Papers", "214", "in library"],    ["Highlights", "733", "captured"], ["Notes", "130", "written"]],
  review:   [["Assigned", "13", "this cycle"],   ["Submitted", "8", "on time"],    ["Rebuttals", "4", "to read"]],
};

const BAR_COLORS = ["var(--accent)", "var(--accent-2)", "var(--accent-3)"];
const GLYPHS = ["∫", "Σ", "∇"];

const HERO_TEXT: Record<DashMode, { pre: string; em: string; post: string }> = {
  writing:  { pre: "Back to the ",       em: "manuscript",   post: ", " },
  research: { pre: "What are you ",      em: "reading",      post: " today?" },
  review:   { pre: "Your ",              em: "review queue", post: " awaits." },
};


const CREATE_PLACEHOLDER: Record<DashMode, string> = {
  writing:  "Title of your paper\u2026",
  research: "Name your collection\u2026",
  review:   "Venue or assignment\u2026",
};

// ─── Writing Project Card ──────────────────────────────────────────────────────

function WritingCard({
  project, index, onOpen, onDelete, deleting,
}: {
  project: Project; index: number;
  onOpen: () => void; onDelete: () => void; deleting: boolean;
}) {
  const glyph = GLYPHS[index % 3];
  const color = BAR_COLORS[index % 3];
  // Fake writing stats derived from project (real stats need backend support)
  const pages = 10 + (index * 4 % 20);
  const words = 1000 + (index * 1230 % 7000);
  const eqns  = 5 + (index * 7 % 40);
  const pct   = 22 + (index * 17 % 79);

  return (
    <div
      className="card rise"
      style={{
        padding: 18, cursor: "pointer", position: "relative", overflow: "hidden",
        animationDelay: `${index * 40}ms`,
      }}
      onClick={onOpen}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "color-mix(in oklab, var(--ink) 25%, var(--rule))";
        e.currentTarget.style.boxShadow = "var(--shadow-2)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--rule)";
        e.currentTarget.style.boxShadow = "var(--shadow-1)";
      }}
    >
      {/* Decorative glyph watermark */}
      <div style={{
        position: "absolute", right: -20, top: -10,
        fontFamily: "var(--font-serif)", fontSize: 110,
        color: `color-mix(in oklab, ${color} 14%, transparent)`,
        lineHeight: 1, userSelect: "none", pointerEvents: "none",
      }}>
        {glyph}
      </div>

      <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>
        Writing
      </div>
      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 22, lineHeight: 1.15, margin: "6px 0 4px", letterSpacing: "-0.01em", color: "var(--ink)" }}>
        {project.name}
      </h3>

      {/* Metrics */}
      <div style={{ fontSize: 12, color: "var(--ink-4)", display: "flex", gap: 8, fontFamily: "var(--font-mono)" }}>
        <span>{pages}p</span><span>·</span>
        <span>{words.toLocaleString()} words</span><span>·</span>
        <span>{eqns} eqns</span>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginBottom: 5 }}>
          <span>Draft progress</span><span>{pct}%</span>
        </div>
        <div style={{ height: 4, background: "var(--bg-2)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}, var(--accent-2))`, borderRadius: 4, transition: "width .4s" }} />
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--rule)" }}>
        <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={11} />
          {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="btn ghost icon sm"
            style={{ color: "var(--err)" }}
            title="Delete"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            disabled={deleting}
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
          <button
            className="btn sm"
            onClick={e => { e.stopPropagation(); onOpen(); }}
            style={{ gap: 4 }}
          >
            Open <span style={{ fontSize: 13 }}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Writing Project Row (list view) ──────────────────────────────────────────

function WritingRow({
  project, index, onOpen, onDelete, deleting,
}: {
  project: Project; index: number;
  onOpen: () => void; onDelete: () => void; deleting: boolean;
}) {
  const color = BAR_COLORS[index % 3];
  const pages = 10 + (index * 4 % 20);
  const words = 1000 + (index * 1230 % 7000);
  const pct   = 22 + (index * 17 % 79);

  return (
    <div
      className="rise"
      style={{
        display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto",
        gap: 16, alignItems: "center", padding: "14px 18px",
        borderBottom: "1px solid var(--rule)", cursor: "pointer",
        animationDelay: `${index * 30}ms`,
        transition: "background .12s",
      }}
      onClick={onOpen}
      onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 2%, transparent)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
    >
      <div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>Writing</div>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink)" }}>{project.name}</div>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{pages}p · {words.toLocaleString()} w</div>
      <div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 3 }}>{pct}% drafted</div>
        <div style={{ height: 3, background: "var(--bg-2)", borderRadius: 3 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}, var(--accent-2))`, borderRadius: 3 }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          className="btn ghost icon sm"
          style={{ color: "var(--err)" }}
          onClick={e => { e.stopPropagation(); onDelete(); }}
          disabled={deleting}
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
        <button className="btn sm" onClick={e => { e.stopPropagation(); onOpen(); }}>
          Open <span style={{ fontSize: 13 }}>→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router  = useRouter();
  const { user, logout, theme, toggleTheme } = useEditorStore();

  const [activeMode, setActiveMode]         = useState<DashMode>("writing");
  const [view, setView]                     = useState<"grid" | "list">("grid");
  const [filter, setFilter]                 = useState("");
  const [creating, setCreating]             = useState(false);
  const [newName, setNewName]               = useState("");
  const [projects, setProjects]             = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [reviews, setReviews]               = useState<ReviewSummary[]>([]);
  const [loading, setLoading]               = useState(true);
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [toast, setToast]                   = useState<string | null>(null);
  const [pickerProjectId, setPickerProjectId] = useState<string>("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadData = useCallback(() => {
    Promise.all([listSharedProjects(), listReviews()])
      .then(([projData, reviewData]) => {
        setProjects(projData.projects);
        setSharedProjects(projData.shared_projects || []);
        setReviews(reviewData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreatingLoading(true);
    try {
      await createProject(name);
      setNewName(""); setCreating(false);
      loadData();
      showToast(`"${name}" created`);
    } catch { showToast("Failed to create"); }
    finally { setCreatingLoading(false); }
  }, [newName, loadData]);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteProject(id);
      loadData();
      showToast(`"${name}" deleted`);
    } catch { showToast("Failed to delete"); }
    finally { setDeletingId(null); }
  }, [loadData]);

  const meta = MODE_META[activeMode];
  const hero = HERO_TEXT[activeMode];

  // Writing + Research both show the projects list; Review shows its own data
  const rawList = activeMode !== "review" ? projects : [];
  const visible = rawList.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()));
  const visibleReviews = reviews.filter(r =>
    r.project_name.toLowerCase().includes(filter.toLowerCase()) ||
    r.venue.toLowerCase().includes(filter.toLowerCase())
  );

  const tabCounts: Record<DashMode, number> = {
    writing:  projects.length,
    research: projects.length,
    review:   reviews.length,
  };

  const userName = user?.name || user?.email?.split("@")[0] || "you";
  const userInitials = (user?.name || user?.email || "U").slice(0, 2).toUpperCase();

  const tabConfig: { id: DashMode; Icon: React.ElementType }[] = [
    { id: "research", Icon: BookOpen },
    { id: "writing",  Icon: PenLine },
    { id: "review",   Icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen paper-bg" style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        borderBottom: "1px solid var(--rule)",
        background: "color-mix(in oklab, var(--bg) 70%, transparent)",
        backdropFilter: "blur(10px)",
      }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px", height: 56, display: "flex", alignItems: "center", gap: 16 }}>
          {/* Brand */}
          <div className="mark" style={{ flexShrink: 0 }}>
            <div className="mark-glyph" style={{ width: 24, height: 24, borderRadius: 7, fontSize: 16 }}>
              <span>C</span>
            </div>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, color: "var(--ink-2)" }}>
              ai<em style={{ fontStyle: "italic", color: "var(--ink-3)" }}>·latex</em>
            </span>
          </div>
          <div className="chip" style={{ background: "transparent", fontSize: 12 }}>Workspace · Personal</div>

          <div style={{ flex: 1 }} />

          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)", pointerEvents: "none" }} />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder={`Search ${meta.label.toLowerCase()}\u2026`}
              style={{
                width: 240, height: 32, paddingLeft: 30, paddingRight: 40,
                background: "var(--bg-2)", border: "1px solid var(--rule)",
                borderRadius: "var(--r)", color: "var(--ink)", fontSize: 13,
                fontFamily: "var(--font-ui)", outline: "none",
              }}
            />
            <span className="kbd" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10 }}>⌘K</span>
          </div>

          {/* Settings */}
          <button className="btn ghost icon" title="Settings"><Settings size={15} /></button>

          {/* Theme */}
          <button onClick={toggleTheme} className="btn ghost icon" title="Toggle theme">
            {theme === "dark" ? <Sun size={14} style={{ color: "var(--warn)" }} /> : <Moon size={14} style={{ color: "var(--ink-3)" }} />}
          </button>

          {/* Avatar + logout */}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: "conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
                display: "grid", placeItems: "center", color: "white",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {userInitials}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{userName}</span>
              <ChevronDown size={13} style={{ color: "var(--ink-3)" }} />
              <div style={{ width: 1, height: 16, background: "var(--rule)", margin: "0 4px" }} />
              <button onClick={() => { logout(); router.push("/login"); }} className="btn ghost icon sm" title="Sign out">
                <LogOut size={13} style={{ color: "var(--ink-4)" }} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Tab bar ── */}
      <nav style={{ borderBottom: "1px solid var(--rule)", background: "var(--bg)", position: "sticky", top: 56, zIndex: 10 }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px", display: "flex", alignItems: "stretch" }}>
          {tabConfig.map(({ id, Icon }) => {
            const m = MODE_META[id];
            const active = activeMode === id;
            return (
              <button
                key={id}
                onClick={() => { setActiveMode(id); setFilter(""); setCreating(false); setNewName(""); }}
                style={{
                  border: "none", background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "14px 18px",
                  color: active ? "var(--ink)" : "var(--ink-3)",
                  fontSize: 14, fontWeight: 600, letterSpacing: "-0.005em",
                  borderBottom: active ? `2px solid ${m.accent}` : "2px solid transparent",
                  marginBottom: -1, transition: "color .14s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = "var(--ink-3)"; }}
              >
                <span style={{ color: active ? m.accent : "currentColor", display: "grid", placeItems: "center" }}>
                  <Icon size={15} />
                </span>
                {m.label}
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  padding: "2px 7px", borderRadius: 999,
                  background: active ? `color-mix(in oklab, ${m.accent} 14%, transparent)` : "var(--bg-2)",
                  color: active ? m.accent : "var(--ink-3)",
                  border: `1px solid ${active ? `color-mix(in oklab, ${m.accent} 30%, transparent)` : "var(--rule)"}`,
                }}>
                  {tabCounts[id]}
                </span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", color: "var(--ink-4)", fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>
            ⌘1 · ⌘2 · ⌘3
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: "36px 28px 14px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 32, alignItems: "end" }}>
          {/* Left: heading */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: meta.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
                {meta.label.toLowerCase()} · {new Date().toLocaleString("en-US", { month: "short", year: "numeric" })}
              </span>
            </div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 52, lineHeight: 1.0, margin: 0, letterSpacing: "-0.02em", color: "var(--ink)" }}>
              {hero.pre}
              <em style={{ fontStyle: "italic", color: meta.accent }}>{hero.em}</em>
              {hero.post}
              {activeMode === "writing" && <span>{userName}.</span>}
            </h1>
            <p style={{ color: "var(--ink-3)", fontSize: 15, maxWidth: 580, marginTop: 10 }}>
              {meta.blurb}{" "}
              {activeMode === "writing" && (
                <>You have <strong style={{ color: "var(--ink)" }}>{projects.length} active {projects.length === 1 ? meta.noun : meta.noun + "s"}</strong>.</>
              )}
            </p>
          </div>

          {/* Right: stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {STATS[activeMode].map(([k, v, s]) => (
              <div key={k} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>{k}</div>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, letterSpacing: "-0.01em", marginTop: 2, color: "var(--ink)" }}>{v}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Toolbar row ── */}
      <section style={{ padding: "10px 28px 6px", maxWidth: 1240, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
            Your {meta.label.toLowerCase()} {meta.noun}s
          </h2>
          <span className="chip">{activeMode === "review" ? visibleReviews.length : visible.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Grid/List toggle */}
          <div style={{ display: "flex", background: "var(--bg-2)", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["grid", "list"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="btn ghost sm"
                style={{
                  background: view === v ? "var(--bg)" : "transparent",
                  boxShadow: view === v ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                  textTransform: "capitalize", fontSize: 12,
                }}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            className="btn sm"
            onClick={() => { setCreating(true); if (activeMode === "review" && projects.length > 0) setPickerProjectId(projects[0].id); }}
            style={{ background: meta.accent, borderColor: meta.accent, color: "white", gap: 5 }}
          >
            <Plus size={13} /> New {meta.noun}
          </button>
        </div>
      </section>

      {/* ── Create row ── */}
      {creating && activeMode !== "review" && (
        <section style={{ padding: "8px 28px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
          <div className="card rise" style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderColor: meta.accent }}>
            {activeMode === "research" ? <BookOpen size={16} style={{ color: meta.accent, flexShrink: 0 }} />
              : <PenLine size={16} style={{ color: meta.accent, flexShrink: 0 }} />}
            <input
              autoFocus
              className="input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={CREATE_PLACEHOLDER[activeMode]}
              style={{ flex: 1, height: 36, fontSize: 13 }}
              onKeyDown={e => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
            />
            <button
              className="btn sm"
              onClick={handleCreate}
              disabled={creatingLoading || !newName.trim()}
              style={{ background: meta.accent, borderColor: meta.accent, color: "white", gap: 5 }}
            >
              {creatingLoading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {creatingLoading ? "Creating\u2026" : "Create"}
            </button>
            <button className="btn ghost sm" onClick={() => { setCreating(false); setNewName(""); }}>
              <X size={13} /> Cancel
            </button>
          </div>
        </section>
      )}

      {/* Review mode: project picker */}
      {creating && activeMode === "review" && (
        <section style={{ padding: "8px 28px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
          <div className="card rise" style={{ display: "flex", alignItems: "center", gap: 10, padding: 14, borderColor: "var(--accent-3)" }}>
            <MessageSquare size={16} style={{ color: "var(--accent-3)", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--ink-3)", flexShrink: 0 }}>Review paper:</span>
            {projects.length === 0 ? (
              <span style={{ fontSize: 13, color: "var(--ink-3)", flex: 1 }}>No papers yet — create one in the Writing tab first.</span>
            ) : (
              <select
                className="input"
                value={pickerProjectId}
                onChange={e => setPickerProjectId(e.target.value)}
                style={{ flex: 1, height: 36, fontSize: 13 }}
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button
              className="btn sm"
              disabled={!pickerProjectId}
              onClick={() => { setCreating(false); router.push(`/editor/${pickerProjectId}?mode=review`); }}
              style={{ background: "var(--accent-3)", borderColor: "var(--accent-3)", color: "white", gap: 5 }}
            >
              <Check size={13} /> Start Review
            </button>
            <button className="btn ghost sm" onClick={() => { setCreating(false); setPickerProjectId(""); }}>
              <X size={13} /> Cancel
            </button>
          </div>
        </section>
      )}

      {/* ── Main content ── */}
      <section style={{ padding: "12px 28px 60px", maxWidth: 1240, margin: "0 auto", width: "100%" }}>

        {/* Loading skeletons */}
        {loading && activeMode !== "review" && (
          <div style={{ display: "grid", gridTemplateColumns: view === "grid" ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr", gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="card" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 12, width: "40%", marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 20, width: "80%", marginBottom: 14 }} />
                <div className="skeleton" style={{ height: 10, width: "55%" }} />
              </div>
            ))}
          </div>
        )}

        {/* Writing/Research: empty state */}
        {!loading && activeMode !== "review" && projects.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "var(--r-lg)", margin: "0 auto 16px",
              background: "conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
              display: "grid", placeItems: "center", fontSize: 28, fontFamily: "var(--font-serif)", color: "white",
            }}>∫</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>No drafts yet</p>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 20 }}>
              Start your first LaTeX document with AI assistance.
            </p>
            <button onClick={() => setCreating(true)} className="btn sm" style={{ background: "var(--accent)", borderColor: "var(--accent)", color: "white", gap: 5 }}>
              <Plus size={13} /> New paper
            </button>
          </div>
        )}

        {/* Writing/Research: no filter results */}
        {!loading && activeMode !== "review" && projects.length > 0 && visible.length === 0 && filter && (
          <div className="card" style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 28 }}>No papers match &ldquo;{filter}&rdquo;.</div>
            <div style={{ color: "var(--ink-3)", marginTop: 6 }}>Try another name, or start a new one.</div>
          </div>
        )}

        {/* Writing/Research: cards */}
        {!loading && activeMode !== "review" && visible.length > 0 && (
          view === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {visible.map((p, i) => (
                <WritingCard
                  key={p.id} project={p} index={i}
                  onOpen={() => router.push(`/editor/${p.id}`)}
                  onDelete={() => handleDelete(p.id, p.name)}
                  deleting={deletingId === p.id}
                />
              ))}
            </div>
          ) : (
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              {visible.map((p, i) => (
                <WritingRow
                  key={p.id} project={p} index={i}
                  onOpen={() => router.push(`/editor/${p.id}`)}
                  onDelete={() => handleDelete(p.id, p.name)}
                  deleting={deletingId === p.id}
                />
              ))}
            </div>
          )
        )}

        {/* Review tab: loading skeletons */}
        {loading && activeMode === "review" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="card" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 12, width: "30%", marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 20, width: "65%", marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 10, width: "45%" }} />
              </div>
            ))}
          </div>
        )}

        {/* Review tab: empty state */}
        {!loading && activeMode === "review" && reviews.length === 0 && (
          <div className="card fadein" style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: "var(--ink)" }}>No reviews yet.</div>
            <div style={{ color: "var(--ink-3)", marginTop: 6, fontSize: 14 }}>
              {projects.length === 0
                ? "Create a paper in the Writing tab, then start a review from the editor."
                : "Start your first review by clicking \u201cNew venue\u201d above."}
            </div>
            {projects.length > 0 && (
              <button
                className="btn sm"
                style={{ marginTop: 20, background: "var(--accent-3)", borderColor: "var(--accent-3)", color: "white", gap: 5 }}
                onClick={() => { setCreating(true); setPickerProjectId(projects[0].id); }}
              >
                <Plus size={13} /> New venue
              </button>
            )}
          </div>
        )}

        {/* Review tab: review cards */}
        {!loading && activeMode === "review" && visibleReviews.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visibleReviews.map((r, i) => {
              const statusColor = r.status === "done" ? "var(--ok)" : r.status === "error" ? "var(--err)" : "var(--warn)";
              const verdictColors: Record<string, string> = {
                strong_accept: "var(--ok)", accept: "var(--ok)", weak_accept: "var(--ok)",
                borderline: "var(--warn)",
                weak_reject: "var(--err)", reject: "var(--err)", strong_reject: "var(--err)",
              };
              const verdictColor = r.meta_verdict ? (verdictColors[r.meta_verdict] ?? "var(--ink-3)") : "var(--ink-3)";
              return (
                <div
                  key={r.id}
                  className="card rise"
                  style={{ padding: 18, cursor: "pointer", animationDelay: `${i * 40}ms` }}
                  onClick={() => router.push(`/editor/${r.project_id}`)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "color-mix(in oklab, var(--accent-3) 40%, var(--rule))"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--rule)"; }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span className="chip" style={{ fontSize: 10, background: "color-mix(in oklab, var(--accent-3) 12%, transparent)", color: "var(--accent-3)", borderColor: "transparent", fontFamily: "var(--font-mono)" }}>
                          {r.venue}
                        </span>
                        <span className="chip" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>{r.mode}</span>
                      </div>
                      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: 20, margin: "0 0 4px", color: "var(--ink)", letterSpacing: "-0.01em" }}>
                        {r.project_name}
                      </h3>
                      <div style={{ fontSize: 12, color: "var(--ink-4)", fontFamily: "var(--font-mono)", display: "flex", gap: 10 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                          {r.status}
                          {r.status === "running" && ` · ${r.progress_pct}%`}
                        </span>
                        <span>·</span>
                        <span><Clock size={10} style={{ display: "inline", verticalAlign: "middle" }} /> {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                    </div>
                    {r.meta_verdict && r.meta_overall !== null && (
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 28, color: verdictColor, lineHeight: 1 }}>
                          {r.meta_overall.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 10, color: verdictColor, fontFamily: "var(--font-mono)", letterSpacing: ".04em", marginTop: 2 }}>
                          {r.meta_verdict.replace("_", " ")}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Shared with me (writing mode only) */}
        {!loading && activeMode === "writing" && sharedProjects.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 16, fontFamily: "var(--font-mono)", letterSpacing: ".04em", textTransform: "uppercase" }}>
              Shared with me
              <span style={{ fontSize: 11, color: "var(--ink-4)", marginLeft: 8 }}>{sharedProjects.length}</span>
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: view === "grid" ? "repeat(auto-fill, minmax(300px, 1fr))" : "1fr", gap: 16 }}>
              {sharedProjects.map((p, i) => (
                view === "grid" ? (
                  <div key={p.id} style={{ position: "relative" }}>
                    <WritingCard
                      project={p} index={i}
                      onOpen={() => router.push(`/editor/${p.id}`)}
                      onDelete={() => {}}
                      deleting={false}
                    />
                    <span className="chip" style={{
                      position: "absolute", top: 10, left: 10,
                      fontSize: 9, fontFamily: "var(--font-mono)",
                      background: "color-mix(in oklab, var(--accent) 12%, transparent)",
                      borderColor: "transparent", color: "var(--accent)",
                      textTransform: "uppercase", letterSpacing: ".05em",
                    }}>
                      {(p as Project & { role?: string }).role || "editor"}
                    </span>
                  </div>
                ) : (
                  <WritingRow
                    key={p.id} project={p} index={i}
                    onOpen={() => router.push(`/editor/${p.id}`)}
                    onDelete={() => {}}
                    deleting={false}
                  />
                )
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Toast ── */}
      {toast && <div className="toast animate-fadeIn">{toast}</div>}
    </div>
  );
}
