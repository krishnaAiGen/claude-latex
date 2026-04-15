export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("claude_latex_token");
}

export function setToken(token: string): void {
  localStorage.setItem("claude_latex_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("claude_latex_token");
}

export function getStoredUser(): { id: string; email: string; name: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("claude_latex_user");
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: { id: string; email: string; name: string }): void {
  localStorage.setItem("claude_latex_user", JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem("claude_latex_user");
}
