// DELETE /api/build/[sessionId] — Destroy agent session + E2B sandbox
// GET    /api/build/[sessionId] — Get session info (status, mode, etc.)

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserByClerkId } from "@/lib/credits";
import {
  getSession,
  sessionBelongsTo,
  deleteSession,
} from "@/server/agent/session-store";
import { destroySandbox } from "@/server/agent/sandbox-manager";
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

  if (!sessionBelongsTo(sessionId, user.id)) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session expirée" }, { status: 410 });
  }

  return NextResponse.json({
    sessionId: session.sessionId,
    projectId: session.projectId,
    sandboxId: session.sandboxId,
    mode: session.mode,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    historyLength: session.conversationHistory.length,
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

  if (!sessionBelongsTo(sessionId, user.id)) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const session = getSession(sessionId);
  if (!session) {
    // Already gone — idempotent
    return NextResponse.json({ ok: true });
  }

  // Kill E2B sandbox
  await destroySandbox(session.sandbox);

  // Clean up project in DB (clear sandbox_id; leave status as-is)
  const supabase = createServiceClient();
  await supabase
    .from("projects")
    .update({ sandbox_id: null })
    .eq("id", session.projectId);

  // Remove session from store (also stops heartbeat)
  deleteSession(sessionId);

  return NextResponse.json({ ok: true });
}
