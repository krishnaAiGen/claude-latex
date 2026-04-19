"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { User, Bot, Code } from "lucide-react";
import type { ChatMessageData } from "@/lib/types";

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
  r = r.replace(/\\qed/g, "∎");
  r = r.replace(/\\quad/g, "  ");
  r = r.replace(/\\qquad/g, "    ");
  r = r.replace(/\\noindent\s*/g, "");
  r = r.replace(/\\hfill/g, "");
  r = r.replace(/\\\\(?!\n)/g, "\n");

  // Clean up excessive newlines
  r = r.replace(/\n{4,}/g, "\n\n\n");

  return r;
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-base font-bold mt-3 mb-2 pb-1 border-b" style={{ borderColor: "var(--rule)", color: "var(--ink)" }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-sm font-bold mt-3 mb-1.5" style={{ color: "var(--ink)" }}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold mt-2 mb-1" style={{ color: "var(--accent)" }}>
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="mb-2 leading-relaxed" style={{ color: "var(--ink)" }}>
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc ml-5 mb-2 space-y-0.5">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal ml-5 mb-2 space-y-0.5">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="leading-relaxed" style={{ color: "var(--ink)" }}>
                    {children}
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold" style={{ color: "var(--ink)" }}>
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic" style={{ color: "var(--ink-3)" }}>
                    {children}
                  </em>
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        className="px-1 py-0.5 rounded text-xs font-mono"
                        style={{
                          backgroundColor: "var(--bg-3)",
                          color: "var(--accent)",
                          border: "1px solid var(--rule)",
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre
                    className="p-3 rounded my-2 overflow-x-auto text-xs font-mono border"
                    style={{
                      backgroundColor: "var(--bg-3)",
                      borderColor: "var(--rule)",
                      color: "var(--ink)",
                    }}
                  >
                    {children}
                  </pre>
                ),
                blockquote: ({ children }) => (
                  <blockquote
                    className="pl-3 my-2 border-l-2 italic"
                    style={{
                      borderColor: "var(--accent)",
                      color: "var(--ink-3)",
                    }}
                  >
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:opacity-80"
                    style={{ color: "var(--accent)" }}
                  >
                    {children}
                  </a>
                ),
                hr: () => (
                  <hr className="my-3" style={{ borderColor: "var(--rule)" }} />
                ),
                table: ({ children }) => (
                  <div className="my-3 overflow-x-auto">
                    <table
                      className="w-full text-xs border-collapse rounded overflow-hidden"
                      style={{ border: "1px solid var(--rule)" }}
                    >
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ backgroundColor: "var(--bg-3)" }}>{children}</thead>
                ),
                th: ({ children }) => (
                  <th
                    className="px-3 py-2 text-left font-semibold"
                    style={{
                      color: "var(--ink)",
                      borderBottom: "1px solid var(--rule)",
                      borderRight: "1px solid var(--rule)",
                    }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td
                    className="px-3 py-1.5"
                    style={{
                      color: "var(--ink)",
                      borderBottom: "1px solid var(--rule)",
                      borderRight: "1px solid var(--rule)",
                    }}
                  >
                    {children}
                  </td>
                ),
                tr: ({ children }) => (
                  <tr className="hover:bg-[var(--bg-3)]/50 transition-colors">
                    {children}
                  </tr>
                ),
              }}
            >
              {preprocessLatex(message.content)}
            </ReactMarkdown>
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
