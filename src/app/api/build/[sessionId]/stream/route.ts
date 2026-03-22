// GET /api/build/[sessionId]/stream — SSE stream of agent events
// The frontend subscribes here to receive real-time agent events:
//   assistant_message, tool_use, tool_result, file_change, build_status,
//   stage_change, step_done, error
//
// Pattern: EventEmitter (agent runner) → ReadableStream (SSE) → Frontend

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSession, sessionBelongsTo } from "@/server/agent/session-store";
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

  // Verify session ownership
  if (!sessionBelongsTo(sessionId, user.id)) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session expirée" }, { status: 410 });
  }

  // ——————————————————————————————————————————————
  // Build SSE ReadableStream backed by EventEmitter
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

      const onEvent = (event: AgentEvent) => {
        send(event);
      };

      const onDone = () => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", payload: null, timestamp: new Date().toISOString() })}\n\n`
            )
          );
          controller.close();
        } catch {
          // Already closed
        }
        cleanup();
      };

      const onError = () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      const cleanup = () => {
        session.emitter.off("agent_event", onEvent);
        session.emitter.off("agent_done", onDone);
        session.emitter.off("agent_error", onError);
      };

      session.emitter.on("agent_event", onEvent);
      session.emitter.once("agent_done", onDone);
      session.emitter.once("agent_error", onError);

      // Send a connection heartbeat every 25 seconds to keep the connection alive
      // through proxies/load balancers that drop idle connections
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(pingInterval);
          cleanup();
        }
      }, 25_000);

      // Note: we rely on cancel being called when the client disconnects
    },

    cancel() {
      // Client disconnected — clean up listeners
      session.emitter.removeAllListeners("agent_event");
      session.emitter.removeAllListeners("agent_done");
      session.emitter.removeAllListeners("agent_error");
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
