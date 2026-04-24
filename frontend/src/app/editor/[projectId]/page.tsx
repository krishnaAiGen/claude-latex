"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";
import { useEditorStore } from "@/store/editorStore";
import EditorPanel from "@/components/EditorPanel";
import PdfPreviewPanel from "@/components/PdfPreviewPanel";
import ChatPanel from "@/components/ChatPanel";
import FileSidebar from "@/components/FileSidebar";
import Toolbar from "@/components/Toolbar";
import StatusBar from "@/components/StatusBar";
import PullBanner from "@/components/PullBanner";
import HistoryPanel from "@/components/HistoryPanel";
import CommentsPanel from "@/components/CommentsPanel";
import OutlinePanel from "@/components/OutlinePanel";
import ActivityBar from "@/components/ActivityBar";
import SourceControlPanel from "@/components/SourceControlPanel";
import ReviewModeWrapper from "@/components/review/ReviewModeWrapper";
import ReviewChat from "@/components/review/ReviewChat";
import { ReviewAgentsPanel, ReviewFindingsPanel, ReviewBenchmarksPanel } from "@/components/review/ReviewSidebarPanels";
import { fetchDocument } from "@/lib/api";

// fetch project metadata including role and name
async function fetchProjectMeta(projectId: string): Promise<{ role: "owner" | "editor" | "commenter" | "viewer"; name: string }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("claude_latex_token") : null;
  if (!token) return { role: "viewer", name: "" };
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/projects/${projectId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return { role: "viewer", name: "" };
  const data = await res.json();
  return { role: data.project?.role || "owner", name: data.project?.name || data.project?.title || "" };
}

export default function EditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const {
    sidebarOpen,
    currentProjectId,
    setCurrentProjectId,
    setMyRole,
    setCurrentProjectName,
    leftTab,
    setLeftTab,
    setSidebarOpen,
    comments,
    isDirty,
    appMode,
    setAppMode,
  } = useEditorStore();

  // Set the current project when page loads
  useEffect(() => {
    if (currentProjectId !== projectId) {
      setCurrentProjectId(projectId);
    }
  }, [projectId, currentProjectId, setCurrentProjectId]);

  // Load role and name on mount
  useEffect(() => {
    fetchProjectMeta(projectId).then(({ role, name }) => {
      setMyRole(role);
      if (name) setCurrentProjectName(name);
    });
  }, [projectId, setMyRole, setCurrentProjectName]);

  // Auto-switch to review mode if ?mode=review is in the URL
  useEffect(() => {
    if (searchParams.get("mode") === "review") {
      setAppMode("review");
    }
  }, [searchParams, setAppMode]);

  // Show loader until store is synced with URL param
  if (currentProjectId !== projectId) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <div className="flex flex-col items-center gap-3 animate-fadeIn">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Toolbar />

      <div className="flex-1 flex overflow-hidden">
        {/* ActivityBar + tabbed sidebar */}
        <aside
          style={{
            display: "flex",
            borderRight: "1px solid var(--rule)",
            background: "var(--bg-2)",
            overflow: "hidden",
            minWidth: 0,
            flexShrink: 0,
          }}
        >
          <ActivityBar
            tab={leftTab}
            setTab={setLeftTab}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            unreadComments={comments.filter((c) => !c.resolved).length}
            uncommittedCount={isDirty ? 1 : 0}
            appMode={appMode}
          />
          {sidebarOpen && (
            <div
              style={{
                width: 248,
                borderLeft: "1px solid var(--rule)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Writing mode panels */}
              {appMode !== "review" && leftTab === "files"    && <FileSidebar />}
              {appMode !== "review" && leftTab === "comments" && <CommentsPanel projectId={projectId} />}
              {appMode !== "review" && leftTab === "outline"  && <OutlinePanel />}
              {appMode !== "review" && leftTab === "source"   && <SourceControlPanel projectId={projectId} />}
              {appMode !== "review" && leftTab === "history"  && <HistoryPanel projectId={projectId} />}
              {/* Review mode panels */}
              {appMode === "review" && leftTab === "review-agents"     && <ReviewAgentsPanel />}
              {appMode === "review" && leftTab === "review-findings"   && <ReviewFindingsPanel />}
              {appMode === "review" && leftTab === "review-benchmarks" && <ReviewBenchmarksPanel />}
            </div>
          )}
        </aside>

        {appMode === "review" ? (
          /* Review layout: ReviewModeWrapper + ReviewChat */
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            <ReviewModeWrapper projectId={projectId} />
            <div style={{ width: 340, borderLeft: "1px solid var(--rule)", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <ReviewChat />
            </div>
          </div>
        ) : (
          /* Writing layout: Editor + PDF + Chat */
          <div className="flex-1 flex flex-col overflow-hidden">
            <PullBanner projectId={projectId} />
            <div className="flex-1 overflow-hidden">
              <Group orientation="horizontal">
                <Panel defaultSize={35} minSize={20}>
                  <EditorPanel />
                </Panel>

                <Separator
                  className="w-1 transition-colors hover:bg-[var(--accent)]"
                  style={{ backgroundColor: "var(--rule)" }}
                />

                <Panel defaultSize={35} minSize={20}>
                  <PdfPreviewPanel />
                </Panel>

                <Separator
                  className="w-1 transition-colors hover:bg-[var(--accent)]"
                  style={{ backgroundColor: "var(--rule)" }}
                />

                <Panel defaultSize={30} minSize={20}>
                  <ChatPanel />
                </Panel>
              </Group>
            </div>
          </div>
        )}
      </div>

      <StatusBar />
    </div>
  );
}
