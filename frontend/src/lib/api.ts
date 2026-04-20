import { getToken } from "@/lib/auth";
import type {
  FileNode, Project, DocumentDraft, DocumentVersion,
  ProjectMember, Comment, MemberDraft,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function jsonAuthHeaders(): Record<string, string> {
  return { ...authHeaders(), "Content-Type": "application/json" };
}

// Auth APIs

export async function loginApi(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Login failed");
  }
  return res.json();
}

export async function googleAuthApi(credential: string) {
  const res = await fetch(`${API_BASE}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Google sign-in failed" }));
    throw new Error(err.detail || "Google sign-in failed");
  }
  return res.json();
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// Project APIs

export async function listProjects(): Promise<{ projects: Project[] }> {
  const res = await fetch(`${API_BASE}/api/projects`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to list projects");
  return res.json();
}

export async function createProject(name: string, description?: string): Promise<{ project: Project }> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export async function deleteProject(projectId: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// Document APIs (project-scoped)

export async function fetchDocument(projectId: string): Promise<{
  latex_content: string;
  last_modified: string;
}> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/document`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function updateDocument(projectId: string, latex_content: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/document`, {
    method: "PUT",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ latex_content }),
  });
}

export async function compileDocument(projectId: string, latex_content: string) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/compile`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ latex_content }),
  });
  if (!res.ok) throw new Error("Compilation request failed");
  return res.json();
}

export function getPdfUrl(projectId: string): string {
  const token = getToken() || "";
  return `${API_BASE}/api/projects/${projectId}/pdf?token=${encodeURIComponent(token)}`;
}

// File management APIs (project-scoped)

export async function fetchFileTree(projectId: string): Promise<{ files: FileNode[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/files`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch file tree");
  return res.json();
}

export async function readFile(projectId: string, path: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/files/${encodeURIComponent(path)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to read file");
  const data = await res.json();
  return data.content;
}

export async function writeFile(projectId: string, path: string, content: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/files/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ content }),
  });
}

export async function createFile(projectId: string, name: string, parentPath: string = ""): Promise<string> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/files`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ name, parent_path: parentPath, type: "file" }),
  });
  const data = await res.json();
  return data.path;
}

export async function createFolder(projectId: string, name: string, parentPath: string = ""): Promise<string> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/files`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ name, parent_path: parentPath, type: "folder" }),
  });
  const data = await res.json();
  return data.path;
}

export async function deleteFile(projectId: string, path: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/files/${encodeURIComponent(path)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function uploadFile(projectId: string, file: File, parentPath: string = ""): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("parent_path", parentPath);
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/files/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  const data = await res.json();
  return data.path;
}

// Collaboration APIs

export async function getDraft(projectId: string): Promise<DocumentDraft> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/draft`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get draft");
  return res.json();
}

export async function saveDraft(projectId: string, content: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/draft`, {
    method: "PUT",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ content }),
  });
}

export async function getMemberDraft(projectId: string, memberUserId: string): Promise<{ content: string; forked_from_version: number; updated_at: string }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/members/${memberUserId}/draft`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get member draft");
  return res.json();
}

export async function generateDiffSummary(
  projectId: string,
  mainContent: string,
  draftContent: string,
): Promise<{ summary: string; diff_stats: { lines_added: number; lines_removed: number; sections_changed: string[] } }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/draft/summary`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ main_content: mainContent, draft_content: draftContent }),
  });
  if (!res.ok) throw new Error("Failed to generate summary");
  return res.json();
}

export async function pushToMain(
  projectId: string,
  aiSummary: string,
): Promise<{ version_number: number }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/push`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ ai_summary: aiSummary }),
  });
  if (!res.ok) throw new Error("Failed to push to main");
  return res.json();
}

export async function getVersionHistory(projectId: string): Promise<{ versions: DocumentVersion[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/history`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get version history");
  return res.json();
}

export async function getVersion(projectId: string, versionId: string): Promise<{ content: string; version_number: number }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/history/${versionId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get version");
  return res.json();
}

export async function restoreVersion(projectId: string, versionId: string): Promise<{ version_number: number }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/history/${versionId}/restore`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to restore version");
  return res.json();
}

export async function getProjectMembers(projectId: string): Promise<{ members: ProjectMember[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/members`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get members");
  return res.json();
}

export async function inviteToProject(projectId: string, email: string, role: string): Promise<{ token: string | null; invite_url: string | null; email_sent: boolean }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/invite`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) throw new Error("Failed to send invite");
  return res.json();
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function updateMemberRole(projectId: string, userId: string, role: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/members/${userId}`, {
    method: "PATCH",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ role }),
  });
}

export async function getProjectInvitations(projectId: string): Promise<{ invitations: import("./types").ProjectInvitation[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/invitations`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get invitations");
  return res.json();
}

export async function revokeInvitation(projectId: string, invitationId: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/invitations/${invitationId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function acceptInvitation(token: string): Promise<{ project_id: string; role: string }> {
  const res = await fetch(`${API_BASE}/api/invitations/accept?token=${encodeURIComponent(token)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to accept invitation");
  return res.json();
}

export async function getComments(projectId: string): Promise<{ comments: Comment[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/comments`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get comments");
  return res.json();
}

export async function createComment(
  projectId: string,
  content: string,
  lineNumber?: number,
  parentId?: string,
): Promise<Comment> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/comments`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ content, line_number: lineNumber, parent_id: parentId }),
  });
  if (!res.ok) throw new Error("Failed to create comment");
  return res.json();
}

export async function resolveComment(projectId: string, commentId: string, resolved = true): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/comments/${commentId}`, {
    method: "PATCH",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ resolved }),
  });
}

export async function deleteComment(projectId: string, commentId: string): Promise<void> {
  await fetch(`${API_BASE}/api/projects/${projectId}/comments/${commentId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function getMemberDrafts(projectId: string): Promise<{ member_drafts: MemberDraft[] }> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/member-drafts`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to get member drafts");
  return res.json();
}

export async function listSharedProjects(): Promise<{ projects: Project[]; shared_projects: Project[] }> {
  const res = await fetch(`${API_BASE}/api/projects`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to list projects");
  return res.json();
}

// Chat APIs (project-scoped)

export async function fetchChatMessages(projectId: string) {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/chat/messages`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch chat messages");
  return res.json();
}

export async function saveChatMessage(projectId: string, role: string, content: string, context?: object) {
  await fetch(`${API_BASE}/api/projects/${projectId}/chat/messages`, {
    method: "POST",
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ role, content, context }),
  });
}

export async function clearChatMessages(projectId: string) {
  await fetch(`${API_BASE}/api/projects/${projectId}/chat/messages`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
