"use client";

// PreviewPanel — live preview of the app being built by the agent.
//
// Architecture :
//   1. Boot WebContainer (browser-side, WASM)         → mount React/Vite template
//   2. npm install + npm run dev                       → Vite dev server starts
//   3. WebContainer emits server-ready(port, url)      → iframe points to this URL
//   4. SSE stream from /api/build/[sessionId]/stream   → file_change events
//   5. writeFile(path, content) into WebContainer      → Vite HMR detects change
//   6. Preview updated in sub-second                   → "wow moment"
//
// Props :
//   sessionId  — if provided, the panel connects to the agent SSE stream
//                and syncs file_change events into the WebContainer.
//                If omitted, the panel shows the starter template only.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  AlertCircle,
  Loader2,
  Files,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { webContainerManager, type WCStatus } from "./webcontainer-manager";
import { FileTree, useFileTree } from "./file-tree";
import type { AgentEvent, FileChangePayload } from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PreviewPanelProps {
  sessionId?: string;
  className?: string;
}

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_CONFIG: Record<
  Viewport,
  { width: string; icon: React.ReactNode; label: string }
> = {
  desktop: {
    width: "100%",
    icon: <Monitor className="h-3.5 w-3.5" />,
    label: "Desktop",
  },
  tablet: {
    width: "768px",
    icon: <Tablet className="h-3.5 w-3.5" />,
    label: "Tablette",
  },
  mobile: {
    width: "375px",
    icon: <Smartphone className="h-3.5 w-3.5" />,
    label: "Mobile",
  },
};

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────

function StatusBadge({
  status,
  error,
}: {
  status: WCStatus;
  error?: string;
}) {
  const config: Record<
    WCStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    idle: { label: "Inactif", variant: "outline" },
    booting: { label: "Démarrage…", variant: "secondary" },
    installing: { label: "npm install…", variant: "secondary" },
    starting: { label: "Lancement…", variant: "secondary" },
    running: { label: "En ligne", variant: "default" },
    error: { label: "Erreur", variant: "destructive" },
  };

  const { label, variant } = config[status];

  return (
    <div className="flex items-center gap-1.5">
      {(status === "booting" ||
        status === "installing" ||
        status === "starting") && (
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      )}
      {status === "error" && (
        <AlertCircle className="h-3 w-3 text-destructive" />
      )}
      {status === "running" && (
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      )}
      <Badge variant={variant} className="text-xs h-5 px-1.5">
        {label}
      </Badge>
      {status === "error" && error && (
        <span className="text-xs text-destructive truncate max-w-[200px]">
          {error}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PreviewPanel — main component
// ─────────────────────────────────────────────

export function PreviewPanel({ sessionId, className }: PreviewPanelProps) {
  const [status, setStatus] = useState<WCStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [showFileTree, setShowFileTree] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); // forces iframe reload on refresh

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  const { files, addOrUpdateFile, removeFile, setInitialFiles } =
    useFileTree();

  // ── Boot WebContainer ──────────────────────

  useEffect(() => {
    // Subscribe to status changes
    const unsubStatus = webContainerManager.onStatus((s, err) => {
      setStatus(s);
      setError(err);
    });

    // Subscribe to server-ready
    const unsubServer = webContainerManager.onServerReady((url) => {
      setServerUrl(url);
    });

    // Boot (idempotent — safe to call multiple times)
    webContainerManager.boot().catch((err: unknown) => {
      console.error("[WebContainer] boot error:", err);
    });

    // After boot + server ready, load the initial file list
    const unsubServer2 = webContainerManager.onServerReady(async () => {
      const paths = await webContainerManager.listFiles();
      setInitialFiles(paths);
    });

    return () => {
      unsubStatus();
      unsubServer();
      unsubServer2();
    };
  }, [setInitialFiles]);

  // ── Connect to SSE stream (file sync) ─────

  useEffect(() => {
    if (!sessionId) return;

    // Close any previous connection
    sseRef.current?.close();

    const sse = new EventSource(`/api/build/${sessionId}/stream`);
    sseRef.current = sse;

    sse.onmessage = (event: MessageEvent<string>) => {
      // Skip SSE comment lines (": ping")
      if (!event.data || event.data.trim() === "") return;

      let parsed: AgentEvent;
      try {
        parsed = JSON.parse(event.data) as AgentEvent;
      } catch {
        return; // Malformed event — ignore
      }

      if (parsed.type === "file_change") {
        const payload = parsed.payload as FileChangePayload;

        if (payload.operation === "delete") {
          // Remove from tree + WebContainer
          removeFile(payload.path);
          webContainerManager.deleteFile(payload.path).catch(console.error);
        } else {
          // create or update
          addOrUpdateFile(payload.path);
          webContainerManager
            .writeFile(payload.path, payload.content)
            .catch(console.error);
        }
      }
    };

    sse.onerror = () => {
      // SSE will auto-reconnect — no need to set error state here
    };

    return () => {
      sse.close();
      sseRef.current = null;
    };
  }, [sessionId, addOrUpdateFile, removeFile]);

  // ── Handlers ──────────────────────────────

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  // ── Render ────────────────────────────────

  const viewportWidth = VIEWPORT_CONFIG[viewport].width;

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
        {/* Status */}
        <StatusBadge status={status} error={error} />

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Viewport toggles */}
        <div className="flex items-center rounded-md border p-0.5 gap-0.5">
          {(["desktop", "tablet", "mobile"] as Viewport[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              title={VIEWPORT_CONFIG[v].label}
              className={cn(
                "rounded p-1 transition-colors hover:bg-muted",
                viewport === v && "bg-muted text-foreground",
                viewport !== v && "text-muted-foreground"
              )}
            >
              {VIEWPORT_CONFIG[v].icon}
            </button>
          ))}
        </div>

        {/* URL pill (when running) */}
        {serverUrl && (
          <span className="hidden sm:block truncate max-w-[160px] text-xs text-muted-foreground font-mono border rounded px-1.5 py-0.5">
            {serverUrl.replace(/^https?:\/\//, "")}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* File tree toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowFileTree((v) => !v)}
            title="Arbre des fichiers"
          >
            {showFileTree ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Files className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Refresh */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={!serverUrl}
            title="Rafraîchir le preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree sidebar */}
        {showFileTree && (
          <div className="w-52 shrink-0 border-r overflow-y-auto">
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Fichiers
            </p>
            <FileTree files={files} />
          </div>
        )}

        {/* Preview area */}
        <div className="flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-4">
          {/* Loading / error states */}
          {status !== "running" && (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center space-y-3">
                {status === "error" ? (
                  <>
                    <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
                    <p className="text-sm font-medium text-destructive">
                      WebContainer error
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      {error ?? "Une erreur inattendue s'est produite."}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => webContainerManager.boot()}
                    >
                      Réessayer
                    </Button>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">
                      {status === "booting" && "Démarrage du WebContainer…"}
                      {status === "installing" && "Installation des dépendances…"}
                      {status === "starting" && "Lancement du dev server Vite…"}
                      {status === "idle" && "Initialisation…"}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Première ouverture — peut prendre ~30 s
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* iframe — shown when server is ready */}
          {status === "running" && serverUrl && (
            <div
              className="h-full rounded-lg border bg-white shadow-sm overflow-hidden transition-all duration-300"
              style={{ width: viewportWidth, minHeight: "100%" }}
            >
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={serverUrl}
                className="h-full w-full border-0"
                title="FYREN Preview"
                // allow-same-origin is required for WebContainers serving content
                // on a local cross-origin URL
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
