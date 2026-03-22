"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Rocket } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = (await res.json()) as { error?: string; project?: { id: string } };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create project");
      }

      router.push(`/project/${data.project!.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex rounded-2xl bg-orange-500/10 p-4">
          <Rocket className="h-8 w-8 text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold">Nouveau projet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Donne un nom &agrave; ton projet. L&apos;agent d&apos;intake te
          guidera ensuite pour d&eacute;finir le cahier des charges.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="project-name"
              className="mb-2 block text-sm font-medium"
            >
              Nom du projet
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mon SaaS, Portail client, Outil interne..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/50"
              maxLength={100}
              autoFocus
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3.5 font-semibold text-white transition-all hover:from-orange-400 hover:to-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cr&eacute;ation...
              </>
            ) : (
              <>
                Start building
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Le projet sera cr&eacute;&eacute; en mode draft. Tu pourras ensuite
        lancer la conversation d&apos;intake.
      </p>
    </div>
  );
}
