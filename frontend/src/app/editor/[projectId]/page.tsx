"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
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

export default function EditorPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { sidebarOpen, currentProjectId, setCurrentProjectId } = useEditorStore();

  // Set the current project when page loads
  useEffect(() => {
    if (currentProjectId !== projectId) {
      setCurrentProjectId(projectId);
    }
  }, [projectId, currentProjectId, setCurrentProjectId]);

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
        {sidebarOpen && <FileSidebar />}

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

      <StatusBar />
    </div>
  );
}
