"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { User, Bot, Code, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ChatMessageData } from "@/lib/types";

/** Strip LaTeX document boilerplate, returning only the body content. */
function stripLatexBoilerplate(code: string): string {
  const bodyMatch = code.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  const body = bodyMatch ? bodyMatch[1] : code;
  return body
    .replace(/\\(maketitle|tableofcontents|listoffigures|listoftables|clearpage|newpage|appendix)\b/g, "")
    .replace(/\\(label|ref|pageref)\{[^}]*\}/g, "")
    .trim();
}

/** Rendered preview of a LaTeX code block with a "Source" toggle and copy button. */
function LaTeXPreview({ code }: { code: string }) {
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const readable = preprocessLatex(stripLatexBoilerplate(code));

  return (
    <div className="card my-2" style={{ overflow: "hidden", padding: 0 }}>
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--rule)" }}
      >
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
          LaTeX · {code.split("\n").length} lines
        </span>
        <div className="flex items-center gap-1">
          <button onClick={copy} className="btn ghost icon sm" title="Copy source">
            {copied
              ? <Check size={11} style={{ color: "var(--ok)" }} />
              : <Copy size={11} />}
          </button>
          <button onClick={() => setShowSource(s => !s)} className="btn ghost sm" style={{ fontSize: 11, gap: 4 }}>
            {showSource
              ? <><ChevronUp size={11} /> Preview</>
              : <><ChevronDown size={11} /> Source</>}
          </button>
        </div>
      </div>
      <div style={{ padding: "10px 14px", background: "var(--paper)" }}>
        {showSource ? (
          <pre className="overflow-x-auto text-xs font-mono" style={{ color: "var(--ink)", margin: 0 }}>
            {code}
          </pre>
        ) : (
          <div className="text-sm chat-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {readable}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pre-process content to convert LaTeX environments to KaTeX-compatible format.
 * Converts \begin{equation}...\end{equation} to $$...$$ so remark-math can parse them.
 */
function preprocessLatex(content: string): string {
  let r = content;

  // Convert LaTeX math environments to $$ blocks
  r = r.replace(
    /\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
    (_m, _e, inner) => `\n$$\n${inner.trim()}\n$$\n`
  );

  // Convert \[ ... \] to $$
  r = r.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `\n$$\n${inner.trim()}\n$$\n`);

  // Convert LaTeX text commands to markdown equivalents
  r = r.replace(/\\textbf\{([^}]*)\}/g, "**$1**");
  r = r.replace(/\\textit\{([^}]*)\}/g, "*$1*");
  r = r.replace(/\\emph\{([^}]*)\}/g, "*$1*");
  r = r.replace(/\\underline\{([^}]*)\}/g, "<u>$1</u>");
  r = r.replace(/\\paragraph\{([^}]*)\}/g, "\n\n**$1**\n\n");
  r = r.replace(/\\subparagraph\{([^}]*)\}/g, "\n\n*$1*\n\n");
  r = r.replace(/\\section\*?\{([^}]*)\}/g, "\n\n## $1\n\n");
  r = r.replace(/\\subsection\*?\{([^}]*)\}/g, "\n\n### $1\n\n");
  r = r.replace(/\\subsubsection\*?\{([^}]*)\}/g, "\n\n#### $1\n\n");

  // Convert \cite{...} to readable format
  r = r.replace(/\\cite[pt]?\{([^}]*)\}/g, "[$1]");

  // Convert \label{...} and \ref{...}
  r = r.replace(/\\label\{([^}]*)\}/g, "");
  r = r.replace(/\\(?:eq)?ref\{([^}]*)\}/g, "($1)");

  // Convert itemize/enumerate to markdown lists
  r = r.replace(/\\begin\{itemize\}/g, "");
  r = r.replace(/\\end\{itemize\}/g, "");
  r = r.replace(/\\begin\{enumerate\}/g, "");
  r = r.replace(/\\end\{enumerate\}/g, "");
  r = r.replace(/\\item\s*/g, "- ");

  // Clean up remaining LaTeX commands that don't render
  r = r.replace(/\\qed/g, "\\square");
  r = r.replace(/\\quad/g, "  ");
  r = r.replace(/\\qquad/g, "    ");
  r = r.replace(/\\noindent\s*/g, "");
  r = r.replace(/\\hfill/g, "");
  r = r.replace(/\\\\(?!\n)/g, "\n");

  // Clean up excessive newlines
  r = r.replace(/\n{4,}/g, "\n\n\n");

  return r;
}

