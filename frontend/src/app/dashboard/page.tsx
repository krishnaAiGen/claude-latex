"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Trash2, FolderOpen, LogOut, Loader2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { listProjects, createProject, deleteProject } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [creatingLoading, setCreatingLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();
  const { user, logout } = useEditorStore();

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

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-3 border-b"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          <FileText size={24} style={{ color: "var(--accent)" }} />
          <h1 className="text-lg font-semibold">Claude LaTeX Editor</h1>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {user.email}
            </span>
          )}
          <button
            onClick={() => {
              logout();
              router.push("/login");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Your Projects</h2>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        {/* Create project input */}
        {creating && (
          <div
            className="flex items-center gap-2 mb-4 p-3 rounded border animate-fadeIn"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--accent)",
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewName("");
                }
              }}
              placeholder="Project name..."
              className="flex-1 px-3 py-1.5 rounded border text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={handleCreate}
              disabled={creatingLoading}
              className="px-4 py-1.5 rounded text-sm flex items-center gap-1.5 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              {creatingLoading && <Loader2 size={14} className="animate-spin" />}
              {creatingLoading ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="px-3 py-1.5 rounded text-sm"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Projects list */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded border"
                style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--border)" }}
              >
                <div className="skeleton h-4 w-48 mb-2" />
                <div className="skeleton h-3 w-32" />
              </div>
            ))}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div
            className="text-center py-16 rounded border"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
          >
            <FolderOpen
              size={48}
              className="mx-auto mb-4"
              style={{ color: "var(--text-secondary)" }}
            />
            <p className="text-sm mb-2" style={{ color: "var(--text-primary)" }}>
              No projects yet
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Click &quot;New Project&quot; to create your first LaTeX project.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between p-4 rounded border transition-colors cursor-pointer animate-fadeIn"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
              }}
              onClick={() => handleOpen(project.id)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--accent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            >
              <div>
                <h3 className="text-sm font-medium">{project.name}</h3>
                {project.description && (
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {project.description}
                  </p>
                )}
                <p
                  className="text-xs mt-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Created {new Date(project.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpen(project.id);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "white",
                  }}
                >
                  <FolderOpen size={12} />
                  Open
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id, project.name);
                  }}
                  disabled={deletingId === project.id}
                  className="p-1.5 rounded disabled:opacity-50"
                  style={{ color: "var(--error)" }}
                >
                  {deletingId === project.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
