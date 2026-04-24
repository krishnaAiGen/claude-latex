"use client";

import { useEditorStore } from "@/store/editorStore";
import ReviewSetup from "./ReviewSetup";
import ReviewRunning from "./ReviewRunning";
import ReviewOutput from "./ReviewOutput";

interface Props {
  projectId: string;
}

export default function ReviewModeWrapper({ projectId }: Props) {
  const { reviewPhase } = useEditorStore();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
      {reviewPhase === "setup"   && <ReviewSetup />}
      {reviewPhase === "running" && <ReviewRunning projectId={projectId} />}
      {reviewPhase === "done"    && <ReviewOutput />}
    </div>
  );
}
