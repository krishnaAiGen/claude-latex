"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Send, Plus, Clock } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { useChat } from "@/hooks/useChat";
import { REVIEW_AGENTS, PAPER_SECTIONS } from "@/lib/reviewConstants";

interface ChatMsg {
  id: number;
  who: "me" | "ai";
  body: string;
  contextChips?: { label: string; sub: string }[];
  actions?: { label: string; primary?: boolean }[];
}

interface MentionState {
  kind: "F" | "B" | "S";
  query: string;
  pos: number;
}

// Parse @F1, @B12, @section mentions into styled chips
function MentionChip({ id, label, color }: { id: string; label: string; color: string }) {
  return (
    <span
      title={label}
      style={{
        display: "inline-flex", alignItems: "baseline", padding: "1px 6px", margin: "0 1px",
        fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600,
        background: `color-mix(in oklab, ${color} 12%, transparent)`,
        color, borderRadius: 4, verticalAlign: "baseline",
        border: `1px solid color-mix(in oklab, ${color} 25%, transparent)`,
        whiteSpace: "nowrap", cursor: "pointer",
      }}
    >
      @{id}
    </span>
  );
}

function ReviewChatMessage({ m, findings, benchmarks }: {
  m: ChatMsg;
  findings: { id: string; title: string; agent: string }[];
  benchmarks: { id: string; title: string }[];
}) {
  const parts = (m.body || "").split(/(@F\d+|@B\d+|@(?:abstract|introduction|related|method|experiments|ablations|conclusion))/gi).filter(Boolean);
  return (
    <div
      className="fadein"
      style={{
        padding: "14px", borderBottom: "1px solid var(--rule)",
        background: m.who === "me" ? "color-mix(in oklab, var(--accent-3) 4%, var(--bg))" : "var(--bg)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          display: "grid", placeItems: "center", color: "white", fontSize: 11, fontWeight: 700,
          background: m.who === "me"
            ? "var(--ink)"
            : "conic-gradient(from 200deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
        }}>
          {m.who === "me" ? "Y" : "◆"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 5 }}>
            {m.who === "me" ? "you" : "review assistant"}
          </div>
          {m.contextChips && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {m.contextChips.map((c, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: "3px 8px", borderRadius: 4,
                  background: "color-mix(in oklab, var(--accent-3) 10%, transparent)",
                  color: "var(--accent-3)", fontFamily: "var(--font-mono)",
                  border: "1px solid color-mix(in oklab, var(--accent-3) 30%, transparent)",
                }}>
                  {c.label} <span style={{ color: "var(--ink-4)" }}>· {c.sub}</span>
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
            {parts.map((p, i) => {
              if (/^@F\d+$/i.test(p)) {
                const f = findings.find(x => x.id.toLowerCase() === p.slice(1).toLowerCase());
                if (f) {
                  const agent = REVIEW_AGENTS.find(a => a.id === f.agent);
                  return <MentionChip key={i} id={f.id} label={f.title} color={agent?.color ?? "var(--ink-3)"} />;
                }
              }
              if (/^@B\d+$/i.test(p)) {
                const b = benchmarks.find(x => x.id.toLowerCase() === p.slice(1).toLowerCase());
                if (b) return <MentionChip key={i} id={b.id} label={b.title} color="var(--accent-3)" />;
              }
              if (/^@(abstract|introduction|related|method|experiments|ablations|conclusion)$/i.test(p)) {
                const s = PAPER_SECTIONS.find(x => x.id === p.slice(1).toLowerCase());
                if (s) return <MentionChip key={i} id={p.slice(1)} label={s.label} color="var(--ink-3)" />;
              }
              return <span key={i}>{p}</span>;
            })}
          </div>
          {m.actions && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {m.actions.map((a, i) => (
                <button
                  key={i}
                  className="btn sm"
                  style={{
                    background: a.primary ? "var(--accent-3)" : "transparent",
                    color: a.primary ? "white" : "var(--ink-2)",
                    borderColor: a.primary ? "var(--accent-3)" : "var(--rule)",
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


const QUICK_ASKS = [
  "Why is @F1 critical?",
  "Show how @B12 handled client drift",
  "Draft rebuttal for @F4",
  "Which 3 benchmarks are closest to my approach?",
];

export default function ReviewChat() {
  const {
    reviewFindings,
    reviewBenchmarkPapers,
    messages: storeMessages,
    isAgentProcessing,
  } = useEditorStore();
  const { sendMessage } = useChat();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([{
    id: 1, who: "ai",
    body: "I have full context on your review — findings, benchmark papers, and your draft. Ask about a finding, a benchmark paper, or a paper section.",
    contextChips: [{ label: "Review assistant", sub: `${reviewFindings.length || 0} findings · ${reviewBenchmarkPapers.length || 0} benchmarks` }],
  }]);
  const [mention, setMention] = useState<MentionState | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const baselineLengthRef = useRef(storeMessages.length);

  // Watch for new AI responses from the real backend
  useEffect(() => {
    const newMsgs = storeMessages.slice(baselineLengthRef.current);
    const lastNew = newMsgs.filter(m => m.role === "assistant").at(-1);
    if (lastNew) {
      setMessages(prev => {
        if (prev.some(m => String(m.id) === lastNew.id)) return prev;
        return [...prev, { id: lastNew.id as unknown as number, who: "ai" as const, body: lastNew.content }];
      });
      baselineLengthRef.current = storeMessages.length;
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [storeMessages]);

  const mentionOptions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    if (mention.kind === "F") return reviewFindings.filter(f => f.id.toLowerCase().includes(q) || f.title.toLowerCase().includes(q)).slice(0, 6);
    if (mention.kind === "B") return reviewBenchmarkPapers.filter(p => p.id.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)).slice(0, 6);
    if (mention.kind === "S") return PAPER_SECTIONS.filter(s => s.id.includes(q) || s.label.toLowerCase().includes(q)).slice(0, 6);
    return [];
  }, [mention, reviewFindings, reviewBenchmarkPapers]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setInput(v);
    const cursor = e.target.selectionStart ?? v.length;
    const upto = v.slice(0, cursor);
    const m = upto.match(/(?:^|\s)@(F|B|section)([a-zA-Z0-9_]*)$/i);
    if (m) {
      const k = m[1].toUpperCase();
      setMention({ kind: k === "SECTION" ? "S" : (k as "F" | "B"), query: m[2], pos: cursor });
    } else {
      setMention(null);
    }
  }, []);

  const insertMention = useCallback((opt: { id: string }) => {
    if (!inputRef.current) return;
    const cursor = inputRef.current.selectionStart ?? input.length;
    const before = input.slice(0, cursor);
    const after = input.slice(cursor);
    const replaced = before.replace(/@(F|B|section)([a-zA-Z0-9_]*)$/i, `@${opt.id}`);
    setInput(replaced + " " + after);
    setMention(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [input]);

  const send = useCallback(() => {
    if (!input.trim() || isAgentProcessing) return;
    const userMsg: ChatMsg = { id: Date.now(), who: "me", body: input };
    setMessages(m => [...m, userMsg]);
    setInput("");
    setMention(null);
    // Inject review context so the AI knows about findings and benchmarks
    const ctx = reviewFindings.length > 0
      ? { selected_text: `[Review context: ${reviewFindings.length} findings, ${reviewBenchmarkPapers.length} benchmark papers]` }
      : undefined;
    sendMessage(input, ctx);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [input, isAgentProcessing, sendMessage, reviewFindings, reviewBenchmarkPapers]);

  return (
    <aside style={{ display: "flex", flexDirection: "column", minWidth: 0, background: "var(--bg)", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid var(--rule)", background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Review assistant</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
            {isAgentProcessing ? "thinking…" : "knows your review + benchmarks"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn ghost icon sm" title="New chat"><Plus size={14} /></button>
          <button className="btn ghost icon sm" title="History"><Clock size={14} /></button>
        </div>
      </div>

      {/* Context strip */}
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid var(--rule)", background: "var(--bg-2)",
        display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-3)",
      }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent-3)", boxShadow: "0 0 0 3px color-mix(in oklab, var(--accent-3) 20%, transparent)", flexShrink: 0 }} />
        <span>
          context: <b style={{ color: "var(--ink-2)" }}>your draft</b> ·{" "}
          <b style={{ color: "var(--ink-2)" }}>{reviewFindings.length} findings</b> ·{" "}
          <b style={{ color: "var(--ink-2)" }}>{reviewBenchmarkPapers.length} benchmarks</b>
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 0" }}>
        {messages.map(m => <ReviewChatMessage key={m.id} m={m} findings={reviewFindings} benchmarks={reviewBenchmarkPapers} />)}
        {isAgentProcessing && (
          <div className="fadein" style={{ padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: "conic-gradient(from 200deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))", flexShrink: 0 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-3)", fontSize: 13 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} className="thinking-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
                <span style={{ marginLeft: 6 }}>checking findings &amp; benchmarks…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick asks */}
      {messages.length < 3 && !isAgentProcessing && (
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>try asking</div>
          {QUICK_ASKS.map((q, i) => (
            <button
              key={i}
              onClick={() => setInput(q)}
              className="btn ghost sm"
              style={{ justifyContent: "flex-start", textAlign: "left", fontSize: 12, padding: "5px 8px", gap: 6 }}
            >
              <span style={{ color: "var(--ink-4)" }}>›</span>
              <span>
                {q.split(/(@[A-Za-z0-9]+)/).map((p, j) =>
                  p.startsWith("@")
                    ? <span key={j} style={{ color: "var(--accent-3)", fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{p}</span>
                    : <span key={j}>{p}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{ padding: 12, borderTop: "1px solid var(--rule)", background: "var(--bg-2)", position: "relative" }}>
        {/* Mention autocomplete */}
        {mention && mentionOptions.length > 0 && (
          <div className="fadein" style={{
            position: "absolute", left: 12, right: 12, bottom: "calc(100% - 2px)",
            background: "var(--bg)", border: "1px solid var(--rule)", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,.08)", padding: 4,
            maxHeight: 260, overflow: "auto", zIndex: 10,
          }}>
            <div style={{ fontSize: 10, color: "var(--ink-4)", fontFamily: "var(--font-mono)", padding: "4px 8px", letterSpacing: ".06em", textTransform: "uppercase" }}>
              {mention.kind === "F" ? "Findings" : mention.kind === "B" ? "Benchmark papers" : "Paper sections"}
            </div>
            {mentionOptions.map((opt: any) => {
              const color = mention.kind === "F"
                ? (REVIEW_AGENTS.find(x => x.id === opt.agent)?.color ?? "var(--ink-3)")
                : mention.kind === "B" ? "var(--accent-3)" : "var(--ink-3)";
              const label = mention.kind === "S" ? opt.label : opt.title;
              return (
                <button
                  key={opt.id}
                  onClick={() => insertMention(opt)}
                  style={{ width: "100%", padding: "6px 8px", borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, textAlign: "left" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in oklab, var(--ink) 4%, transparent)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, fontWeight: 700, minWidth: mention.kind === "S" ? 80 : 28 }}>
                    {mention.kind === "S" ? `@${opt.id}` : opt.id}
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ position: "relative" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={e => {
              if (mention && mentionOptions.length && e.key === "Tab") {
                e.preventDefault();
                insertMention(mentionOptions[0] as any);
                return;
              }
              if (e.key === "Escape" && mention) { e.preventDefault(); setMention(null); return; }
              if (e.key === "Enter" && !e.shiftKey && !mention) { e.preventDefault(); send(); }
            }}
            placeholder={isAgentProcessing ? "thinking…" : "Ask about the review. Use @F, @B, @section."}
            rows={2}
            className="textarea"
            style={{ fontFamily: "var(--font-ui)", paddingRight: 48, fontSize: 13 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || isAgentProcessing}
            className="btn accent icon"
            style={{
              position: "absolute", right: 8, bottom: 8,
              background: "var(--accent-3)", borderColor: "var(--accent-3)",
              opacity: (!input.trim() || isAgentProcessing) ? 0.4 : 1,
            }}
          >
            <Send size={13} />
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 11, color: "var(--ink-4)" }}>
          <span>
            Mentions:{" "}
            <span className="kbd">@F</span>{" "}
            <span className="kbd">@B</span>{" "}
            <span className="kbd">@section</span>
          </span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{input.length}/4000</span>
        </div>
      </div>
    </aside>
  );
}