interface Patch { search: string; replace: string; }

function extractPatches(content: string): { text: string; patches: Patch[] } {
  const patches: Patch[] = [];
  const text = content.replace(
    /<<<SEARCH\n([\s\S]*?)>>>REPLACE\n([\s\S]*?)<<<END/g,
    (_m, search, replace) => {
      patches.push({ search: search.trimEnd(), replace: replace.trimEnd() });
      return `%%PATCH_${patches.length - 1}%%`;
    }
  );
  return { text, patches };
}

/** Render LaTeX diff content as real math. Wraps bare math in $$ if no delimiters present. */
function renderDiffContent(text: string) {
  let processed = preprocessLatex(text);
  // If it still has LaTeX commands but no math delimiters, wrap as display math
  if (/\\[a-zA-Z]/.test(processed) && !processed.includes("$") && !processed.includes("$$")) {
    processed = `$$\n${processed.trim()}\n$$`;
  }
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {processed}
    </ReactMarkdown>
  );
}

function DiffCard({ patch }: { patch: Patch }) {
  return (
    <div className="card my-2" style={{ overflow: "hidden", padding: 0 }}>
      <div
        className="px-3 py-1"
        style={{ background: "var(--bg-3)", borderBottom: "1px solid var(--rule)", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}
      >
        edit
      </div>
      <div
        className="px-3 py-2 text-sm overflow-x-auto"
        style={{ background: "color-mix(in oklab, var(--err) 8%, var(--paper))", borderBottom: "1px solid var(--rule)" }}
      >
        <span style={{ fontSize: 10, color: "var(--err)", fontFamily: "var(--font-mono)", userSelect: "none", display: "block", marginBottom: 2 }}>before</span>
        {renderDiffContent(patch.search)}
      </div>
      <div
        className="px-3 py-2 text-sm overflow-x-auto"
        style={{ background: "color-mix(in oklab, var(--ok) 8%, var(--paper))" }}
      >
        <span style={{ fontSize: 10, color: "var(--ok)", fontFamily: "var(--font-mono)", userSelect: "none", display: "block", marginBottom: 2 }}>after</span>
        {renderDiffContent(patch.replace)}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  message: ChatMessageData;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className="px-4 py-3 border-b animate-fadeIn"
      style={{
        backgroundColor: isUser ? "transparent" : "color-mix(in oklab, var(--accent) 5%, transparent)",
        borderColor: "var(--rule)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: isUser
            ? "var(--accent)"
            : "conic-gradient(from 210deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
          }}
        >
          {isUser ? (
            <User size={14} color="white" />
          ) : (
            <Bot size={14} color="white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Show selection context for user messages */}
          {isUser && message.context?.selected_text && (
            <div
              className="mb-2 p-2 rounded text-xs font-mono border"
              style={{
                backgroundColor: "var(--bg-3)",
                borderColor: "var(--rule)",
              }}
            >
              <div
                className="flex items-center gap-1 mb-1"
                style={{ color: "var(--ink-3)" }}
              >
                <Code size={10} />
                <span>
                  Selected (lines{" "}
                  {message.context.selection_range.start_line}-
                  {message.context.selection_range.end_line})
                </span>
              </div>
              <pre className="whitespace-pre-wrap overflow-x-auto">
                {message.context.selected_text.slice(0, 300)}
                {message.context.selected_text.length > 300 ? "..." : ""}
              </pre>
            </div>
          )}

          <div className="text-sm chat-markdown">
            {(() => {
              const mdComponents = {
                h1: ({ children }: { children?: React.ReactNode }) => (
                  <h1 className="text-base font-bold mt-3 mb-2 pb-1 border-b" style={{ borderColor: "var(--rule)", color: "var(--ink)" }}>{children}</h1>
                ),
                h2: ({ children }: { children?: React.ReactNode }) => (
                  <h2 className="text-sm font-bold mt-3 mb-1.5" style={{ color: "var(--ink)" }}>{children}</h2>
                ),
                h3: ({ children }: { children?: React.ReactNode }) => (
                  <h3 className="text-sm font-semibold mt-2 mb-1" style={{ color: "var(--accent)" }}>{children}</h3>
                ),
                p: ({ children }: { children?: React.ReactNode }) => (
                  <p className="mb-2 leading-relaxed" style={{ color: "var(--ink)" }}>{children}</p>
                ),
                ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc ml-5 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal ml-5 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }: { children?: React.ReactNode }) => (
                  <li className="leading-relaxed" style={{ color: "var(--ink)" }}>{children}</li>
                ),
                strong: ({ children }: { children?: React.ReactNode }) => (
                  <strong className="font-semibold" style={{ color: "var(--ink)" }}>{children}</strong>
                ),
                em: ({ children }: { children?: React.ReactNode }) => (
                  <em className="italic" style={{ color: "var(--ink-3)" }}>{children}</em>
                ),
                code: ({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) => {
                  const isInline = !className;
                  const lang = (className as string | undefined)?.replace("language-", "") ?? "";
                  if (!isInline && (lang === "latex" || lang === "tex")) {
                    return <LaTeXPreview code={String(children).trimEnd()} />;
                  }
                  if (isInline) {
                    return (
                      <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ backgroundColor: "var(--bg-3)", color: "var(--accent)", border: "1px solid var(--rule)" }} {...props}>
                        {children}
                      </code>
                    );
                  }
                  return <code className={className as string} {...props}>{children}</code>;
                },
                pre: ({ children }: { children?: React.ReactNode }) => (
                  <pre className="p-3 rounded my-2 overflow-x-auto text-xs font-mono border" style={{ backgroundColor: "var(--bg-3)", borderColor: "var(--rule)", color: "var(--ink)" }}>
                    {children}
                  </pre>
                ),
                blockquote: ({ children }: { children?: React.ReactNode }) => (
                  <blockquote className="pl-3 my-2 border-l-2 italic" style={{ borderColor: "var(--accent)", color: "var(--ink-3)" }}>{children}</blockquote>
                ),
                a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80" style={{ color: "var(--accent)" }}>{children}</a>
                ),
                hr: () => <hr className="my-3" style={{ borderColor: "var(--rule)" }} />,
                table: ({ children }: { children?: React.ReactNode }) => (
                  <div className="my-3 overflow-x-auto">
                    <table className="w-full text-xs border-collapse rounded overflow-hidden" style={{ border: "1px solid var(--rule)" }}>{children}</table>
                  </div>
                ),
                thead: ({ children }: { children?: React.ReactNode }) => <thead style={{ backgroundColor: "var(--bg-3)" }}>{children}</thead>,
                th: ({ children }: { children?: React.ReactNode }) => (
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: "var(--ink)", borderBottom: "1px solid var(--rule)", borderRight: "1px solid var(--rule)" }}>{children}</th>
                ),
                td: ({ children }: { children?: React.ReactNode }) => (
                  <td className="px-3 py-1.5" style={{ color: "var(--ink)", borderBottom: "1px solid var(--rule)", borderRight: "1px solid var(--rule)" }}>{children}</td>
                ),
                tr: ({ children }: { children?: React.ReactNode }) => (
                  <tr className="hover:bg-[var(--bg-3)]/50 transition-colors">{children}</tr>
                ),
              };

              const { text, patches } = extractPatches(message.content);
              const parts = text.split(/%%PATCH_(\d+)%%/);

              return parts.map((part, i) => {
                if (i % 2 === 1) {
                  return <DiffCard key={i} patch={patches[Number(part)]} />;
                }
                if (!part.trim()) return null;
                return (
                  <ReactMarkdown key={i} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                    {preprocessLatex(part)}
                  </ReactMarkdown>
                );
              });
            })()}
          </div>

          <div
            className="mt-1 text-xs"
            style={{ color: "var(--ink-3)" }}
          >
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}
