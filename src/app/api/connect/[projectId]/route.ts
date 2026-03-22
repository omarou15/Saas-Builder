// GET /api/connect/[projectId]
// Retourne la liste des connexions services d'un projet.
// Les API keys ne sont JAMAIS retournées — seulement service + status + metadata safe.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { projectId } = await params;

  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit : 30 req/min
  const rl = rateLimit(`${clerkId}:connect:list`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans une minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Valider format UUID
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(projectId)) {
    return NextResponse.json({ error: "projectId invalide" }, { status: 400 });
  }

  // Vérifier que le projet appartient à l'utilisateur
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable ou accès refusé" }, { status: 404 });
  }

  // Récupérer les connexions — on sélectionne uniquement les champs safe (PAS config)
  const { data: connections, error } = await supabase
    .from("service_connections")
    .select("id, service, status, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/connect/[projectId]]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ connections: connections ?? [] });
}
