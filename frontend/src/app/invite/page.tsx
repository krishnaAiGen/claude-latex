"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { acceptInvitation } from "@/lib/api";

export default function InvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token: authToken } = useEditorStore();
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [message, setMessage] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid invitation link.");
      return;
    }

    if (!authToken) {
      // Save token and redirect to login
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pending_invite", token);
      }
      router.push("/login");
      return;
    }

    acceptInvitation(token)
      .then((data) => {
        setStatus("done");
        setMessage(`You've joined the project as ${data.role}.`);
        setTimeout(() => router.push(`/editor/${data.project_id}`), 1500);
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e.message || "Failed to accept invitation.");
      });
  }, [token, authToken, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="card animate-fadeIn"
        style={{ width: 360, padding: 32, textAlign: "center" }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--r-lg)",
            background: "conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 16px",
            fontSize: 22,
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            color: "white",
          }}
        >
          C
        </div>

        {status === "loading" && (
          <>
            <Loader2 size={28} className="animate-spin mx-auto" style={{ color: "var(--accent)", marginBottom: 12 }} />
            <p style={{ fontSize: 14, color: "var(--ink-3)" }}>Accepting invitation…</p>
          </>
        )}

        {status === "done" && (
          <>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--ok)", marginBottom: 8 }}>
              Invitation accepted!
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{message}</p>
            <p style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 8 }}>Redirecting…</p>
          </>
        )}

        {status === "error" && (
          <>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--err)", marginBottom: 8 }}>
              Invitation failed
            </p>
            <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16 }}>{message}</p>
            <button onClick={() => router.push("/dashboard")} className="btn accent sm">
              Go to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
