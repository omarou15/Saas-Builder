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

import { useCallback, useEffect, useState } from "react";
import {
  Panel,
  Group,
  Separator,
} from "react-resizable-panels";
import { MessageSquare, Eye, Files, Terminal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { WorkspaceHeader } from "./workspace-header";
import { ChatPanel } from "./chat-panel";
import { DeployDialog } from "./deploy-dialog";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { FileTree, useFileTree } from "@/components/preview/file-tree";
import type { Project, ProjectStatus, BuildStage } from "@/types";

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
// Bottom panel (file tree + logs)
// ─────────────────────────────────────────────

function BottomPanel({
  files,
  collapsed,
  onToggle,
}: {
  files: string[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"files" | "logs">("files");

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
        <button
          onClick={() => {
            setActiveTab("files");
            if (collapsed) onToggle();
          }}
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
        <button
          onClick={() => {
            setActiveTab("logs");
            if (collapsed) onToggle();
          }}
          className={cn(
            "flex items-center gap-1.5 rounded px-2 py-0.5 text-xs transition-colors",
            activeTab === "logs" && !collapsed
              ? "bg-white/5 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Terminal className="h-3 w-3" />
          Logs
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="h-[calc(100%-2rem)] overflow-y-auto">
          {activeTab === "files" ? (
            <FileTree files={files} />
          ) : (
            <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
              Logs will appear here during build…
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
                  <div className="relative h-full">
                    <ChatPanel
                      projectId={project.id}
                      sessionId={sessionId}
                      onStageChange={handleStageChange}
                      onAgentDone={handleAgentDone}
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
                  <PreviewPanel sessionId={sessionId ?? undefined} />
                </Panel>
              </Group>
            </Panel>

            <ResizeHandle direction="vertical" />

            {/* Bottom panel (file tree / logs) */}
            <Panel
              defaultSize={25}
              minSize={5}
              maxSize={50}
              collapsible
              collapsedSize={3}
              onResize={(size) => setBottomCollapsed(size.asPercentage <= 3)}
            >
              <BottomPanel
                files={files}
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
            <PreviewPanel sessionId={sessionId ?? undefined} />
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
