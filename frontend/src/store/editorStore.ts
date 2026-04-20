import { create } from "zustand";
import type {
  ChatMessageData,
  Comment,
  CompilationError,
  DiffEntry,
  FileNode,
  PresenceUser,
  SelectionContext,
} from "@/lib/types";

interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

interface EditorStore {
  // Auth
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  logout: () => void;

  // Project
  currentProjectId: string | null;
  currentProjectName: string | null;
  setCurrentProjectId: (id: string | null) => void;
  setCurrentProjectName: (name: string | null) => void;

  // Document
  latexContent: string;
  savedContent: string;
  isDirty: boolean;

  // PDF
  pdfUrl: string | null;
  pdfTimestamp: number;

  // Compilation
  compilationStatus: "idle" | "compiling" | "success" | "error";
  compilationErrors: CompilationError[];

  // Chat
  messages: ChatMessageData[];
  isAgentProcessing: boolean;
  streamingContent: string;

  // Editor selection
  selectedText: string | null;
  selectionRange: { startLine: number; endLine: number } | null;
  editorReadOnly: boolean;

  // Diff
  activeDiff: DiffEntry[] | null;

  // Review mode (pending AI changes to accept/reject)
  reviewMode: boolean;
  pendingLatex: string | null;   // Full proposed document
  originalLatex: string | null;  // Doc before AI change (for reject)
  pendingPdfUrl: string | null;  // PDF URL from agent response
  startReview: (proposed: string, pdfUrl: string | null) => void;
  acceptReview: () => void;
  rejectReview: () => void;

  // Collaboration
  myRole: "owner" | "editor" | "commenter" | "viewer" | null;
  draftVersion: number;       // forked_from_version of current draft
  mainVersion: number;        // current doc_version on main
  mainAhead: boolean;         // true when main was pushed since draft was forked
  presence: PresenceUser[];
  comments: Comment[];
  showShareModal: boolean;
  showPushModal: boolean;
  setMyRole: (role: "owner" | "editor" | "commenter" | "viewer" | null) => void;
  setDraftInfo: (draftVersion: number, mainVersion: number, mainAhead: boolean) => void;
  setMainAhead: (ahead: boolean) => void;
  setPresence: (users: PresenceUser[]) => void;
  addPresenceUser: (user: PresenceUser) => void;
  removePresenceUser: (userId: string) => void;
  updatePresenceActivity: (userId: string, activity: "idle" | "ai_thinking") => void;
  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  updateCommentResolved: (commentId: string, resolved: boolean) => void;
  setShowShareModal: (show: boolean) => void;
  setShowPushModal: (show: boolean) => void;

  // Left sidebar
  leftTab: "files" | "comments" | "outline" | "source" | "history";
  setLeftTab: (tab: "files" | "comments" | "outline" | "source" | "history") => void;
  setSidebarOpen: (open: boolean) => void;

  // Model
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // File sidebar
  sidebarOpen: boolean;
  fileTree: FileNode[];
  activeFilePath: string;

  // Theme
  theme: "dark" | "light";

  // WebSocket
  wsConnected: boolean;

