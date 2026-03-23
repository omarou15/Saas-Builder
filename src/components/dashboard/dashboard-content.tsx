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
  Trash2,
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

function DeleteDialog({
  project,
  open,
  onClose,
  onConfirm,
  deleting,
}: {
  project: Project;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-white/10 bg-background p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">Supprimer {project.name} ?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette action est irr&eacute;versible. Toutes les conversations, fichiers et connexions
          associ&eacute;s seront supprim&eacute;s.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (id: string) => void;
}) {
  const date = new Date(project.updated_at).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="group relative flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-200 hover:border-orange-500/20 hover:bg-orange-500/[0.02]">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5">
          <FileCode className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={project.status} />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(project.id);
            }}
            className="rounded-md p-1 text-muted-foreground/30 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <Link href={`/project/${project.id}`} className="flex-1">
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
    </div>
  );
}

export function DashboardContent() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Erreur lors de la suppression");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setDeleting(false);
    }
  }

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
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={(id) => {
                const target = projects.find((p) => p.id === id);
                if (target) setDeleteTarget(target);
              }}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteDialog
          project={deleteTarget}
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
          deleting={deleting}
        />
      )}
    </div>
  );
}
