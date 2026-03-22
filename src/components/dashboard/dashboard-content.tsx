"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Rocket,
  Clock,
  FileCode,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: {
    label: "Draft",
    color: "text-zinc-400",
    bg: "bg-zinc-400/10",
  },
  intake: {
    label: "Intake",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  building: {
    label: "Building",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  deployed: {
    label: "Deployed",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  archived: {
    label: "Archived",
    color: "text-zinc-500",
    bg: "bg-zinc-500/10",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["draft"]!;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config!.color} ${config!.bg}`}
    >
      {config!.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-20 text-center">
      <div className="mb-4 inline-flex rounded-2xl bg-orange-500/10 p-4">
        <Rocket className="h-8 w-8 text-orange-400" />
      </div>
      <h3 className="mb-2 text-xl font-semibold">Aucun projet</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Cr&eacute;e ton premier projet et laisse l&apos;IA construire ton app
        sur ton infra.
      </p>
      <Link
        href="/app/new"
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:from-orange-400 hover:to-orange-500"
      >
        <Plus className="h-4 w-4" />
        New project
      </Link>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const date = new Date(project.updated_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      href={`/app/project/${project.id}`}
      className="group flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-200 hover:border-orange-500/20 hover:bg-orange-500/[0.02]"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
          <FileCode className="h-5 w-5 text-muted-foreground" />
        </div>
        <StatusBadge status={project.status} />
      </div>
      <h3 className="mb-1 font-semibold transition-colors group-hover:text-orange-400">
        {project.name}
      </h3>
      <p className="text-xs text-muted-foreground">{project.slug}</p>
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {date}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

export function DashboardContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) throw new Error("Failed to fetch projects");
        const data = (await res.json()) as Project[];
        setProjects(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    void fetchProjects();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tes apps, sur ton infra.
          </p>
        </div>
        <Link
          href="/app/new"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-orange-400 hover:to-orange-500"
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
