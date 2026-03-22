"use client";

// WorkspaceLayout — the core workspace experience.
//
// Desktop: resizable split panel (chat left, preview right) with bottom file tree.
// Mobile: tab-based navigation (chat / preview) — no split.
//
// This component orchestrates:
//   - Session lifecycle (start / resume)
//   - Chat panel ↔ Preview panel communication
//   - Deploy flow
//   - Credit balance polling

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";
import {
  MessageSquare,
  Eye,
  Files,
  Terminal,
  AlertTriangle,
  MonitorX,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceHeader } from "./workspace-header";
import { ChatPanel } from "./chat-panel";
import { DeployDialog } from "./deploy-dialog";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { FileTree, useFileTree } from "@/components/preview/file-tree";
import type {
  Project,
  ProjectStatus,
  BuildStage,
  ConsoleLogEntry,
  BuildError,
  PreviewError,
} from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface WorkspaceLayoutProps {
  project: Project;
}

type MobileTab = "chat" | "preview";

// ─────────────────────────────────────────────
// Resize handle component
// ─────────────────────────────────────────────

function ResizeHandle({
  direction = "horizontal",
}: {
  direction?: "horizontal" | "vertical";
}) {
  return (
    <Separator
      className={cn(
        "group relative flex items-center justify-center",
        direction === "horizontal"
          ? "w-1.5 cursor-col-resize"
          : "h-1.5 cursor-row-resize"
      )}
    >
      <div
        className={cn(
          "rounded-full bg-white/5 transition-colors group-hover:bg-orange-500/30 group-active:bg-orange-500/50",
          direction === "horizontal" ? "h-8 w-0.5" : "h-0.5 w-8"
        )}
      />
    </Separator>
  );
}

// ─────────────────────────────────────────────
// Bottom panel (Files + Console + Problems + Terminal)
// ─────────────────────────────────────────────

type BottomTab = "files" | "console" | "problems" | "terminal";

