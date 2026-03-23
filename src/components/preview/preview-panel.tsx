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
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { webContainerManager, type WCStatus } from "./webcontainer-manager";
import { FileTree, useFileTree } from "./file-tree";
import {
  isFyrenConsoleMessage,
  toConsoleLogEntry,
  MAX_CONSOLE_LOGS,
  MAX_BUILD_ERRORS,
} from "./console-capture";
import type { AgentEvent, FileChangePayload, ConsoleLogEntry, BuildError } from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PreviewPanelProps {
  sessionId?: string;
  className?: string;
  onConsoleLogs?: (logs: ConsoleLogEntry[]) => void;
  onBuildErrors?: (errors: BuildError[]) => void;
  onPreviewError?: (error: ConsoleLogEntry | BuildError) => void;
  onStderrData?: (data: string) => void;
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

export function PreviewPanel({
  sessionId,
  className,
  onConsoleLogs,
  onBuildErrors,
  onPreviewError,
  onStderrData,
}: PreviewPanelProps) {
  const [status, setStatus] = useState<WCStatus>("idle");
  const [error, setError] = useState<string | undefined>();
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [showFileTree, setShowFileTree] = useState(false);
  const [iframeKey, setIframeKey] = useState(0); // forces iframe reload on refresh

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Console logs & build errors (in-memory only)
  const consoleLogsRef = useRef<ConsoleLogEntry[]>([]);
  const buildErrorsRef = useRef<BuildError[]>([]);

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

    // Boot with auto-retry: if "Unable to create more instances", teardown and retry once
    webContainerManager.boot().catch(async () => {
      // Auto-retry: teardown stale instance, wait 1s, try again
      webContainerManager.teardown();
      await new Promise((r) => setTimeout(r, 1000));
      webContainerManager.boot().catch((retryErr: unknown) => {
        console.error("[WebContainer] boot retry failed:", retryErr);
      });
    });

    // After boot + server ready, load the initial file list
    const unsubServer2 = webContainerManager.onServerReady(async () => {
      const paths = await webContainerManager.listFiles();
      setInitialFiles(paths);
    });

    // Forward stderr to parent for terminal tab
    const unsubStderr = webContainerManager.onStderr((data) => {
      onStderrData?.(data);
    });

    // Listen for build errors from Vite stderr
    const unsubBuildErrors = webContainerManager.onBuildError((errors) => {
      buildErrorsRef.current = [
        ...buildErrorsRef.current.slice(-(MAX_BUILD_ERRORS - errors.length)),
        ...errors,
      ];
      onBuildErrors?.(buildErrorsRef.current);
      // Notify parent of each error for auto-debug
      for (const err of errors) {
        if (err.severity === "error") {
          onPreviewError?.(err);
        }
      }
    });

    return () => {
      unsubStatus();
      unsubServer();
      unsubServer2();
      unsubStderr();
      unsubBuildErrors();
    };
  }, [setInitialFiles, onBuildErrors, onPreviewError, onStderrData]);

  // ── Listen for console messages from iframe ─
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isFyrenConsoleMessage(event.data)) return;

      const entry = toConsoleLogEntry(event.data);
      consoleLogsRef.current = [
        ...consoleLogsRef.current.slice(-(MAX_CONSOLE_LOGS - 1)),
        entry,
      ];
      onConsoleLogs?.(consoleLogsRef.current);

      // Surface errors for auto-debug
      if (entry.level === "error") {
        onPreviewError?.(entry);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onConsoleLogs, onPreviewError]);

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

  // ── Remount template on project change ────
  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdRef.current && prevSessionIdRef.current !== sessionId && sessionId) {
      void webContainerManager.remountTemplate().then(async () => {
        const paths = await webContainerManager.listFiles();
        setInitialFiles(paths);
      });
    }
    prevSessionIdRef.current = sessionId;
  }, [sessionId, setInitialFiles]);

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
        <div className="flex items-center rounded-md border border-white/10 p-0.5 gap-0.5">
          {(["desktop", "tablet", "mobile"] as Viewport[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              title={VIEWPORT_CONFIG[v].label}
              className={cn(
                "rounded p-1.5 transition-colors",
                viewport === v
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5"
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
              <div className="text-center space-y-4">
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
                      onClick={() => void webContainerManager.resetAndBoot()}
                    >
                      Réessayer
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3 w-64">
                    {/* Step-by-step progress */}
                    {([
                      { key: "booting", label: "Initialisation de l'environnement..." },
                      { key: "installing", label: "Installation des dépendances..." },
                      { key: "starting", label: "Démarrage du serveur de preview..." },
                    ] as const).map((step) => {
                      const order = ["idle", "booting", "installing", "starting", "running"];
                      const currentIdx = order.indexOf(status);
                      const stepIdx = order.indexOf(step.key);
                      const isDone = currentIdx > stepIdx;
                      const isCurrent = status === step.key;

                      return (
                        <div key={step.key} className="flex items-center gap-3">
                          {isDone ? (
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                              <Check className="h-3 w-3 text-green-400" />
                            </div>
                          ) : isCurrent ? (
                            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-orange-400" />
                          ) : (
                            <div className="h-5 w-5 shrink-0 rounded-full border border-white/10" />
                          )}
                          <span className={cn(
                            "text-sm text-left",
                            isDone && "text-muted-foreground/60",
                            isCurrent && "text-foreground font-medium",
                            !isDone && !isCurrent && "text-muted-foreground/30"
                          )}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground/40 pt-2">
                      Première ouverture — peut prendre ~30 s
                    </p>
                  </div>
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
