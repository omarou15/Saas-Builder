import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId, getOrCreateUserByClerkId } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";

// ============================================================
// Schémas Zod
// ============================================================

const CreateProjectSchema = z.object({
  name: z.string().min(1, "Le nom est requis").max(100, "Nom trop long (max 100 caractères)"),
});

// ============================================================
// GET /api/projects — liste les projets du user connecté
// Rate limit : 60 req/min
// ============================================================

export async function GET(): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`${clerkId}:projects:get`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans une minute." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // Lookup user FYREN — si pas encore dans la BDD, retourner une liste vide
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json([] );
  }

  // Requête BDD — RLS n'est pas actif ici (service role), on filtre manuellement
  const supabase = createServiceClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/projects]", error.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  return NextResponse.json(projects ?? []);
}

// ============================================================
// POST /api/projects — créer un nouveau projet
// Rate limit : 10 req/min
// ============================================================

export async function POST(req: Request): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`${clerkId}:projects:create`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans une minute." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // Parse + validation
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Lookup ou création du user FYREN (auto-sync si webhook Clerk pas encore reçu)
  let user: { id: string; credits: number };
  try {
    user = await getOrCreateUserByClerkId(clerkId);
  } catch (err) {
    console.error("[POST /api/projects] user lookup/create failed:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

  // Génération du slug unique
  const supabase = createServiceClient();
  const baseSlug = slugify(parsed.data.name);
  const slug = await generateUniqueSlug(supabase, baseSlug);

  // Création du projet
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      slug,
    })
    .select()
    .single();

  if (error) {
    console.error("[POST /api/projects]", error.message);
    return NextResponse.json({ error: "Erreur création projet" }, { status: 500 });
  }

  return NextResponse.json({ project }, { status: 201 });
}

// ============================================================
// Helpers
// ============================================================

/**
 * Génère un slug unique en ajoutant un suffixe aléatoire si nécessaire.
 * Tente jusqu'à 5 fois avant d'abandonner.
 */
async function generateUniqueSlug(
  supabase: ReturnType<typeof createServiceClient>,
  base: string
): Promise<string> {
  // Essai avec le slug brut d'abord
  const candidates = [
    base,
    ...Array.from({ length: 4 }, () => `${base}-${randomSuffix()}`),
  ];

  for (const candidate of candidates) {
    const { data } = await supabase
      .from("projects")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!data) return candidate; // slug disponible
  }

  // Fallback : base + timestamp
  return `${base}-${Date.now()}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}
