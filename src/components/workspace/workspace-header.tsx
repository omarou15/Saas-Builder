"use client";

// WorkspaceHeader — top bar of the workspace page.
// Shows: project name, status badge, credits balance, deploy button.

import Link from "next/link";
import { ArrowLeft, Coins, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

export interface WorkspaceHeaderProps {
  projectName: string;
  projectStatus: ProjectStatus;
  credits: number | null;
  canDeploy: boolean;
  isDeploying: boolean;
  onDeploy: () => void;
}

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  draft: { label: "Draft", variant: "outline" },
  intake: { label: "Intake", variant: "secondary" },
  building: { label: "Building", variant: "secondary" },
  deployed: { label: "Deployed", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

export function WorkspaceHeader({
  projectName,
  projectStatus,
  credits,
  canDeploy,
  isDeploying,
  onDeploy,
}: WorkspaceHeaderProps) {
  const statusCfg = STATUS_CONFIG[projectStatus];

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/5 bg-background px-4">
      {/* Back to dashboard */}
      <Link
        href="/app"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Projects</span>
      </Link>

      {/* Separator */}
      <div className="h-4 w-px bg-white/10" />

      {/* Project name */}
      <h1 className="truncate text-sm font-semibold">{projectName}</h1>

      {/* Status badge */}
      <Badge
        variant={statusCfg.variant}
        className={cn(
          "shrink-0 text-xs",
          projectStatus === "building" && "animate-pulse border-orange-500/30 text-orange-400",
          projectStatus === "deployed" && "border-green-500/30 text-green-400"
        )}
      >
        {statusCfg.label}
      </Badge>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Credits */}
      {credits !== null && (
        <div className="hidden items-center gap-1.5 rounded-md border border-white/5 px-2.5 py-1 text-xs text-muted-foreground sm:flex">
          <Coins className="h-3 w-3 text-orange-400" />
          <span className="font-mono">${credits.toFixed(2)}</span>
        </div>
      )}

      {/* Deploy button */}
      <Button
        size="sm"
        disabled={!canDeploy || isDeploying}
        onClick={onDeploy}
        className="h-8 bg-gradient-to-r from-orange-500 to-orange-600 text-xs font-semibold text-white hover:from-orange-400 hover:to-orange-500 disabled:opacity-40"
      >
        {isDeploying ? (
          <>
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            Deploying…
          </>
        ) : (
          "Deploy"
        )}
      </Button>
    </header>
  );
}
