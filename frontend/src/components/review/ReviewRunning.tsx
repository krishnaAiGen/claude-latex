"use client";

import { useEffect, useState, useRef } from "react";
import { useEditorStore } from "@/store/editorStore";
import { REVIEW_AGENTS } from "@/lib/reviewConstants";
import { startReview, getReview } from "@/lib/api";
import { getToken } from "@/lib/auth";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

interface AgentState {
  status: "pending" | "running" | "done" | "error";
  displayProgress: number;
  sub: string;
  paper: string | null;
  findingsDone: number;
  durationMs: number | null;
}

interface LogEntry {
  t: string;   // agent id or "pipeline"
  m: string;   // message
}

interface Props {
  projectId: string;
}

export default function ReviewRunning({ projectId }: Props) {
  const { reviewConfig, setReviewResults } = useEditorStore();
  const venueName = reviewConfig?.venue || "Custom venue";

  const initState = () =>
    REVIEW_AGENTS.reduce<Record<string, AgentState>>((a, g) => ({
      ...a,
      [g.id]: { status: "pending", displayProgress: 0, sub: "waiting…", paper: null, findingsDone: 0, durationMs: null },
    }), {});

  const [t, setT] = useState(0);
  const [agentState, setAgentState] = useState<Record<string, AgentState>>(initState);
  const [metaState, setMetaState] = useState({ progress: 0, sub: "waiting for agents…" });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [pipelinePct, setPipelinePct] = useState(0);
  const [benchmarkCount, setBenchmarkCount] = useState(0);
  const completedRef = useRef(false);
  const startedRef = useRef(false);
  const reviewIdRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Tick: smooth animation for progress rings ───────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      setT(x => x + 1);
      setAgentState(prev => {
        const next = { ...prev };
        REVIEW_AGENTS.forEach(a => {
          const s = { ...prev[a.id] };
          if (s.status === "running") {
            // Creep toward 85% while running (real done comes from backend)
            s.displayProgress = Math.min(85, s.displayProgress + 0.3 + Math.random() * 0.5);
          } else if (s.status === "done" || s.status === "error") {
            // Snap to 100
            s.displayProgress = Math.min(100, s.displayProgress + 8);
          }
          // pending agents stay at 0
          next[a.id] = s;
        });
        return next;
      });
    }, 220);
    return () => clearInterval(iv);
  }, []);

  // ── Start review + WebSocket on mount ───────────────────────────────────
  useEffect(() => {
    if (!reviewConfig) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function kickOff() {
      try {
        const { review_id } = await startReview(projectId, reviewConfig!);
        if (cancelled) return;
        reviewIdRef.current = review_id;

        const token = getToken() || "";
        const ws = new WebSocket(
          `${WS_BASE}/api/reviews/${review_id}/stream?token=${encodeURIComponent(token)}`
        );
        wsRef.current = ws;

        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data as string);

            // Always update pipeline pct
            if (typeof data.pct === "number") setPipelinePct(data.pct);

            switch (data.type) {
              case "pipeline":
                setLog(L => [{ t: "pipeline", m: data.message }, ...L]);
                break;

              case "benchmark_paper":
                setBenchmarkCount(c => c + 1);
                setLog(L => [{ t: "pipeline", m: data.message }, ...L]);
                break;

              case "benchmark":
                setBenchmarkCount(data.count || 0);
                setLog(L => [{ t: "pipeline", m: data.message }, ...L]);
                break;

              case "agent_start":
                setAgentState(prev => ({
                  ...prev,
                  [data.agent]: {
                    ...prev[data.agent],
                    status: "running",
                    sub: data.message,
                  },
                }));
                setLog(L => [{ t: data.agent, m: data.message }, ...L]);
                break;

              case "agent_done": {
                const findings = data.findings || [];
                const firstBenchmark = findings.length > 0
                  ? (findings[0].relatedBenchmarks?.[0] || null)
                  : null;

                setAgentState(prev => ({
                  ...prev,
                  [data.agent]: {
                    ...prev[data.agent],
                    status: "done",
                    displayProgress: 100,
                    findingsDone: data.finding_count || findings.length,
                    durationMs: data.duration_ms || null,
                    sub: data.message,
                    paper: firstBenchmark,
                  },
                }));

                // Add each finding as a real log entry
                const findingLogs: LogEntry[] = findings.map((f: { severity: string; title: string }) => ({
                  t: data.agent,
                  m: `[${f.severity}] ${f.title}`,
                }));
                setLog(L => [...findingLogs, ...L]);
                break;
              }

              case "agent_error":
                setAgentState(prev => ({
                  ...prev,
                  [data.agent]: {
                    ...prev[data.agent],
                    status: "error",
                    sub: data.message,
                  },
                }));
                setLog(L => [{ t: data.agent, m: data.message }, ...L]);
                break;

              case "meta_start":
                setMetaState({ progress: 20, sub: data.message });
                setLog(L => [{ t: "pipeline", m: data.message }, ...L]);
                break;

              case "meta_done":
                setMetaState({ progress: 100, sub: data.message });
                setLog(L => [{ t: "pipeline", m: data.message }, ...L]);
                break;

              case "done":
                if (!completedRef.current) {
                  completedRef.current = true;
                  setLog(L => [{ t: "pipeline", m: data.message }, ...L]);
                  getReview(projectId, review_id).then(result => {
                    setReviewResults(
                      result.findings,
                      result.dimension_scores,
                      result.meta,
                      result.benchmarks,
                    );
                  }).catch(console.error);
                }
                break;

              case "error":
                setLog(L => [{ t: "pipeline", m: `ERROR: ${data.message}` }, ...L]);
                break;

              default:
                // Backward compat: old format without type field
                if (data.event) {
                  setLog(L => [{ t: "pipeline", m: data.event }, ...L]);
                }
                break;
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onerror = () => {
          console.warn("[ReviewRunning] WebSocket error");
        };
      } catch (err) {
        console.error("[ReviewRunning] Failed to start review:", err);
      }
    }

    kickOff();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalFindings = Object.values(agentState).reduce((a, s) => a + s.findingsDone, 0);
  const displayBenchmarks = benchmarkCount > 0 ? benchmarkCount : 20;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--rule)", background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase" }}>
            reviewing against
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginTop: 1 }}>
            {venueName} · {displayBenchmarks} benchmark papers
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>{totalFindings} findings drafted</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-4)" }}>{(t * 0.22).toFixed(1)}s elapsed</div>
          </div>
          <button className="btn sm">■ Cancel</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "24px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20, minHeight: 0 }}>
        {/* Left: agents + meta */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 2 }}>
            4 agents + meta · running in parallel
          </div>
          {REVIEW_AGENTS.map(a => {
            const s = agentState[a.id];
            const done = s.status === "done";
            const hasError = s.status === "error";
            return (
              <div key={a.id} className="card" style={{
                padding: 14,
                borderColor: done ? a.color : hasError ? "#e53e3e" : "var(--rule)",
                background: done ? `color-mix(in oklab, ${a.color} 4%, var(--bg-2))` : "var(--bg-2)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  {/* Circular progress ring */}
                  <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0 }}>
                    <svg width="26" height="26" viewBox="0 0 26 26" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="13" cy="13" r="10" fill="none" stroke="var(--rule)" strokeWidth="2.5" />
                      <circle cx="13" cy="13" r="10" fill="none" stroke={hasError ? "#e53e3e" : a.color} strokeWidth="2.5"
                        strokeDasharray={`${(s.displayProgress / 100) * 62.8} 62.8`}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray .22s" }}
                      />
                    </svg>
                    {done && (
                      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 10, color: a.color, fontWeight: 900 }}>✓</span>
                    )}
                    {hasError && (
                      <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 10, color: "#e53e3e", fontWeight: 900 }}>✗</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{a.label}</span>
                      <span style={{ fontSize: 11, color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>{a.blurb}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 8 }}>
                      {s.status === "running" && (
                        <span style={{ display: "inline-flex", gap: 2 }}>
                          {[0, 1, 2].map(i => (
                            <span key={i} className="thinking-dot" style={{ background: a.color, width: 5, height: 5, borderRadius: "50%", animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                      )}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{s.sub}</span>
                      {s.paper && done && (
                        <span className="chip" style={{ fontSize: 10, padding: "1px 6px", borderColor: a.color, color: a.color }}>{s.paper}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: done ? a.color : "var(--ink-3)", fontWeight: 600 }}>
                    {done
                      ? `${s.findingsDone} findings`
                      : hasError
                      ? "failed"
                      : s.status === "running"
                      ? `${Math.round(s.displayProgress)}%`
                      : "—"}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Meta-reviewer */}
          <div className="card" style={{ padding: 14, borderColor: "var(--ink-3)", background: "var(--bg-2)", marginTop: 6, borderStyle: "dashed" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6,
                background: "conic-gradient(from 200deg, var(--accent), var(--accent-2), var(--accent-3), #7C6CF6, var(--accent))",
                opacity: metaState.progress > 0 ? 1 : 0.3,
                display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 11, flexShrink: 0,
              }}>Σ</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                  Meta-reviewer{" "}
                  <span style={{ color: "var(--ink-4)", fontWeight: 400, fontSize: 11, fontFamily: "var(--font-mono)", marginLeft: 4 }}>
                    synthesizes the four into a recommendation
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, fontFamily: "var(--font-mono)" }}>{metaState.sub}</div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: metaState.progress >= 100 ? "var(--accent)" : "var(--ink-3)", fontWeight: 600 }}>
                {metaState.progress >= 100 ? "✓" : `${Math.round(metaState.progress)}%`}
              </div>
            </div>
          </div>
        </div>

        {/* Right: live event stream */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
            live stream · {log.length} events
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "2px 2px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
            {log.map((e, i) => {
              const agent = REVIEW_AGENTS.find(x => x.id === e.t);
              const color = agent?.color ?? "var(--ink-3)";
              const label = agent?.label ?? "Pipeline";
              return (
                <div key={i} className="fadein" style={{
                  display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                  background: "var(--bg-2)", border: "1px solid var(--rule)",
                  borderLeft: `3px solid ${color}`, borderRadius: 6,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
                    color: color, fontFamily: "var(--font-mono)",
                    padding: "2px 6px", background: `color-mix(in oklab, ${color} 10%, transparent)`,
                    borderRadius: 3, flexShrink: 0,
                  }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>{e.m}</span>
                </div>
              );
            })}
            {log.length === 0 && (
              <div style={{ color: "var(--ink-4)", fontSize: 12, padding: 20, textAlign: "center" }}>
                connecting to pipeline…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
