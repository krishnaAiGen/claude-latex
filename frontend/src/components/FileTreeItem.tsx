"use client";

import { useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Image,
  File,
  FolderOpen,
  Folder,
  Trash2,
  FilePlus,
  Upload,
} from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { uploadFile, createFile } from "@/lib/api";
import type { FileNode } from "@/lib/types";

interface FileTreeItemProps {
  node: FileNode;
  depth: number;
  onDelete: (path: string) => void;
  onRefresh: () => void;
}

const TEXT_EXTENSIONS = new Set([".tex", ".bib", ".cls", ".sty", ".txt", ".md", ".csv", ".bst"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".pdf", ".eps"]);

function getFileIcon(name: string) {
  const ext = "." + name.split(".").pop()?.toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return <FileText size={14} style={{ color: "var(--accent)" }} />;
  if (IMAGE_EXTENSIONS.has(ext)) return <Image size={14} style={{ color: "var(--ok)" }} />;
  return <File size={14} style={{ color: "var(--ink-3)" }} />;
}

export default function FileTreeItem({ node, depth, onDelete, onRefresh }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const { activeFilePath, setActiveFile, currentProjectId } = useEditorStore();
  const isActive = node.type === "file" && node.path === activeFilePath;

  const handleClick = useCallback(() => {
    if (node.type === "folder") {
      setExpanded((e) => !e);
    } else {
      const ext = "." + node.name.split(".").pop()?.toLowerCase();
      if (TEXT_EXTENSIONS.has(ext)) {
        setActiveFile(node.path);
      }
    }
  }, [node, setActiveFile]);

  const handleUploadToFolder = useCallback(() => {
    if (!currentProjectId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async () => {
      const files = input.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        try {
          await uploadFile(currentProjectId, file, node.path);
        } catch (err) {
          console.error(err);
        }
      }
      onRefresh();
    };
    input.click();
  }, [currentProjectId, node.path, onRefresh]);

  const handleCreateInFolder = useCallback(async () => {
    const name = newFileName.trim();
    if (!name || !currentProjectId) {
      setCreatingFile(false);
      setNewFileName("");
      return;
    }
    try {
      await createFile(currentProjectId, name, node.path);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
    setCreatingFile(false);
    setNewFileName("");
  }, [newFileName, currentProjectId, node.path, onRefresh]);

  return (
    <div>
      <div
        onClick={handleClick}
        className={`tree-row group${isActive ? " active" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse for folders */}
        {node.type === "folder" ? (
          expanded ? (
            <ChevronDown size={12} style={{ color: "var(--ink-3)" }} />
          ) : (
            <ChevronRight size={12} style={{ color: "var(--ink-3)" }} />
          )
        ) : (
          <span className="w-3" />
        )}

        {/* Icon */}
        {node.type === "folder" ? (
          expanded ? (
            <FolderOpen size={14} style={{ color: "var(--warn)" }} />
          ) : (
            <Folder size={14} style={{ color: "var(--warn)" }} />
          )
        ) : (
          getFileIcon(node.name)
        )}

        {/* Name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* Folder actions: upload into, new file */}
        {node.type === "folder" && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUploadToFolder();
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity duration-150"
              style={{ color: "var(--ink-3)" }}
              title={`Upload into ${node.name}`}
            >
              <Upload size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(true);
                setCreatingFile(true);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity duration-150"
              style={{ color: "var(--ink-3)" }}
              title={`New file in ${node.name}`}
            >
              <FilePlus size={12} />
            </button>
          </>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node.path);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity duration-150"
          style={{ color: "var(--err)" }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Children */}
      {node.type === "folder" && expanded && (
        <div>
          {/* Inline new file input */}
          {creatingFile && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-0.5 pr-2">
              <input
                autoFocus
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateInFolder();
                  if (e.key === "Escape") {
                    setCreatingFile(false);
                    setNewFileName("");
                  }
                }}
                onBlur={handleCreateInFolder}
                placeholder="filename.tex"
                className="w-full px-1.5 py-0.5 text-xs rounded border outline-none"
                style={{
                  backgroundColor: "var(--paper)",
                  borderColor: "var(--accent)",
                  color: "var(--ink)",
                }}
              />
            </div>
          )}

          {node.children?.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onDelete={onDelete}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
