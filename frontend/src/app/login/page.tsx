"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { loginApi } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useEditorStore((s) => s.setAuth);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        const data = await loginApi(email, password);
        setAuth(data.user, data.token);
        router.push("/dashboard");
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Login failed");
      } finally {
        setLoading(false);
      }
    },
    [email, password, setAuth, router]
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-lg border animate-fadeInUp"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-6">
          <FileText size={28} style={{ color: "var(--accent)" }} />
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Claude LaTeX Editor
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 rounded border text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-primary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--error)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent)",
              color: "white",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Signing in...
              </span>
            ) : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
