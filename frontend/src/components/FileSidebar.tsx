"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { FilePlus, FolderPlus, Upload, FolderUp, X, CheckCircle } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import {
  fetchFileTree,
  createFile,
  createFolder,
  deleteFile,
  uploadFile,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import FileTreeItem from "./FileTreeItem";

// Helper: recursively read all files from a dropped directory entry
async function readEntryFiles(
  entry: FileSystemEntry,
  basePath: string
): Promise<{ file: File; path: string }[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve) => fileEntry.file(resolve));
    return [{ file, path: basePath }];
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries(resolve);
    });
    const results: { file: File; path: string }[] = [];
    for (const child of entries) {
      const childPath = basePath ? `${basePath}/${child.name}` : child.name;
      const childFiles = await readEntryFiles(child, childPath);
      results.push(...childFiles);
    }
    return results;
  }

  return [];
}

interface UploadProgress {
  total: number;
  completed: number;
  currentFile: string;
  done: boolean;
}

export default function FileSidebar() {
  const { fileTree, setFileTree, toggleSidebar, currentProjectId } = useEditorStore();
  const [creating, setCreating] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");
  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const loadTree = useCallback(() => {
    if (!currentProjectId) return;
    fetchFileTree(currentProjectId)
      .then((data) => setFileTree(data.files))
      .catch(console.error);
  }, [setFileTree, currentProjectId]);

  useEffect(() => {
    if (!getToken()) return;
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  // Auto-hide the "done" banner after 2s
  useEffect(() => {
    if (upload?.done) {
      const t = setTimeout(() => setUpload(null), 2000);
      return () => clearTimeout(t);
    }
  }, [upload?.done]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      setCreating(null);
      return;
    }
    if (!currentProjectId) return;
    try {
      if (creating === "folder") {
        await createFolder(currentProjectId, name);
      } else {
        await createFile(currentProjectId, name);
      }
      loadTree();
    } catch (e) {
      console.error(e);
    }
    setNewName("");
    setCreating(null);
  }, [creating, newName, loadTree, currentProjectId]);

  const handleDelete = useCallback(
    async (path: string) => {
      if (!confirm(`Delete "${path}"?`)) return;
      if (!currentProjectId) return;
      try {
        await deleteFile(currentProjectId, path);
        loadTree();
      } catch (e) {
        console.error(e);
      }
    },
    [loadTree, currentProjectId]
  );

  // Shared upload helper with progress tracking
  const uploadWithProgress = useCallback(
    async (fileList: { file: File; parentPath: string }[]) => {
      if (!currentProjectId || fileList.length === 0) return;

      setUpload({ total: fileList.length, completed: 0, currentFile: fileList[0].file.name, done: false });

      for (let i = 0; i < fileList.length; i++) {
        const { file, parentPath } = fileList[i];
        setUpload({ total: fileList.length, completed: i, currentFile: file.name, done: false });
        try {
          await uploadFile(currentProjectId, file, parentPath);
        } catch (err) {
          console.error(err);
        }
      }

      setUpload({ total: fileList.length, completed: fileList.length, currentFile: "", done: true });
      loadTree();
    },
    [currentProjectId, loadTree]
  );

  // Upload individual files
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      await uploadWithProgress(
        Array.from(files).map((f) => ({ file: f, parentPath: "" }))
      );
      e.target.value = "";
    },
    [uploadWithProgress]
  );

  // Upload folder — uses File System Access API on supported browsers, falls back to webkitdirectory
  const handleFolderClick = useCallback(async () => {
    // Modern API: showDirectoryPicker (Chrome, Edge, Safari 15.2+)
    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        const allFiles: { file: File; parentPath: string }[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async function readDir(handle: any, path: string) {
          for await (const entry of handle.values()) {
            if (entry.kind === "file") {
              const file = await entry.getFile();
              allFiles.push({ file, parentPath: path ? `${dirHandle.name}/${path}` : dirHandle.name });
            } else if (entry.kind === "directory") {
              const subPath = path ? `${path}/${entry.name}` : entry.name;
              await readDir(entry, subPath);
            }
          }
        }

        await readDir(dirHandle, "");
        if (allFiles.length > 0) {
          await uploadWithProgress(allFiles);
        }
        return;
      } catch (err) {
        // User cancelled or API not supported — fall through to fallback
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Fallback: webkitdirectory input
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.onchange = async () => {
      const files = input.files;
      if (!files) return;
      const items = Array.from(files).map((file) => {
        const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        const parentDir = relPath ? relPath.substring(0, relPath.lastIndexOf("/")) : "";
        return { file, parentPath: parentDir };
      });
      await uploadWithProgress(items);
    };
    input.click();
  }, [uploadWithProgress]);

  // Drag & drop
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();

      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const allFiles: { file: File; path: string }[] = [];
        for (const item of Array.from(items)) {
          const entry = item.webkitGetAsEntry?.();
          if (entry) {
            const files = await readEntryFiles(entry, "");
            allFiles.push(...files);
          }
        }

        if (allFiles.length > 0) {
          await uploadWithProgress(
            allFiles.map(({ file, path }) => ({
              file,
              parentPath: path.substring(0, path.lastIndexOf("/")),
            }))
          );
          return;
        }
      }

      // Fallback: plain file drop
      const files = Array.from(e.dataTransfer.files);
      await uploadWithProgress(files.map((f) => ({ file: f, parentPath: "" })));
    },
    [uploadWithProgress]
  );

  const progressPercent = upload
    ? Math.round((upload.completed / Math.max(upload.total, 1)) * 100)
    : 0;

  return (
    <div
      className="h-full flex flex-col"
      style={{
        backgroundColor: "var(--bg-2)",
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 text-xs border-b"
        style={{
          backgroundColor: "var(--bg-3)",
          borderColor: "var(--rule)",
          color: "var(--ink-3)",
        }}
      >
        <span className="font-semibold uppercase tracking-wider">Files</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCreating("file")}
            className="p-1 rounded hover:opacity-80"
            title="New File"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={() => setCreating("folder")}
            className="p-1 rounded hover:opacity-80"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            className="p-1 rounded hover:opacity-80"
            title="Upload Files"
            disabled={!!upload && !upload.done}
          >
            <Upload size={14} />
          </button>
          <button
            onClick={handleFolderClick}
            className="p-1 rounded hover:opacity-80"
            title="Upload Folder"
            disabled={!!upload && !upload.done}
          >
            <FolderUp size={14} />
          </button>
          <button
            onClick={toggleSidebar}
            className="p-1 rounded hover:opacity-80"
            title="Close sidebar"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Upload progress bar */}
      {upload && (
        <div
          className="px-3 py-2 border-b"
          style={{ borderColor: "var(--rule)" }}
        >
          {upload.done ? (
            <div className="flex items-center gap-2">
              <CheckCircle size={14} style={{ color: "var(--ok)" }} />
              <span className="text-xs" style={{ color: "var(--ok)" }}>
                {upload.total} file{upload.total !== 1 ? "s" : ""} uploaded
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs truncate flex-1"
                  style={{ color: "var(--ink-3)" }}
                >
                  {upload.currentFile}
                </span>
                <span
                  className="text-xs ml-2"
                  style={{ color: "var(--ink-3)" }}
                >
                  {upload.completed}/{upload.total}
                </span>
              </div>
              {/* Progress track */}
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: "var(--paper)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundColor: "var(--accent)",
                    transition: "width 0.3s ease-out",
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden file upload input */}
      <input
        ref={uploadRef}
        type="file"
        multiple
        accept=".tex,.bib,.cls,.sty,.png,.jpg,.jpeg,.gif,.svg,.pdf,.eps,.txt"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* New file/folder input */}
      {creating && (
        <div className="px-2 py-1.5 border-b" style={{ borderColor: "var(--rule)" }}>
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setCreating(null);
                setNewName("");
              }
            }}
            onBlur={handleCreate}
            placeholder={creating === "folder" ? "Folder name..." : "File name..."}
            className="w-full px-2 py-1 text-xs rounded border outline-none"
            style={{
              backgroundColor: "var(--paper)",
              borderColor: "var(--accent)",
              color: "var(--ink)",
            }}
          />
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {fileTree.length === 0 && (
          <p
            className="text-xs text-center py-4 px-2"
            style={{ color: "var(--ink-3)" }}
          >
            No files yet. Create or upload files to get started.
          </p>
        )}
        {fileTree.map((node) => (
          <FileTreeItem
            key={node.path}
            node={node}
            depth={0}
            onDelete={handleDelete}
            onRefresh={loadTree}
          />
        ))}
      </div>

      {/* Drop zone hint */}
      <div
        className="px-3 py-2 text-center text-xs border-t"
        style={{
          borderColor: "var(--rule)",
          color: "var(--ink-3)",
        }}
      >
        Drag &amp; drop files or folders here
      </div>
    </div>
  );
}
