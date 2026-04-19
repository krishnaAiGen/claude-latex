"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon } from "lucide-react";
import { loginApi, googleAuthApi } from "@/lib/api";
import { GoogleLogin } from "@react-oauth/google";
import { useEditorStore } from "@/store/editorStore";

// ── Demo scenes for AssistantDemo ──────────────────────────────
const DEMO_SCENES = [
  {
    label: "rewrite · theorem 3.2",
    prompt: "Rewrite Maxwell's equations more compactly",
    before: "\\nabla \\cdot \\mathbf{E} = \\tfrac{\\rho}{\\varepsilon_0}, \\quad \\nabla \\times \\mathbf{B} - \\mu_0\\varepsilon_0 \\tfrac{\\partial \\mathbf{E}}{\\partial t} = \\mu_0 \\mathbf{J}",
    after:  "\\partial_\\mu F^{\\mu\\nu} = \\mu_0\\, J^{\\nu}",
    note: "Folded into covariant form",
    kind: "math",
  },
  {
    label: "tighten · introduction",
    prompt: "Tighten this paragraph",
    before: "In this paper, we attempt to carefully investigate, in some detail, the many various properties of hexagonal lattices under weak magnetic fields.",
    after:  "We study hexagonal lattices under weak magnetic fields.",
    note: "Cut 18 words · clarity +42%",
    kind: "prose",
  },
  {
    label: "prove · lemma 1",
    prompt: "Sketch a proof",
    before: "\\text{Lemma 1: } \\|x\\|_2 \\leq \\|x\\|_1 \\leq \\sqrt{n}\\,\\|x\\|_2",
    after:  "\\|x\\|_1 \\leq \\sqrt{n}\\,\\sqrt{\\sum_i x_i^2} = \\sqrt{n}\\,\\|x\\|_2",
    note: "Cauchy–Schwarz applied",
    kind: "math",
  },
];

// ── Typed text animation ───────────────────────────────────────
function Typed({ text, speed = 22, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i++; setN(i);
      if (i >= text.length) { clearInterval(id); onDone?.(); }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, onDone]);
  return <span>{text.slice(0, n)}<span className="caret" /></span>;
}

// ── KaTeX line renderer ────────────────────────────────────────
function KatexLine({ expr, prose }: { expr: string; prose?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const render = async () => {
      try {
        const katex = (await import("katex")).default;
        if (ref.current) katex.render(expr, ref.current, { throwOnError: false, displayMode: true });
      } catch { if (ref.current) ref.current.textContent = expr; }
    };
    if (!prose) render();
  }, [expr, prose]);
  if (prose) return (
    <div style={{ fontFamily: "var(--font-serif)", fontSize: 16, lineHeight: 1.5, color: "var(--ink)" }}>
      {expr}
    </div>
  );
  return <div ref={ref} style={{ fontSize: 16 }} />;
}

