import { getToken } from "@/lib/auth";
import type { FileNode, Project } from "@/lib/types";

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
