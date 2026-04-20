"use client";

import { useEffect, useState } from "react";
import { X, Mail, Link2, Lock, Globe, Check, Loader2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import {
  getProjectMembers,
  inviteToProject,
  getProjectInvitations,
  revokeInvitation,
  removeMember,
  updateMemberRole,
} from "@/lib/api";
import type { ProjectMember, ProjectInvitation } from "@/lib/types";

const ROLES = [
  ["viewer", "Viewer", "Can read and download"],
  ["commenter", "Commenter", "Can read and comment"],
  ["editor", "Editor", "Can edit and compile"],
] as const;

const COLORS = [
  "#7C6CF6", "#2BB673", "#E0833F", "#C94F7C",
  "#3A8FD6", "#B06AB3", "#E0A030", "#4CA8A0",
];

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface Props {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export default function ShareModal({ projectId, projectName, onClose }: Props) {
  const { myRole, user } = useEditorStore();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "commenter" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [emailWarning, setEmailWarning] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkAccess, setLinkAccess] = useState<"restricted" | "anyone-view" | "anyone-comment">("restricted");

  const isOwner = myRole === "owner";

  useEffect(() => {
    Promise.all([
      getProjectMembers(projectId),
      getProjectInvitations(projectId),
    ])
      .then(([membersData, invitationsData]) => {
        setMembers(membersData.members);
        setInvitations(invitationsData.invitations);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    setEmailWarning(false);
    try {
      const result = await inviteToProject(projectId, email.trim(), role);
      if (!result.email_sent) {
        setEmailWarning(true);
        return;
      }
      setInviteLink(result.invite_url);
      setEmail("");
      const [membersData, invitationsData] = await Promise.all([
        getProjectMembers(projectId),
        getProjectInvitations(projectId),
      ]);
      setMembers(membersData.members);
      setInvitations(invitationsData.invitations);
    } catch (e) {
      console.error(e);
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      await revokeInvitation(projectId, invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRoleChange = async (userId: string, value: string) => {
    if (value === "remove") {
      try {
        await removeMember(projectId, userId);
        setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    try {
      await updateMemberRole(projectId, userId, value);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role: value as ProjectMember["role"] } : m))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const copyLink = () => {
    const link = inviteLink || window.location.href;
    try { navigator.clipboard.writeText(link); } catch (e) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const displayLink = inviteLink || `${window.location.origin}/invite?project=${projectId}`;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "color-mix(in oklab, var(--ink) 45%, transparent)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "min(560px, 100%)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          animation: "rise .28s var(--spring)",
          padding: 0,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid var(--rule)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, letterSpacing: "-0.01em" }}>
              Share &ldquo;{projectName}&rdquo;
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>
              Invite collaborators · control who can edit, comment, or view
            </div>
          </div>
          <button className="btn icon ghost" onClick={onClose}><X size={15} /></button>
        </div>

        {/* Invite section */}
        {isOwner && (
          <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid var(--rule)" }}>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                fontFamily: "var(--font-mono)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Mail size={12} /> Invite by email
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--ink-4)",
                    pointerEvents: "none",
                  }}
                >
                  <Mail size={14} />
                </span>
                <input
                  className="input"
                  placeholder="name@lab.edu, separate multiple with commas"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  style={{ paddingLeft: 34 }}
                />
              </div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as typeof role)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--rule)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  font: "500 13px var(--font-ui)",
                  cursor: "pointer",
                }}
              >
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button className="btn accent" onClick={handleInvite} disabled={inviting || !email.trim()}>
                {inviting ? <Loader2 size={13} className="animate-spin" /> : <Mail size={14} />}
                Send invite
              </button>
            </div>
            {emailWarning ? (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "color-mix(in oklab, var(--warn) 10%, var(--bg-2))",
                  border: "1px dashed color-mix(in oklab, var(--warn) 40%, var(--rule))",
                  fontSize: 11,
                  color: "var(--warn)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ⚠ Invite saved but email failed to send — share the link manually.
              </div>
            ) : (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "var(--bg-2)",
                  border: "1px dashed var(--rule)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  fontFamily: "var(--font-mono)",
                  lineHeight: 1.55,
                }}
              >
                <div style={{ color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--accent)" }}>✉</span> Subject: You&apos;re invited to &ldquo;{projectName}&rdquo; on ai·latex
                </div>
                <div style={{ opacity: 0.8, marginTop: 2 }}>
                  Invitees get a magic-link email — no password required.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending invitations */}
        {isOwner && invitations.length > 0 && (
          <div style={{ padding: "6px 8px 2px", borderBottom: "1px solid var(--rule)" }}>
            <div
              style={{
                padding: "6px 12px 4px",
                fontSize: 11,
                color: "var(--ink-3)",
                fontFamily: "var(--font-mono)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
              }}
            >
              Pending invitations · {invitations.length}
            </div>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 12px",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "var(--bg-3)",
                    border: "1px solid var(--rule)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--ink-3)",
                    flexShrink: 0,
                  }}
                >
                  <Mail size={13} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inv.email}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
                    {inv.role} · sent {timeAgo(inv.created_at)}
                  </div>
                </div>
                <button
                  className="btn ghost sm"
                  onClick={() => handleRevoke(inv.id)}
                  style={{ fontSize: 11, color: "var(--err)" }}
                >
                  Withdraw
                </button>
              </div>
            ))}
          </div>
        )}

        {/* People list */}
        <div style={{ flex: 1, overflow: "auto", padding: "8px 8px 4px" }}>
          <div
            style={{
              padding: "6px 12px 4px",
              fontSize: 11,
              color: "var(--ink-3)",
              fontFamily: "var(--font-mono)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
            }}
          >
            People with access · {members.length}
          </div>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent)" }} />
            </div>
          ) : (
            members.map((m) => {
              const isSelf = m.user_id === user?.id;
              const color = nameToColor(m.name || m.email);
              const initials = (m.name || m.email).slice(0, 2).toUpperCase();
              return (
                <div
                  key={m.user_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 12px",
                    borderRadius: 8,
                    transition: "background .12s var(--ease)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 5%, transparent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: color,
                      color: "white",
                      fontWeight: 700,
                      fontSize: 11,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {m.name || m.email}
                      {isSelf && (
                        <span style={{ fontSize: 10, color: "var(--ink-4)" }}>(you)</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                      {m.email}
                    </div>
                  </div>
                  {m.role === "owner" ? (
                    <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", padding: "4px 10px" }}>
                      owner
                    </span>
                  ) : isOwner ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--rule)",
                        background: "transparent",
                        color: "var(--ink-2)",
                        font: "500 12px var(--font-ui)",
                        cursor: "pointer",
                      }}
                    >
                      {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      <option value="remove">Remove access</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", padding: "4px 10px" }}>
                      {m.role}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Link access */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--rule)", background: "var(--bg-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "var(--bg)",
                border: "1px solid var(--rule)",
                display: "grid",
                placeItems: "center",
                color: "var(--ink-2)",
                flexShrink: 0,
              }}
            >
              {linkAccess === "restricted" ? <Lock size={15} /> : <Globe size={15} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {linkAccess === "restricted"
                  ? "Restricted"
                  : linkAccess === "anyone-view"
                  ? "Anyone with the link can view"
                  : "Anyone with the link can comment"}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {linkAccess === "restricted"
                  ? "Only invited people can open this project"
                  : "No sign-in required"}
              </div>
            </div>
            <select
              value={linkAccess}
              onChange={(e) => setLinkAccess(e.target.value as typeof linkAccess)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--rule)",
                background: "var(--bg)",
                color: "var(--ink)",
                font: "500 12px var(--font-ui)",
                cursor: "pointer",
              }}
            >
              <option value="restricted">Restricted</option>
              <option value="anyone-view">Anyone · view</option>
              <option value="anyone-comment">Anyone · comment</option>
            </select>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              background: "var(--bg)",
              border: "1px solid var(--rule)",
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            <span style={{ color: "var(--ink-4)" }}><Link2 size={14} /></span>
            <span
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--ink-2)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayLink}
            </span>
            <button
              className="btn sm"
              onClick={copyLink}
              style={copied ? { background: "var(--ok)", color: "white", borderColor: "var(--ok)" } : {}}
            >
              {copied ? <><Check size={12} /> Copied</> : <><Link2 size={12} /> Copy link</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
