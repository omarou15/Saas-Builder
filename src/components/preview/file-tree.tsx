"use client";

// FileTree — displays the WebContainer filesystem in a collapsible tree.
// Files come from two sources:
//   1. Initial scan via webContainerManager.listFiles() once the WC is running
//   2. Real-time updates via file_change SSE events (create / update / delete)
//
// The tree is rebuilt from a flat list of file paths (e.g. "src/App.tsx"),
// not from the WebContainer filesystem directly — avoids expensive polling.

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface FileTreeProps {
  // Flat list of file paths in the WebContainer (e.g. ["src/App.tsx", ...])
  files: string[];
  // Path currently selected by the user (optional)
  selectedPath?: string;
  onSelectFile?: (path: string) => void;
  className?: string;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
}

// ─────────────────────────────────────────────
// Build tree from flat paths
// ─────────────────────────────────────────────

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = {
    name: "",
    path: "",
    isDirectory: true,
    children: [],
  };

  for (const filePath of paths) {
    const segments = filePath.split("/").filter(Boolean);
    let current = root;

    segments.forEach((segment, idx) => {
      const isLast = idx === segments.length - 1;
      const nodePath = segments.slice(0, idx + 1).join("/");

      let child = current.children.find((c) => c.name === segment);
      if (!child) {
        child = {
          name: segment,
          path: nodePath,
          isDirectory: !isLast,
          children: [],
        };
        current.children.push(child);
      }

      if (!isLast) {
        // It's a directory segment — ensure marked as directory
        child.isDirectory = true;
      }

      current = child;
    });
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .map((n) => ({ ...n, children: sortNodes(n.children) }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

  return sortNodes(root.children);
}

// ─────────────────────────────────────────────
// TreeNode component (recursive)
// ─────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  onSelectFile?: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setOpen((prev) => !prev);
    } else {
      onSelectFile?.(node.path);
    }
  }, [node, onSelectFile]);

  const isSelected = !node.isDirectory && node.path === selectedPath;

  return (
    <div>
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-sm transition-colors",
          "hover:bg-muted",
          isSelected && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {node.isDirectory ? (
          <>
            <ChevronRight
              className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-90"
              )}
            />
            {open ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            )}
          </>
        ) : (
          <>
            <span className="w-3" />
            <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate text-xs">{node.name}</span>
      </button>

      {node.isDirectory && open && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
          {node.children.length === 0 && (
            <p
              className="py-0.5 text-xs text-muted-foreground/50 italic"
              style={{ paddingLeft: `${8 + (depth + 1) * 12 + 18}px` }}
            >
              vide
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// FileTree — public component
// ─────────────────────────────────────────────

export function FileTree({
  files,
  selectedPath,
  onSelectFile,
  className,
}: FileTreeProps) {
  const nodes = useMemo(() => buildTree(files), [files]);

  if (files.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 p-4 text-center",
          className
        )}
      >
        <Folder className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">
          En attente des fichiers...
        </p>
      </div>
    );
  }

  return (
    <div className={cn("py-1", className)}>
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// useFileTree hook — manages file list state
// with real-time add/remove/update support
// ─────────────────────────────────────────────

export function useFileTree(initialFiles: string[] = []) {
  const [files, setFiles] = useState<string[]>(initialFiles);

  const addOrUpdateFile = useCallback((path: string) => {
    // Strip /workspace/ prefix if present
    const normalized = path.replace(/^\/workspace\//, "");
    setFiles((prev) =>
      prev.includes(normalized) ? prev : [...prev, normalized]
    );
  }, []);

  const removeFile = useCallback((path: string) => {
    const normalized = path.replace(/^\/workspace\//, "");
    setFiles((prev) => prev.filter((f) => f !== normalized));
  }, []);

  const setInitialFiles = useCallback((paths: string[]) => {
    setFiles(paths.map((p) => p.replace(/^\/workspace\//, "")));
  }, []);

  return { files, addOrUpdateFile, removeFile, setInitialFiles };
}