  // Actions
  toggleSidebar: () => void;
  setFileTree: (tree: FileNode[]) => void;
  setActiveFile: (path: string) => void;
  toggleTheme: () => void;
  setLatexContent: (content: string) => void;
  setSavedContent: (content: string) => void;
  setSelectedText: (
    text: string | null,
    range: { startLine: number; endLine: number } | null
  ) => void;
  addMessage: (message: ChatMessageData) => void;
  setMessages: (messages: ChatMessageData[]) => void;
  setAgentProcessing: (processing: boolean) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  setCompilationStatus: (
    status: "idle" | "compiling" | "success" | "error"
  ) => void;
  setCompilationErrors: (errors: CompilationError[]) => void;
  setPdfUrl: (url: string | null) => void;
  refreshPdf: () => void;
  setActiveDiff: (diff: DiffEntry[] | null) => void;
  setEditorReadOnly: (readOnly: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  applyAgentResponse: (
    latexContent: string,
    diff: DiffEntry[] | null,
    pdfUrl: string | null
  ) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  // Auth
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("claude_latex_token") : null,

  setAuth: (user, token) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("claude_latex_token", token);
      localStorage.setItem("claude_latex_user", JSON.stringify(user));
    }
    set({ user, token });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("claude_latex_token");
      localStorage.removeItem("claude_latex_user");
    }
    set({ user: null, token: null, messages: [], latexContent: "", fileTree: [] });
  },

  // Project
  currentProjectId: null,
  currentProjectName: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id, messages: [], latexContent: "", fileTree: [], pdfUrl: null, compilationStatus: "idle" }),
  setCurrentProjectName: (name) => set({ currentProjectName: name }),

  // Document
  latexContent: "",
  savedContent: "",
  isDirty: false,

  pdfUrl: null,
  pdfTimestamp: 0,

  compilationStatus: "idle",
  compilationErrors: [],

  messages: [],
  isAgentProcessing: false,
  streamingContent: "",

  selectedText: null,
  selectionRange: null,
  editorReadOnly: false,

  activeDiff: null,

  // Review mode defaults
  reviewMode: false,
  pendingLatex: null,
  originalLatex: null,
  pendingPdfUrl: null,

  startReview: (proposed, pdfUrl) =>
    set((state) => ({
      reviewMode: true,
      pendingLatex: proposed,
      originalLatex: state.latexContent,
      pendingPdfUrl: pdfUrl,
      editorReadOnly: true,  // lock editor during review
    })),

  acceptReview: () =>
    set((state) => ({
      latexContent: state.pendingLatex || state.latexContent,
      savedContent: state.pendingLatex || state.latexContent,
      isDirty: false,
      pdfUrl: state.pendingPdfUrl,
      pdfTimestamp: Date.now(),
      reviewMode: false,
      pendingLatex: null,
      originalLatex: null,
      pendingPdfUrl: null,
      editorReadOnly: false,
      isAgentProcessing: false,
      compilationStatus: state.pendingPdfUrl ? "success" : "idle",
    })),

  rejectReview: () =>
    set({
      reviewMode: false,
      pendingLatex: null,
      originalLatex: null,
      pendingPdfUrl: null,
      editorReadOnly: false,
      isAgentProcessing: false,
      compilationStatus: "idle",
    }),

  // Collaboration
  myRole: null,
  draftVersion: 0,
  mainVersion: 0,
  mainAhead: false,
  presence: [],
  comments: [],
  showShareModal: false,
  showPushModal: false,

  // Left sidebar
  leftTab: "files",
  setLeftTab: (tab) => set({ leftTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setMyRole: (role) => set({ myRole: role }),

  setDraftInfo: (draftVersion, mainVersion, mainAhead) =>
    set({ draftVersion, mainVersion, mainAhead }),

  setMainAhead: (ahead) => set({ mainAhead: ahead }),

  setPresence: (users) => set({ presence: users }),

  addPresenceUser: (user) =>
    set((state) => {
      if (state.presence.some((p) => p.userId === user.userId)) return {};
      return { presence: [...state.presence, user] };
    }),

  removePresenceUser: (userId) =>
    set((state) => ({ presence: state.presence.filter((p) => p.userId !== userId) })),

  updatePresenceActivity: (userId, activity) =>
    set((state) => ({
      presence: state.presence.map((p) =>
        p.userId === userId ? { ...p, activity } : p
      ),
    })),

  setComments: (comments) => set({ comments }),

  addComment: (comment) =>
    set((state) => {
      if (state.comments.some((c) => c.id === comment.id)) return {};
      return { comments: [...state.comments, comment] };
    }),

  updateCommentResolved: (commentId, resolved) =>
    set((state) => ({
      comments: state.comments.map((c) =>
        c.id === commentId ? { ...c, resolved } : c
      ),
    })),

  setShowShareModal: (show) => set({ showShareModal: show }),
  setShowPushModal: (show) => set({ showPushModal: show }),

  selectedModel: "anthropic/claude-sonnet-4.6",
  setSelectedModel: (model) => set({ selectedModel: model }),

  sidebarOpen: true,
  fileTree: [],
  activeFilePath: "main.tex",

  theme: (typeof window !== "undefined" && localStorage.getItem("theme") === "dark") ? "dark" : "light",

  wsConnected: false,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setFileTree: (tree) => set({ fileTree: tree }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        localStorage.setItem("theme", next);
        document.documentElement.setAttribute("data-theme", next === "dark" ? "dark" : "");
      }
      return { theme: next };
    }),

  setLatexContent: (content) =>
    set((state) => ({
      latexContent: content,
      isDirty: content !== state.savedContent,
    })),

  setSavedContent: (content) =>
    set({ savedContent: content, isDirty: false }),

  setSelectedText: (text, range) =>
    set({ selectedText: text, selectionRange: range }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  setAgentProcessing: (processing) =>
    set({ isAgentProcessing: processing, editorReadOnly: processing }),

  appendStreamingContent: (content) =>
    set((state) => ({
      streamingContent: state.streamingContent + content,
    })),

  clearStreamingContent: () => set({ streamingContent: "" }),

  setCompilationStatus: (status) => set({ compilationStatus: status }),

  setCompilationErrors: (errors) => set({ compilationErrors: errors }),

  setPdfUrl: (url) => set({ pdfUrl: url }),

  refreshPdf: () => set({ pdfTimestamp: Date.now() }),

  setActiveDiff: (diff) => set({ activeDiff: diff }),

  setEditorReadOnly: (readOnly) => set({ editorReadOnly: readOnly }),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  applyAgentResponse: (latexContent, diff, pdfUrl) =>
    set({
      latexContent,
      savedContent: latexContent,
      isDirty: false,
      activeDiff: diff,
      pdfUrl,
      pdfTimestamp: Date.now(),
      editorReadOnly: false,
      isAgentProcessing: false,
      compilationStatus: pdfUrl ? "success" : "idle",
    }),
}));
