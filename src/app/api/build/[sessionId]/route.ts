// DELETE /api/build/[sessionId] — Destroy agent session + E2B sandbox
// GET    /api/build/[sessionId] — Get session info (status, mode, etc.)

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserByClerkId } from "@/lib/credits";
import {
  getSessionMeta,
  closeSession,
} from "@/server/agent/session-manager";
import { createServiceClient } from "@/lib/supabase";

// ============================================================
// GET /api/build/[sessionId] — session info
// ============================================================

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { sessionId } = await context.params;

  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const meta = await getSessionMeta(sessionId, user.id);
  if (!meta) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    sessionId,
    projectId: meta.projectId,
    sandboxId: meta.sandboxId,
    mode: meta.mode,
    status: meta.status,
  });
}

// ============================================================
// DELETE /api/build/[sessionId] — terminate session + sandbox
// ============================================================

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { sessionId } = await context.params;

  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const meta = await getSessionMeta(sessionId, user.id);
  if (!meta) {
    return NextResponse.json({ ok: true }); // Already gone — idempotent
  }

  // Close session (kills sandbox + marks as closed in DB)
  await closeSession(sessionId);

  // Clean up project in DB (clear sandbox_id)
  const supabase = createServiceClient();
  await supabase
    .from("projects")
    .update({ sandbox_id: null })
    .eq("id", meta.projectId);

  return NextResponse.json({ ok: true });
}
