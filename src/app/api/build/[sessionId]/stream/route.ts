// GET /api/build/[sessionId]/stream — SSE stream of agent events
// The frontend subscribes here to receive real-time agent events:
//   assistant_message, tool_use, tool_result, file_change, build_status,
//   stage_change, step_done, error
//
// Architecture (serverless-compatible):
//   Agent Lambda emits events → Supabase Realtime broadcast
//   SSE Lambda subscribes to Supabase Realtime → forwards to frontend via SSE
//   Also listens to local EventEmitter (for same-Lambda / dev mode)

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSessionMeta } from "@/server/agent/session-manager";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import type { AgentEvent } from "@/types";

export const runtime = "nodejs"; // SSE requires Node.js (not Edge)
export const dynamic = "force-dynamic";

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

  // Verify session exists and belongs to user (lightweight — no sandbox reconnect)
  const meta = await getSessionMeta(sessionId, user.id);
  if (!meta) {
    return NextResponse.json({ error: "Session introuvable ou expirée" }, { status: 404 });
  }

  // ——————————————————————————————————————————————
  // Build SSE ReadableStream backed by Supabase Realtime
  // ——————————————————————————————————————————————
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: AgentEvent) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Controller may have been closed if client disconnected
        }
      };

      // Subscribe to Supabase Realtime channel for cross-Lambda events
      const supabase = createServiceClient();
      const channel = supabase.channel(`session:${sessionId}`);

      channel.on("broadcast", { event: "agent_event" }, (message) => {
        console.log(`[STREAM] Received event from Realtime for session:${sessionId}`);
        const event = message.payload as AgentEvent;
        send(event);

        // Close stream on terminal events
        if ((event.type as string) === "done" || event.type === "error") {
          try {
            controller.close();
          } catch {
            // Already closed
          }
          void supabase.removeChannel(channel);
          clearInterval(pingInterval);
        }
      });

      channel.subscribe((status) => {
        console.log(`[STREAM] Channel subscribe status:`, status);
        if (status === "SUBSCRIBED") {
          // Send initial connection event
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "connected", payload: { sessionId }, timestamp: new Date().toISOString() })}\n\n`
              )
            );
          } catch {
            // Ignore
          }
        }
      });

      // Send a connection heartbeat every 25 seconds to keep the connection alive
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(pingInterval);
          void supabase.removeChannel(channel);
        }
      }, 25_000);
    },

    cancel() {
      // Client disconnected — Supabase channel cleanup happens via removeChannel above
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
