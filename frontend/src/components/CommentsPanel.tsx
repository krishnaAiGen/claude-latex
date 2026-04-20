"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageSquare, CornerDownRight, Trash2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { getComments, createComment, resolveComment, deleteComment } from "@/lib/api";
import type { Comment } from "@/lib/types";

const COLORS = [
  "#7C6CF6", "#2BB673", "#E0833F", "#C94F7C",
  "#3A8FD6", "#B06AB3", "#E0A030", "#4CA8A0",
];

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  projectId: string;
}

export default function CommentsPanel({ projectId }: Props) {
  const { myRole, comments, setComments, addComment: addCommentToStore, user } = useEditorStore();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all" | "resolved">("open");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const canComment = myRole === "owner" || myRole === "editor" || myRole === "commenter";

  useEffect(() => {
    getComments(projectId)
      .then((data) => setComments(data.comments))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, setComments]);

  const handleResolve = async (id: string, resolved: boolean) => {
    try {
      await resolveComment(projectId, id, resolved);
      setComments(comments.map((c) => (c.id === id ? { ...c, resolved } : c)));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteComment(projectId, id);
      setComments(comments.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleReply = async (parentId: string) => {
    const text = (draft[parentId] || "").trim();
    if (!text) return;
    try {
      const comment = await createComment(projectId, text, undefined, parentId);
      setComments(
        comments.map((c) => (c.id === parentId ? { ...c, replies: [...c.replies, comment] } : c))
      );
      setDraft((d) => ({ ...d, [parentId]: "" }));
    } catch (e) {
      console.error(e);
    }
  };

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;

  const list = comments.filter((c) =>
    filter === "all" ? true : filter === "resolved" ? c.resolved : !c.resolved
  );

  return (
    <>
      {/* Header */}
      <div style={{ padding: "12px 12px 8px" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            fontFamily: "var(--font-mono)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Comments
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
          {openCount} open · {resolvedCount} resolved
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ padding: "0 10px 10px", display: "flex", gap: 4 }}>
        {(["open", "all", "resolved"] as const).map((v) => (
          <button
            key={v}
            className="btn sm"
            onClick={() => setFilter(v)}
            style={
              filter === v
                ? { background: "var(--ink)", color: "var(--bg)", borderColor: "var(--ink)", flex: 1 }
                : { flex: 1 }
            }
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* Comment list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "4px 10px 12px",
          borderTop: "1px solid var(--rule)",
        }}
      >
        {loading && (
          <div style={{ padding: "28px 12px", textAlign: "center", color: "var(--ink-4)", fontSize: 12 }}>
            Loading…
          </div>
        )}

        {!loading && list.length === 0 && (
          <div style={{ padding: "28px 12px", textAlign: "center", color: "var(--ink-4)", fontSize: 12 }}>
            <div style={{ opacity: 0.6 }}>
              <MessageSquare size={20} style={{ margin: "0 auto" }} />
            </div>
            <div style={{ marginTop: 6 }}>No {filter} comments</div>
            <div style={{ fontSize: 10.5, marginTop: 3 }}>
              Select text in the editor to start a thread
            </div>
          </div>
        )}

        {list.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            canComment={canComment}
            currentUserId={user?.id}
            draft={draft[c.id] || ""}
            onDraftChange={(v) => setDraft((d) => ({ ...d, [c.id]: v }))}
            onResolve={handleResolve}
            onReply={() => handleReply(c.id)}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </>
  );
}

function CommentCard({
  comment,
  canComment,
  currentUserId,
  draft,
  onDraftChange,
  onResolve,
  onReply,
  onDelete,
}: {
  comment: Comment;
  canComment: boolean;
  currentUserId?: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onReply: () => void;
  onDelete: (id: string) => void;
}) {
  const color = nameToColor(comment.userName);
  const initials = (comment.userName || "?").slice(0, 2).toUpperCase();

  return (
    <div
      style={{
        background: "var(--bg)",
        border: `1px solid var(--rule)`,
        borderRadius: 10,
        padding: 10,
        marginTop: 10,
        opacity: comment.resolved ? 0.62 : 1,
        transition: "all .18s var(--ease)",
        cursor: comment.lineNumber != null ? "pointer" : "default",
      }}
      onClick={() => {
        if (comment.lineNumber != null) {
          window.dispatchEvent(
            new CustomEvent("reveal-comment-line", { detail: { line: comment.lineNumber } })
          );
        }
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: color,
            color: "white",
            fontWeight: 700,
            fontSize: 9,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{comment.userName}</div>
          <div style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
            {comment.lineNumber != null && `line ${comment.lineNumber} · `}
            {timeAgo(comment.createdAt)} ago
            {comment.resolved && " · resolved"}
          </div>
        </div>
        {currentUserId === comment.userId && (
          <button
            className="btn icon ghost sm"
            onClick={(e) => { e.stopPropagation(); onDelete(comment.id); }}
            title="Delete comment"
            style={{ color: "var(--err)" }}
          >
            <Trash2 size={13} />
          </button>
        )}
        <button
          className="btn icon ghost sm"
          onClick={(e) => { e.stopPropagation(); onResolve(comment.id, !comment.resolved); }}
          title={comment.resolved ? "Reopen" : "Resolve"}
          style={comment.resolved ? { color: "var(--ok)" } : {}}
        >
          <Check size={13} />
        </button>
      </div>

      {/* Body */}
      <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
        {comment.content}
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingLeft: 8,
            borderLeft: "2px solid var(--rule)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {comment.replies.map((r, i) => {
            const rColor = nameToColor(r.userName);
            const rInitials = (r.userName || "?").slice(0, 2).toUpperCase();
            return (
              <div key={i} style={{ display: "flex", gap: 7 }}>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: rColor,
                    color: "white",
                    fontWeight: 700,
                    fontSize: 8,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {rInitials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                    <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{r.userName}</span>
                    {" · "}{timeAgo(r.createdAt)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4 }}>{r.content}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply input */}
      {canComment && !comment.resolved && (
        <div style={{ marginTop: 8, display: "flex", gap: 5 }}>
          <input
            className="input"
            placeholder="Reply…"
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onReply()}
            style={{ padding: "5px 8px", fontSize: 11.5 }}
          />
          <button
            className="btn sm accent icon"
            disabled={!draft.trim()}
            onClick={onReply}
          >
            <CornerDownRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
