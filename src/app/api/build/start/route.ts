// POST /api/build/start — Create E2B sandbox + agent session
// Rate limit: 3 req/min (build start is expensive)
// Auth: Clerk
// Body: { projectId: UUID, mode: "intake" | "build" | "iterate" }
// Returns: { sessionId: string }

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { getUserByClerkId, getUserCredits } from "@/lib/credits";
import { createServiceClient } from "@/lib/supabase";
import { createSandbox, keepSandboxAlive } from "@/server/agent/sandbox-manager";
import {
  createSession,
  startHeartbeat,
} from "@/server/agent/session-store";
import type { AgentMode } from "@/types";

const StartBuildSchema = z.object({
  projectId: z.string().uuid("projectId doit être un UUID valide"),
  mode: z.enum(["intake", "build", "iterate"]).default("build"),
});

// Minimum credits required to start a build session ($0.50)
const MIN_CREDITS_FOR_BUILD = 0.5;

export async function POST(req: Request): Promise<Response> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit: 3 build starts per minute
  const rl = rateLimit(`${clerkId}:build:start`, 3, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de sessions démarrées. Attendez une minute." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = StartBuildSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId, mode } = parsed.data;

  // Lookup FYREN user
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Check credits (rule: verify before expensive operations)
  const credits = await getUserCredits(user.id);
  if (credits < MIN_CREDITS_FOR_BUILD) {
    return NextResponse.json(
      {
        error: "Crédits insuffisants pour démarrer un build.",
        credits,
        required: MIN_CREDITS_FOR_BUILD,
      },
      { status: 402 }
    );
  }

  const supabase = createServiceClient();

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, sandbox_id, status")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // Create E2B sandbox
  let sandboxInfo: Awaited<ReturnType<typeof createSandbox>>;
  try {
    sandboxInfo = await createSandbox();
  } catch (err) {
    console.error("[build/start] E2B sandbox creation failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Impossible de créer le sandbox. Réessayez." },
      { status: 502 }
    );
  }

  const { sandbox, sandboxId } = sandboxInfo;

  // Create a new conversation for this session
  const convType = mode === "intake" ? "intake" : mode === "iterate" ? "iterate" : "build";
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({ project_id: projectId, type: convType })
    .select("id")
    .single();

  if (convError || !conversation) {
    // Non-fatal — session works without a persisted conversation
    console.warn("[build/start] Could not create conversation:", convError?.message);
  }

  // Update project: status → building, sandbox_id
  await supabase
    .from("projects")
    .update({
      status: mode === "intake" ? "intake" : "building",
      sandbox_id: sandboxId,
    })
    .eq("id", projectId);

  // Create in-memory session
  const sessionId = randomUUID();
  const session = createSession(sessionId, projectId, user.id, sandbox, sandboxId, mode as AgentMode);

  // Start E2B heartbeat (every 5 minutes)
  startHeartbeat(session, keepSandboxAlive);

  return NextResponse.json({ sessionId, sandboxId, conversationId: conversation?.id ?? null });
}
