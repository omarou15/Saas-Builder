"use client";

// DeployDialog — modal that streams deploy progress via SSE.
// Triggered by the Deploy button in WorkspaceHeader.
// Connects to POST /api/deploy and displays real-time stage progress.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onDeployComplete?: () => void;
}

interface DeployEvent {
  type: "progress" | "stage_result" | "done" | "error";
  stage?: string;
  message?: string;
  status?: string;
  success?: boolean;
  githubUrl?: string;
  deploymentUrl?: string;
  projectUrl?: string;
}

interface StageStatus {
  stage: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
  message?: string;
}

const DEPLOY_STAGES = [
  { stage: "github", label: "Push GitHub" },
  { stage: "vercel", label: "Setup Vercel" },
  { stage: "supabase", label: "Schema Supabase" },
  { stage: "persist", label: "Finalization" },
];

export function DeployDialog({
  open,
  onOpenChange,
  projectId,
  onDeployComplete,
}: DeployDialogProps) {
  const [stages, setStages] = useState<StageStatus[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<{
    github?: string;
    deployment?: string;
    project?: string;
  }>({});
  const abortRef = useRef<AbortController | null>(null);

  const handleDeployEvent = useCallback(
    (event: DeployEvent) => {
      switch (event.type) {
        case "progress": {
          if (event.stage) {
            setStages((prev) =>
              prev.map((s) =>
                s.stage === event.stage ? { ...s, status: "running" } : s
              )
            );
          }
          break;
        }

        case "stage_result": {
          if (event.stage) {
            setStages((prev) =>
              prev.map((s) =>
                s.stage === event.stage
                  ? {
                      ...s,
                      status: event.status === "success" ? "success" : "error",
                      message: event.message,
                    }
                  : s
              )
            );
          }
          break;
        }

        case "done": {
          setDone(true);
          setUrls({
            github: event.githubUrl,
            deployment: event.deploymentUrl,
            project: event.projectUrl,
          });
          if (!event.success) {
            setError("Deploy completed with errors");
          }
          onDeployComplete?.();
          break;
        }

        case "error": {
          setError(event.message ?? "Unknown error");
          break;
        }
      }
    },
    [onDeployComplete]
  );

  const startDeploy = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? `Deploy failed (${res.status})`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: DeployEvent;
          try {
            event = JSON.parse(jsonStr) as DeployEvent;
          } catch {
            continue;
          }

          handleDeployEvent(event);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Deploy failed");
      }
    }
  }, [projectId, handleDeployEvent]);

  // Reset state and start deploy when dialog opens
  useEffect(() => {
    if (!open) return;

    setStages(
      DEPLOY_STAGES.map((s) => ({ ...s, status: "pending" as const }))
    );
    setDone(false);
    setError(null);
    setUrls({});

    void startDeploy();

    return () => {
      abortRef.current?.abort();
    };
  }, [open, projectId, startDeploy]);

  const stageIcon = (status: StageStatus["status"]) => {
    switch (status) {
      case "pending":
        return <Circle className="h-4 w-4 text-muted-foreground/30" />;
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin text-orange-400" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/5 bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {done ? "Deploy terminé" : "Deploy en cours…"}
          </DialogTitle>
        </DialogHeader>

        {/* Stages */}
        <div className="space-y-3 py-2">
          {stages.map((s) => (
            <div key={s.stage} className="flex items-center gap-3">
              {stageIcon(s.status)}
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    s.status === "pending" && "text-muted-foreground/50",
                    s.status === "running" && "text-foreground",
                    s.status === "success" && "text-green-400",
                    s.status === "error" && "text-red-400"
                  )}
                >
                  {s.label}
                </p>
                {s.message && (
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {s.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* URLs after deploy */}
        {done && !error && (
          <div className="space-y-2 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            {urls.github && (
              <a
                href={urls.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-green-400 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                GitHub Repository
              </a>
            )}
            {urls.deployment && (
              <a
                href={urls.deployment}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-green-400 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Live App
              </a>
            )}
          </div>
        )}

        {/* Close button */}
        {(done || error) && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-white/10"
            >
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
