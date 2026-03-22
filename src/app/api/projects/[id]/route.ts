import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";
import type { Json } from "@/types/database";

// ============================================================
// Schémas Zod
// ============================================================

const UpdateProjectSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    status: z
      .enum(["draft", "intake", "building", "deployed", "archived"])
      .optional(),
    cdc_json: z.record(z.unknown()).nullable().optional(),
    stack_config: z.record(z.unknown()).nullable().optional(),
    sandbox_id: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ doit être fourni",
  });

// ============================================================
// GET /api/projects/[id] — détail projet + CDC
// Rate limit : 60 req/min
// ============================================================

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`${clerkId}:project:get`, 60, 60_000);
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

  // Fetch projet + vérification ownership (double protection : service role + filtre user_id)
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  return NextResponse.json({ project });
}

// ============================================================
// PATCH /api/projects/[id] — mettre à jour projet/CDC
// Rate limit : 30 req/min
// ============================================================

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`${clerkId}:project:patch`, 30, 60_000);
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

  const parsed = UpdateProjectSchema.safeParse(body);
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

  // Vérification ownership AVANT update
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // Préparer l'update — cast JSONB pour satisfaire le type Json de Supabase
  const updatePayload: {
    name?: string;
    status?: "draft" | "intake" | "building" | "deployed" | "archived";
    cdc_json?: Json | null;
    stack_config?: Json | null;
    sandbox_id?: string | null;
  } = {
    ...(parsed.data.name !== undefined && { name: parsed.data.name }),
    ...(parsed.data.status !== undefined && { status: parsed.data.status }),
    ...(parsed.data.cdc_json !== undefined && {
      cdc_json: parsed.data.cdc_json as Json | null,
    }),
    ...(parsed.data.stack_config !== undefined && {
      stack_config: parsed.data.stack_config as Json | null,
    }),
    ...(parsed.data.sandbox_id !== undefined && { sandbox_id: parsed.data.sandbox_id }),
  };

  // Update
  const { data: project, error } = await supabase
    .from("projects")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id) // ownership redondant mais explicite
    .select()
    .single();

  if (error || !project) {
    console.error("[PATCH /api/projects/[id]]", error?.message);
    return NextResponse.json({ error: "Erreur mise à jour" }, { status: 500 });
  }

  return NextResponse.json({ project });
}