function BottomPanel({
  files,
  consoleLogs,
  buildErrors,
  terminalLogs,
  collapsed,
  onToggle,
}: {
  files: string[];
  consoleLogs: ConsoleLogEntry[];
  buildErrors: BuildError[];
  terminalLogs: string[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [activeTab, setActiveTab] = useState<BottomTab>("files");
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console and terminal to bottom
  useEffect(() => {
    if (activeTab === "console") {
      consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs.length, activeTab]);

  useEffect(() => {
    if (activeTab === "terminal") {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs.length, activeTab]);

  const errorCount = buildErrors.filter((e) => e.severity === "error").length;
  const consoleErrorCount = consoleLogs.filter((l) => l.level === "error").length;

  function selectTab(tab: BottomTab) {
    setActiveTab(tab);
    if (collapsed) onToggle();
  }

  return (
    <div
      className={cn(
        "shrink-0 border-t border-white/5 transition-all duration-200",
        collapsed ? "h-8" : "h-48"
      )}
    >
      {/* Tab bar */}
      <div className="flex h-8 items-center gap-1 border-b border-white/5 px-2">
        <button
          onClick={onToggle}
          className="mr-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          {collapsed ? "▲" : "▼"}
        </button>

        {/* Files tab */}
        <button
          onClick={() => selectTab("files")}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors",
            activeTab === "files" && !collapsed
              ? "bg-white/5 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Files className="h-3 w-3" />
          Files
        </button>

        {/* Console tab */}
        <button
          onClick={() => selectTab("console")}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors",
            activeTab === "console" && !collapsed
              ? "bg-white/5 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MonitorX className="h-3 w-3" />
          Console
          {consoleErrorCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-medium text-red-400">
              {consoleErrorCount}
            </span>
          )}
        </button>

        {/* Problems tab */}
        <button
          onClick={() => selectTab("problems")}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors",
            activeTab === "problems" && !collapsed
              ? "bg-white/5 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <AlertTriangle className="h-3 w-3" />
          Problems
          {errorCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-medium text-red-400">
              {errorCount}
            </span>
          )}
        </button>

        {/* Terminal tab */}
        <button
          onClick={() => selectTab("terminal")}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors",
            activeTab === "terminal" && !collapsed
              ? "bg-white/5 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Terminal className="h-3 w-3" />
          Terminal
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="h-[calc(100%-2rem)] overflow-y-auto font-mono text-xs">
          {activeTab === "files" && <FileTree files={files} />}

          {activeTab === "console" && (
            <div className="p-2 space-y-0.5">
              {consoleLogs.length === 0 ? (
                <p className="text-muted-foreground/50 p-2 text-center font-sans">
                  Console logs will appear here…
                </p>
              ) : (
                consoleLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-start gap-2 rounded px-2 py-0.5",
                      log.level === "error" && "bg-red-500/5 text-red-400",
                      log.level === "warn" && "bg-yellow-500/5 text-yellow-400",
                      log.level === "info" && "text-blue-400",
                      log.level === "log" && "text-muted-foreground"
                    )}
                  >
                    <span className="shrink-0 w-10 text-muted-foreground/40">
                      {new Date(log.timestamp).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="shrink-0 w-12 uppercase font-semibold text-[10px]">
                      {log.level}
                    </span>
                    <span className="whitespace-pre-wrap break-all flex-1">
                      {log.message}
                      {log.source && (
                        <span className="ml-2 text-muted-foreground/40">
                          {log.source}
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          )}

          {activeTab === "problems" && (
            <div className="p-2 space-y-1">
              {buildErrors.length === 0 ? (
                <p className="text-muted-foreground/50 p-2 text-center font-sans">
                  No problems detected
                </p>
              ) : (
                buildErrors.map((err) => (
                  <div
                    key={err.id}
                    className={cn(
                      "flex items-start gap-2 rounded px-2 py-1",
                      err.severity === "error"
                        ? "bg-red-500/5 text-red-400"
                        : "bg-yellow-500/5 text-yellow-400"
                    )}
                  >
                    {err.severity === "error" ? (
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-red-400" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-yellow-400" />
                    )}
                    <span className="shrink-0 text-muted-foreground">
                      {err.file}
                      {err.line != null && `:${err.line}`}
                      {err.column != null && `:${err.column}`}
                    </span>
                    <span className="flex-1 break-all">{err.message}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "terminal" && (
            <div className="p-2">
              {terminalLogs.length === 0 ? (
                <p className="text-muted-foreground/50 p-2 text-center font-sans">
                  Terminal output will appear here during build…
                </p>
              ) : (
                <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                  {terminalLogs.join("")}
                </pre>
              )}
              <div ref={terminalEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Mobile tab switcher
// ─────────────────────────────────────────────

function MobileTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}) {
  return (
    <div className="flex h-10 shrink-0 border-b border-white/5 lg:hidden">
      <button
        onClick={() => onTabChange("chat")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors",
          activeTab === "chat"
            ? "border-b-2 border-orange-500 text-orange-400"
            : "text-muted-foreground"
        )}
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </button>
      <button
        onClick={() => onTabChange("preview")}
        className={cn(
          "flex flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors",
          activeTab === "preview"
            ? "border-b-2 border-orange-500 text-orange-400"
            : "text-muted-foreground"
        )}
      >
        <Eye className="h-4 w-4" />
        Preview
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Error message formatting helpers
// ─────────────────────────────────────────────

function buildErrorToMessage(err: BuildError): string {
  const loc = [err.file, err.line, err.column].filter(Boolean).join(":");
  return `Build Error at ${loc}\n${err.message}`;
}

function consoleErrorToMessage(entry: ConsoleLogEntry): string {
  let msg = `Runtime Error: ${entry.message}`;
  if (entry.source) msg += `\nSource: ${entry.source}`;
  if (entry.stack) msg += `\nStack trace:\n${entry.stack}`;
  return msg;
}

// ─────────────────────────────────────────────
// WorkspaceLayout — main component
// ─────────────────────────────────────────────

export function WorkspaceLayout({ project }: WorkspaceLayoutProps) {
  // State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(
    project.status
  );
  const [credits, setCredits] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  const [bottomCollapsed, setBottomCollapsed] = useState(true);
  const [deployOpen, setDeployOpen] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Auto-debug state
  const [autoFixEnabled, setAutoFixEnabled] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [buildErrors, setBuildErrors] = useState<BuildError[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [pendingError, setPendingError] = useState<PreviewError | null>(null);
  const autoFixCountRef = useRef<{ errorKey: string; count: number }>({
    errorKey: "",
    count: 0,
  });
  const autoFixMaxRetries = 3;

  const { files } = useFileTree();

  // ── Fetch credits on mount ─────────────────
  useEffect(() => {
    async function fetchCredits() {
      try {
        const res = await fetch("/api/billing/credits");
        if (res.ok) {
          const data = (await res.json()) as { credits: number };
          setCredits(data.credits);
        }
      } catch {
        // Non-fatal
      }
    }
    void fetchCredits();
  }, []);

  // ── Auto-start session if project is in draft/intake ──
  useEffect(() => {
    // Only auto-start for projects without an active session
    if (sessionId) return;

    // If project has a sandbox_id, it might already have a session
    // We don't auto-start — user sends the first message
    if (project.sandbox_id) return;

    // For draft projects, start an intake session automatically
    if (project.status === "draft") {
      void startSession("intake");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start a new agent session ──────────────
  const startSession = useCallback(
    async (mode: "intake" | "build" | "iterate") => {
      if (sessionLoading) return;
      setSessionLoading(true);

      try {
        const res = await fetch("/api/build/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id, mode }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          console.error("[workspace] Failed to start session:", data.error);
          return;
        }

        const data = (await res.json()) as { sessionId: string };
        setSessionId(data.sessionId);
        setProjectStatus(mode === "intake" ? "intake" : "building");
      } catch (err) {
        console.error(
          "[workspace] Session start error:",
          err instanceof Error ? err.message : err
        );
      } finally {
        setSessionLoading(false);
      }
    },
    [project.id, sessionLoading]
  );

  // ── Preview error handler (auto-debug) ──────
  const handlePreviewError = useCallback(
    (entry: ConsoleLogEntry | BuildError) => {
      const error: PreviewError = {
        type: "line" in entry ? "build" : "runtime",
        entry,
        timestamp: new Date().toISOString(),
      };

      // Deduplicate: don't spam for the same error message
      const errorKey =
        "message" in entry
          ? entry.message.slice(0, 120)
          : "";

      setPendingError((prev) => {
        // If same error already pending, skip
        if (prev && "message" in prev.entry && prev.entry.message.slice(0, 120) === errorKey) {
          return prev;
        }
        return error;
      });

      // Auto-fix: if enabled, send to agent automatically
      if (autoFixEnabled && sessionId) {
        // Rate limit: max 3 auto-fix attempts for the same error
        if (autoFixCountRef.current.errorKey === errorKey) {
          autoFixCountRef.current.count++;
          if (autoFixCountRef.current.count > autoFixMaxRetries) {
            // Disable auto-fix and show manual review message
            setAutoFixEnabled(false);
            autoFixCountRef.current = { errorKey: "", count: 0 };
            return;
          }
        } else {
          autoFixCountRef.current = { errorKey, count: 1 };
        }

        // Auto-send to agent
        void sendTryToFix(error);
      }
    },
    [autoFixEnabled, sessionId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Send "Try to Fix" to agent ──────────────
  const sendTryToFix = useCallback(
    async (error: PreviewError) => {
      if (!sessionId) return;

      const errorDescription =
        error.type === "build"
          ? buildErrorToMessage(error.entry as BuildError)
          : consoleErrorToMessage(error.entry as ConsoleLogEntry);

      const message = `The following ${error.type} error was detected in the preview:\n\n\`\`\`\n${errorDescription}\n\`\`\`\n\nPlease analyze and fix it. Read the relevant file first, then apply the fix.`;

      try {
        await fetch(`/api/build/${sessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        // Clear pending error after sending
        setPendingError(null);
      } catch {
        // Non-fatal
      }
    },
    [sessionId]
  );

  // ── Handle terminal logs from WebContainer stderr ─
  const handleTerminalData = useCallback((data: string) => {
    setTerminalLogs((prev) => {
      const next = [...prev, data];
      // Keep max 1000 entries
      return next.length > 1000 ? next.slice(-1000) : next;
    });
  }, []);

  // ── Handle stage changes from chat ─────────
  const handleStageChange = useCallback(
    (_stage: BuildStage, _progress: number) => {
      // Could update UI indicators — stage progress is handled by ChatPanel
    },
    []
  );

  // ── Handle agent done ──────────────────────
  const handleAgentDone = useCallback(() => {
    // Refresh project status
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}`);
        if (res.ok) {
          const data = (await res.json()) as Project;
          setProjectStatus(data.status);
        }
      } catch {
        // Non-fatal
      }
    })();
  }, [project.id]);

  // ── Deploy ─────────────────────────────────
  const canDeploy =
    projectStatus === "building" || projectStatus === "deployed";

  const handleDeploy = useCallback(() => {
    setIsDeploying(true);
    setDeployOpen(true);
  }, []);

  const handleDeployComplete = useCallback(() => {
    setIsDeploying(false);
    setProjectStatus("deployed");
    // Refresh credits
    void (async () => {
      try {
        const res = await fetch("/api/billing/credits");
        if (res.ok) {
          const data = (await res.json()) as { credits: number };
          setCredits(data.credits);
        }
      } catch {
        // Non-fatal
      }
    })();
  }, []);

  // ── Compute chat error banner props ────────
  const chatPendingError = pendingError
    ? {
        type: pendingError.type,
        message:
          pendingError.type === "build"
            ? (pendingError.entry as BuildError).message
            : (pendingError.entry as ConsoleLogEntry).message,
        file:
          pendingError.type === "build"
            ? (pendingError.entry as BuildError).file
            : (pendingError.entry as ConsoleLogEntry).source,
        stack:
          pendingError.type === "runtime"
            ? (pendingError.entry as ConsoleLogEntry).stack
            : undefined,
      }
    : null;

  const handleTryToFix = useCallback(() => {
    if (pendingError) {
      void sendTryToFix(pendingError);
    }
  }, [pendingError, sendTryToFix]);

  const handleDismissError = useCallback(() => {
    setPendingError(null);
  }, []);

  // ── Start session button (if no session) ──
  const showStartButton = !sessionId && !sessionLoading && project.status !== "draft";

  // ── Render ─────────────────────────────────

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <WorkspaceHeader
        projectName={project.name}
        projectStatus={projectStatus}
        credits={credits}
        canDeploy={canDeploy}
        isDeploying={isDeploying}
        onDeploy={handleDeploy}
        autoFixEnabled={autoFixEnabled}
        onAutoFixToggle={() => setAutoFixEnabled((v) => !v)}
      />

      {/* Mobile tab bar */}
      <MobileTabBar activeTab={mobileTab} onTabChange={setMobileTab} />

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop: resizable split panels */}
        <div className="hidden h-full lg:flex lg:flex-col">
          <Group orientation="vertical" className="flex-1">
            <Panel defaultSize={75} minSize={40}>
              <Group orientation="horizontal">
                {/* Chat panel */}
                <Panel defaultSize={40} minSize={25} maxSize={60}>
                  <div className="relative h-full min-w-0">
                    <ChatPanel
                      projectId={project.id}
                      sessionId={sessionId}
                      onStageChange={handleStageChange}
                      onAgentDone={handleAgentDone}
                      pendingError={chatPendingError}
                      onTryToFix={handleTryToFix}
                      onDismissError={handleDismissError}
                    />
                    {/* Start session overlay */}
                    {showStartButton && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                        <div className="text-center">
                          <p className="mb-3 text-sm text-muted-foreground">
                            Aucune session active
                          </p>
                          <button
                            onClick={() => void startSession("build")}
                            className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-orange-400 hover:to-orange-500"
                          >
                            Démarrer le build
                          </button>
                        </div>
                      </div>
                    )}
                    {sessionLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                          Démarrage de la session…
                        </div>
                      </div>
                    )}
                  </div>
                </Panel>

                <ResizeHandle direction="horizontal" />

                {/* Preview panel */}
                <Panel defaultSize={60} minSize={30}>
                  <PreviewPanel
                    sessionId={sessionId ?? undefined}
                    onConsoleLogs={setConsoleLogs}
                    onBuildErrors={setBuildErrors}
                    onPreviewError={handlePreviewError}
                    onStderrData={handleTerminalData}
                  />
                </Panel>
              </Group>
            </Panel>

            <ResizeHandle direction="vertical" />

            {/* Bottom panel (file tree / logs) — collapsed by default */}
            <Panel
              defaultSize={5}
              minSize={5}
              maxSize={50}
              collapsible
              collapsedSize={3}
              onResize={(size) => setBottomCollapsed(size.asPercentage <= 5)}
            >
              <BottomPanel
                files={files}
                consoleLogs={consoleLogs}
                buildErrors={buildErrors}
                terminalLogs={terminalLogs}
                collapsed={bottomCollapsed}
                onToggle={() => setBottomCollapsed((v) => !v)}
              />
            </Panel>
          </Group>
        </div>

        {/* Mobile: tab-based */}
        <div className="flex h-full flex-col lg:hidden">
          <div
            className={cn(
              "flex-1 overflow-hidden",
              mobileTab !== "chat" && "hidden"
            )}
          >
            <div className="relative h-full">
              <ChatPanel
                projectId={project.id}
                sessionId={sessionId}
                onStageChange={handleStageChange}
                onAgentDone={handleAgentDone}
              />
              {showStartButton && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <div className="text-center">
                    <p className="mb-3 text-sm text-muted-foreground">
                      Aucune session active
                    </p>
                    <button
                      onClick={() => void startSession("build")}
                      className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-orange-400 hover:to-orange-500"
                    >
                      Démarrer le build
                    </button>
                  </div>
                </div>
              )}
              {sessionLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                    Démarrage…
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex-1 overflow-hidden",
              mobileTab !== "preview" && "hidden"
            )}
          >
            <PreviewPanel
                    sessionId={sessionId ?? undefined}
                    onConsoleLogs={setConsoleLogs}
                    onBuildErrors={setBuildErrors}
                    onPreviewError={handlePreviewError}
                    onStderrData={handleTerminalData}
                  />
          </div>
        </div>
      </div>

      {/* Deploy dialog */}
      <DeployDialog
        open={deployOpen}
        onOpenChange={(open) => {
          setDeployOpen(open);
          if (!open) setIsDeploying(false);
        }}
        projectId={project.id}
        onDeployComplete={handleDeployComplete}
      />
    </div>
  );
}
