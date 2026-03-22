// POST /api/build/[sessionId]/message — Send a user message to the agent
// The agent processes the message and emits events on the SSE stream.
// This endpoint returns immediately (fire-and-forget); events flow via SSE.
//
// Rate limit: 20 req/min
// Body: { message: string, attachments?: Attachment[] }
// Returns: { ok: true, status: "running" }

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getUserByClerkId, getUserCredits } from "@/lib/credits";
import { reconnectSession, saveSessionState } from "@/server/agent/session-manager";
import { runAgentStep } from "@/server/agent/agent-runner";
import { createServiceClient } from "@/lib/supabase";

const MIN_CREDITS = 0.01;

const AttachmentSchema = z.object({
  type: z.enum(["text", "image"]),
  content: z.string(),
  filename: z.string(),
  mimeType: z.string().optional(),
});

const MessageSchema = z.object({
  message: z.string().min(1).max(10_000),
  attachments: z.array(AttachmentSchema).max(5).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { sessionId } = await context.params;

  // Rate limit: 20 messages per minute
  const rl = rateLimit(`${clerkId}:build:message`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de messages. Attendez une minute." },
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

  const parsed = MessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { message, attachments } = parsed.data;

  // Lookup FYREN user
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Reconnect session from Supabase + E2B sandbox
  const session = await reconnectSession(sessionId, user.id);
  if (!session) {
    return NextResponse.json({ error: "Session introuvable ou expirée" }, { status: 404 });
  }

  // Check agent is not already running
  if (session.status === "running") {
    return NextResponse.json(
      { error: "L'agent traite déjà un message. Attendez la fin de l'étape." },
      { status: 409 }
    );
  }

  // Check credits
  const credits = await getUserCredits(user.id);
  if (credits < MIN_CREDITS) {
    return NextResponse.json(
      { error: "Crédits insuffisants.", credits, required: MIN_CREDITS },
      { status: 402 }
    );
  }

  // Persist user message to DB
  const supabase = createServiceClient();
  const convType = session.mode === "intake" ? "intake" : session.mode === "iterate" ? "iterate" : "build";

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", session.projectId)
    .eq("type", convType)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (conv) {
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      role: "user",
      content: message,
    });
  }

  // Build attachments for multimodal support
  const parsedAttachments = attachments?.map((a) => ({
    type: a.type as "text" | "image",
    content: a.content,
    filename: a.filename,
    mimeType: a.mimeType,
  }));

  // Run agent step asynchronously — fire-and-forget with state persistence
  // Events flow through the SSE stream; state is saved to Supabase after completion
  runAgentStep(session, message, parsedAttachments)
    .then(async () => {
      await saveSessionState(sessionId, session.conversationHistory, session.status);
    })
    .catch(async (err) => {
      console.error(
        "[build/message] Unhandled agent error:",
        err instanceof Error ? err.message : err
      );
      await saveSessionState(sessionId, session.conversationHistory, "error").catch(() => {});
    });

  return NextResponse.json({ ok: true, status: "running" });
}