// ── AssistantDemo ──────────────────────────────────────────────
function AssistantDemo() {
  const [scene, setScene] = useState(0);
  const [phase, setPhase] = useState<"prompt" | "thinking" | "diff" | "done">("prompt");
  const s = DEMO_SCENES[scene];

  useEffect(() => {
    if (phase === "done") {
      const t = setTimeout(() => { setScene(x => (x + 1) % DEMO_SCENES.length); setPhase("prompt"); }, 2600);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "thinking") {
      const t = setTimeout(() => setPhase("diff"), 1100);
      return () => clearTimeout(t);
    }
    if (phase === "diff") {
      const t = setTimeout(() => setPhase("done"), 2200);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const prose = s.kind === "prose";

  return (
    <div className="card rise" style={{ padding: 0, maxWidth: 520, position: "relative", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderBottom: "1px solid var(--rule)",
        background: "color-mix(in oklab, var(--accent) 5%, transparent)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--ink-3)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: "conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))" }} />
          <span>{s.label}</span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {DEMO_SCENES.map((_, i) => (
            <span key={i} style={{
              width: i === scene ? 12 : 4, height: 4, borderRadius: 2,
              background: i === scene ? "var(--accent)" : "color-mix(in oklab, var(--ink) 18%, transparent)",
              transition: "all .4s var(--ease)",
            }} />
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "flex-start", gap: 8, minHeight: 46 }}>
        <div style={{ width: 20, height: 20, borderRadius: 5, background: "var(--ink)", color: "var(--bg)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>AL</div>
        <div style={{ flex: 1, fontSize: 13, color: "var(--ink)", fontFamily: "var(--font-ui)", lineHeight: 1.5, minHeight: 18 }}>
          {phase === "prompt" ? <Typed key={scene} text={s.prompt} onDone={() => setTimeout(() => setPhase("thinking"), 380)} /> : <span>{s.prompt}</span>}
        </div>
      </div>

      {/* Before / After */}
      <div style={{ padding: "12px 14px 8px" }}>
        <div style={{
          position: "relative", padding: "8px 10px", borderRadius: 7,
          background: phase === "prompt" ? "color-mix(in oklab, var(--ink) 4%, transparent)" : "color-mix(in oklab, var(--err) 10%, transparent)",
          border: "1px dashed " + (phase === "prompt" ? "var(--rule)" : "color-mix(in oklab, var(--err) 40%, var(--rule))"),
          transition: "all .4s var(--ease)",
          opacity: phase === "done" ? 0.5 : 1,
          textDecoration: (phase === "diff" || phase === "done") ? "line-through" : "none",
          textDecorationColor: "color-mix(in oklab, var(--err) 60%, transparent)",
          textDecorationThickness: "2px",
        }}>
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--ink-3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>before</div>
          <KatexLine expr={s.before} prose={prose} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 24, gap: 6 }}>
          {phase === "thinking" ? (
            <><span className="td" /><span className="td" /><span className="td" /><span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>AI is editing…</span></>
          ) : (phase === "diff" || phase === "done") ? (
            <div className="fadein" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>
              <div className="prism-bar" style={{ width: 32 }} />
              applied
              <div className="prism-bar" style={{ width: 32 }} />
            </div>
          ) : <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-4)" }}>↓</span>}
        </div>

        <div style={{
          padding: "8px 10px", borderRadius: 7,
          background: (phase === "diff" || phase === "done") ? "color-mix(in oklab, var(--ok) 12%, transparent)" : "color-mix(in oklab, var(--ink) 4%, transparent)",
          border: "1px solid " + ((phase === "diff" || phase === "done") ? "color-mix(in oklab, var(--ok) 40%, var(--rule))" : "var(--rule)"),
          transition: "all .45s var(--spring)",
          transform: (phase === "diff" || phase === "done") ? "translateY(0)" : "translateY(4px)",
          opacity: (phase === "diff" || phase === "done") ? 1 : 0.4,
          filter: (phase === "diff" || phase === "done") ? "none" : "blur(2px)",
        }}>
          <div style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--ink-3)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
            <span>after</span>
            {(phase === "diff" || phase === "done") && <span style={{ color: "var(--ok)" }}>✓ {s.note}</span>}
          </div>
          {(phase === "diff" || phase === "done") ? <KatexLine key={scene + "-after"} expr={s.after} prose={prose} /> : <div style={{ height: 20 }} />}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderTop: "1px solid var(--rule)", background: "var(--bg-2)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
        <span>main.tex · line 42</span>
        <span className="prism-text" style={{ fontWeight: 600 }}>◆ AI · Sonnet 4.6</span>
      </div>

      {phase === "thinking" && <div className="prism-bar" style={{ position: "absolute", top: 0, left: 0, right: 0 }} />}
    </div>
  );
}

// ── Login Page ─────────────────────────────────────────────────
export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const setAuth = useEditorStore((s) => s.setAuth);
  const theme = useEditorStore((s) => s.theme);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);

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
    <div className="page paper-bg" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", minHeight: "100vh", position: "relative" }}>
      <button
        onClick={toggleTheme}
        className="btn ghost icon"
        style={{ position: "absolute", top: 16, right: 16, zIndex: 10 }}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun size={15} style={{ color: "var(--warn)" }} /> : <Moon size={15} style={{ color: "var(--ink-3)" }} />}
      </button>
      {/* LEFT — editorial */}
      <div style={{ position: "relative", padding: "32px 40px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="grid-lines" style={{ position: "absolute", inset: 0, opacity: 0.5, maskImage: "radial-gradient(ellipse at 30% 40%, black, transparent 70%)" }} />

        <div className="mark" style={{ position: "relative", zIndex: 1 }}>
          <div className="mark-glyph"><span>C</span></div>
          <div className="mark-name">ai<em>·latex</em></div>
        </div>

        <div style={{ flex: 1, display: "grid", alignContent: "center", position: "relative", zIndex: 1, paddingRight: 40, maxWidth: 640 }}>
          <div className="rule-label" style={{ marginBottom: 20 }}>
            <span>Write · Prove · Publish</span>
          </div>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(40px, 5vw, 68px)",
            lineHeight: 1.08, letterSpacing: "-0.02em", margin: "0 0 24px",
            color: "var(--ink)",
          }}>
            Write papers<br />
            <em style={{ fontStyle: "italic", color: "var(--ink-3)" }}>the way you</em>{" "}
            <span className="prism-text">think</span>.
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 16, lineHeight: 1.55, maxWidth: 480, margin: "0 0 28px" }}>
            A LaTeX editor with AI next to your cursor — rewriting equations,
            tightening prose, and citing your sources without leaving the page.
          </p>

          <AssistantDemo />

          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
            {["BibTeX aware", "Live compile", "Selection → AI", "AI chat"].map(t => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </div>

        <footer style={{ color: "var(--ink-4)", fontSize: 11, display: "flex", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
          <span>© 2026 · ai·latex</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>v1.0.0</span>
        </footer>
      </div>

      {/* RIGHT — auth card */}
      <div style={{ display: "grid", placeItems: "center", padding: 32, background: "linear-gradient(180deg, transparent, color-mix(in oklab, var(--accent) 4%, transparent))" }}>
        <form onSubmit={handleSubmit} className="card rise" style={{ width: "min(400px, 100%)", padding: 28, position: "relative" }}>

          {/* Tab switcher */}
          <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--bg-2)", borderRadius: 10, marginBottom: 20 }}>
            {([["signin", "Sign in"], ["signup", "Create account"]] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                style={{
                  flex: 1, padding: "7px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: mode === k ? "var(--paper)" : "transparent",
                  color: mode === k ? "var(--ink)" : "var(--ink-3)",
                  boxShadow: mode === k ? "var(--shadow-1)" : "none",
                  fontWeight: 600, fontSize: 13, transition: "all .18s var(--ease)",
                }}
              >{l}</button>
            ))}
          </div>

          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 28, lineHeight: 1.1, margin: "0 0 4px", letterSpacing: "-0.01em", color: "var(--ink)" }}>
            {mode === "signin" ? "Welcome back." : "Start a draft."}
          </h2>
          <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
            {mode === "signin" ? "Pick up where you left off." : "Free to use. No card required."}
          </p>

          <label style={{ display: "block", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>Email</div>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="ada@analytic-engine.org"
            />
          </label>

          <label style={{ display: "block", marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>Password</div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p style={{ fontSize: 12, color: "var(--err)", marginTop: 8 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px", marginTop: 16 }}
          >
            {loading ? (
              <><span className="td" /><span className="td" /><span className="td" /></>
            ) : (
              <>{mode === "signin" ? "Sign in" : "Create account"} →</>
            )}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: "var(--ink-4)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
            <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
            OR CONTINUE WITH
            <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <button type="button" className="btn" style={{ justifyContent: "center" }}>ORCID</button>
            <div style={{ position: "relative" }}>
              <button type="button" disabled={googleLoading} className="btn"
                style={{ justifyContent: "center", width: "100%", opacity: googleLoading ? 0.6 : 1 }}>
                {googleLoading ? <><span className="td" /><span className="td" /><span className="td" /></> : "Google"}
              </button>
              <div style={{ position: "absolute", inset: 0, opacity: 0, overflow: "hidden" }}>
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    if (!credentialResponse.credential) return;
                    setGoogleLoading(true);
                    setError("");
                    try {
                      const data = await googleAuthApi(credentialResponse.credential);
                      setAuth(data.user, data.token);
                      router.push("/dashboard");
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : "Google sign-in failed");
                    } finally {
                      setGoogleLoading(false);
                    }
                  }}
                  onError={() => { setError("Google sign-in failed"); setGoogleLoading(false); }}
                  useOneTap={false}
                  width="100%"
                />
              </div>
            </div>
          </div>

          <p style={{ color: "var(--ink-4)", fontSize: 11, marginTop: 16, textAlign: "center" }}>
            By continuing you agree to our <a style={{ color: "var(--ink-2)" }} href="#">terms</a> and <a style={{ color: "var(--ink-2)" }} href="#">privacy</a>.
          </p>
        </form>
      </div>
    </div>
  );
}
