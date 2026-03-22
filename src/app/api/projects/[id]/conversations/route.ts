import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

// ============================================================
// Schémas Zod
// ============================================================

const CreateConversationSchema = z.object({
  type: z.enum(["intake", "build", "iterate"]),
});

// ============================================================
// GET /api/projects/[id]/conversations — historique conversations
// Rate limit : 30 req/min
// ============================================================

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`${clerkId}:conversations:get`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Lookup user FYREN
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const supabase = createServiceClient();

  // Vérification ownership du projet
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // Conversations + messages (structure complète pour le frontend)
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `
      id,
      project_id,
      type,
      created_at,
      messages (
        id,
        role,
        content,
        tokens_used,
        cost_usd,
        created_at
      )
    `
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/projects/[id]/conversations]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json({ conversations: conversations ?? [] });
}

// ============================================================
// POST /api/projects/[id]/conversations — créer une conversation
// Appelé automatiquement quand un projet passe en mode intake/build/iterate.
// Rate limit : 10 req/min
// ============================================================

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: projectId } = await params;

  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`${clerkId}:conversations:create`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Parse + validation
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = CreateConversationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Lookup user FYREN
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const supabase = createServiceClient();

  // Vérification ownership du projet
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // Création conversation
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({ project_id: projectId, type: parsed.data.type })
    .select()
    .single();

  if (error || !conversation) {
    console.error("[POST /api/projects/[id]/conversations]", error?.message);
    return NextResponse.json({ error: "Erreur création conversation" }, { status: 500 });
  }

  return NextResponse.json({ conversation }, { status: 201 });
}
