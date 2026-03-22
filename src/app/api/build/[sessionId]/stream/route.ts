// GET /api/build/[sessionId]/stream — SSE stream of agent events
// The frontend subscribes here to receive real-time agent events.
//
// Architecture (serverless-compatible, no WebSockets):
//   Agent Lambda writes events → Supabase table agent_events (INSERT)
//   SSE Lambda polls agent_events every 500ms → forwards to frontend via SSE
//   No Realtime, no WebSockets — works on Vercel serverless.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSessionMeta } from "@/server/agent/session-manager";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow long-running SSE (up to 5 min on Vercel Pro, 60s on free)
export const maxDuration = 300;

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { sessionId } = await context.params;

  // Lookup FYREN user
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Verify session exists and belongs to user
  const meta = await getSessionMeta(sessionId, user.id);
  if (!meta) {
    return NextResponse.json({ error: "Session introuvable ou expirée" }, { status: 404 });
  }

  // ——————————————————————————————————————————————
  // Build SSE ReadableStream backed by polling agent_events table
  // ——————————————————————————————————————————————
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastId = 0;
      let closed = false;

      const supabase = createServiceClient();

      // Poll for new events every 500ms
      const pollInterval = setInterval(async () => {
        if (closed) return;

        try {
          const { data } = await supabase
            .from("agent_events")
            .select("id, event")
            .eq("session_id", sessionId)
            .gt("id", lastId)
            .order("id", { ascending: true });

          for (const row of data ?? []) {
            const event = row.event as Record<string, unknown>;
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
              );
            } catch {
              // Controller closed — client disconnected
              closed = true;
              clearInterval(pollInterval);
              clearInterval(pingInterval);
              return;
            }
            lastId = row.id as number;

            // Close stream on terminal events
            const eventType = (event as { type?: string }).type;
            if (eventType === "done" || eventType === "error" || eventType === "step_done") {
              // Keep polling a bit more in case there are trailing events
            }
          }
        } catch {
          // Supabase query failed — non-fatal, retry next poll
        }
      }, 500);

      // Keep-alive ping every 25s
      const pingInterval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
          clearInterval(pollInterval);
          clearInterval(pingInterval);
        }
      }, 25_000);

      // Send initial connected event
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "connected", payload: { sessionId }, timestamp: new Date().toISOString() })}\n\n`
          )
        );
      } catch {
        // Ignore
      }
    },

    cancel() {
      // Client disconnected — intervals will be cleaned up on next tick
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
