"use client";

import { useEditorStore } from "@/store/editorStore";

interface Props {
  onPush: () => void;
  onPull: () => void;
}

export default function DraftStatusChip({ onPush, onPull }: Props) {
  const { myRole, mainAhead, latexContent, savedContent } = useEditorStore();

  if (myRole !== "owner" && myRole !== "editor") return null;

  const hasChanges = latexContent !== savedContent;

  if (mainAhead) {
    return (
      <div
        className="flex items-center gap-2 chip"
        style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
      >
        <span>⚠ Main updated</span>
        <button
          onClick={onPull}
          className="btn ghost sm"
          style={{ fontSize: 11, padding: "2px 8px", color: "var(--warn)", borderColor: "var(--warn)" }}
        >
          Pull ↓
        </button>
      </div>
    );
  }

  if (hasChanges && myRole === "owner") {
    return (
      <div
        className="flex items-center gap-2 chip"
        style={{ borderLeft: "2px solid var(--accent)", color: "var(--ink-2)" }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          ◉ Draft changed
        </span>
        <button
          onClick={onPush}
          className="btn accent sm"
          style={{ fontSize: 11, padding: "2px 8px" }}
        >
          Push →
        </button>
      </div>
    );
  }

  return (
    <div
      className="chip"
      style={{ color: "var(--ok)", borderColor: "color-mix(in oklab, var(--ok) 30%, var(--rule))" }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>✓ Up to date</span>
    </div>
  );
}
