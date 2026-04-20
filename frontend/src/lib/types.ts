export interface ModelOption {
  id: string;
  name: string;
  tier: "Best" | "Medium" | "Lowest";
  inputPrice: string;
  outputPrice: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6", tier: "Best", inputPrice: "$5", outputPrice: "$25" },
  { id: "google/gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", tier: "Best", inputPrice: "$2", outputPrice: "$12" },
  { id: "anthropic/claude-sonnet-4.6", name: "Claude Sonnet 4.6", tier: "Medium", inputPrice: "$3", outputPrice: "$15" },
  { id: "minimax/minimax-m2.5", name: "Minimax M2.5", tier: "Medium", inputPrice: "$0.25", outputPrice: "$1.20" },
  { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", tier: "Lowest", inputPrice: "$1", outputPrice: "$5" },
  { id: "openai/gpt-oss-20b:free", name: "GPT OSS 20B", tier: "Lowest", inputPrice: "$0", outputPrice: "$0" },
];

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  role?: "owner" | "editor" | "commenter" | "viewer";
  doc_version?: number;
}

export interface DocumentDraft {
  content: string;
  forked_from_version: number;
  updated_at: string;
  main_version: number;
  main_ahead: boolean;
}

export interface DocumentVersion {
  id: string;
  version_number: number;
  pushed_by: { id: string; name: string };
  ai_summary: string;
  diff_stats: { lines_added: number; lines_removed: number; sections_changed: string[] } | null;
  created_at: string;
}

export interface ProjectMember {
  user_id: string;
  name: string | null;
  email: string;
  role: "owner" | "editor" | "commenter" | "viewer";
}

export interface ProjectInvitation {
  id: string;
  email: string;
  role: "viewer" | "commenter" | "editor";
  created_at: string;
  expires_at: string | null;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  parentId: string | null;
  lineNumber: number | null;
  content: string;
  resolved: boolean;
  replies: Comment[];
  createdAt: string;
}

export interface PresenceUser {
  userId: string;
  name: string;
  role: string;
  activity: "idle" | "ai_thinking";
}

export interface MemberDraft {
  user_id: string;
  name: string | null;
  email: string;
  role: string;
  lines_changed: number;
  updated_at: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size?: number;
  children?: FileNode[];
}

export interface CompilationError {
  line: number | null;
  message: string;
  file: string | null;
}

export interface CompilationResult {
  success: boolean;
  pdf_url: string | null;
  log: string;
  errors: CompilationError[];
  warnings: string[];
}

export interface DiffEntry {
  type: "insert" | "delete";
  line: number;
  content: string;
}

export interface SelectionContext {
  selected_text: string;
  selection_range: {
    start_line: number;
    end_line: number;
  };
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: SelectionContext;
}

export interface AgentResponse {
  type: "agent_response";
  message: string;
  latex_content: string | null;
  diff: DiffEntry[] | null;
  pdf_url: string | null;
  compilation: CompilationResult | null;
}

export type WSMessage =
  | { type: "agent_thinking"; content: string }
  | { type: "agent_message_delta"; content: string }
  | AgentResponse
  | { type: "compile_status"; status: string }
  | { type: "error"; message: string }
  | { type: "main_updated"; version_number: number; pushed_by: string; ai_summary: string }
  | { type: "presence_join"; user_id: string; name: string; role: string }
  | { type: "presence_leave"; user_id: string }
  | { type: "ai_thinking"; user_id: string; user_name: string }
  | { type: "ai_done"; user_id: string }
  | { type: "comment_added"; comment: Comment }
  | { type: "comment_resolved"; comment_id: string; resolved: boolean };
