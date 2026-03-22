// FYREN — Reconnectable Session Manager (serverless-compatible)
//
// Architecture "Reconnectable Sessions" pour Vercel Serverless :
//   1. Les métadonnées session sont stockées dans Supabase (table agent_sessions)
//   2. Le sandbox E2B est reconnecté à chaque requête via Sandbox.connect(sandboxId)
//   3. L'EventEmitter est éphémère (vit le temps de la requête)
//   4. La conversation history est persistée dans Supabase après chaque step
//   5. Le heartbeat E2B est géré par un Vercel Cron Job

import { Sandbox } from "e2b";
import { EventEmitter } from "events";
import { createServiceClient } from "@/lib/supabase";
import type { ModelMessage } from "ai";
import type { AgentMode, AgentSessionStatus, AgentEvent } from "@/types";

// ============================================================
// Types
// ============================================================

export interface ReconnectedSession {
  sessionId: string;
  projectId: string;
  userId: string;
  sandbox: Sandbox;
  sandboxId: string;
  mode: AgentMode;
  /** Ephemeral — lives for the duration of the request */
  emitter: EventEmitter;
  conversationHistory: ModelMessage[];
  status: AgentSessionStatus;
}

// ============================================================
// CREATE — called by POST /api/build/start
// ============================================================

export async function createAgentSession(
  sessionId: string,
  projectId: string,
  userId: string,
  sandboxId: string,
  mode: AgentMode
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("agent_sessions").insert({
    session_id: sessionId,
    project_id: projectId,
    user_id: userId,
    sandbox_id: sandboxId,
    mode,
    status: "idle",
    conversation_history: [],
  });

  if (error) {
    throw new Error(`Failed to create agent session: ${error.message}`);
  }
}

// ============================================================
// RECONNECT — called by message/stream routes
// ============================================================

export async function reconnectSession(
  sessionId: string,
  userId: string
): Promise<ReconnectedSession | null> {
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("agent_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .single();

  if (!row) return null;
  if (row.status === "closed") return null;

  // Reconnect to existing E2B sandbox
  let sandbox: Sandbox;
  try {
    sandbox = await Sandbox.connect(row.sandbox_id as string);
  } catch (err) {
    console.error(
      `[session-manager] Cannot reconnect to sandbox ${row.sandbox_id}:`,
      err instanceof Error ? err.message : err
    );
    // Mark session as closed — sandbox expired
    await supabase
      .from("agent_sessions")
      .update({ status: "closed" })
      .eq("session_id", sessionId);
    return null;
  }

  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  return {
    sessionId: row.session_id as string,
    projectId: row.project_id as string,
    userId: row.user_id as string,
    sandbox,
    sandboxId: row.sandbox_id as string,
    mode: row.mode as AgentMode,
    emitter,
    conversationHistory: (row.conversation_history ?? []) as ModelMessage[],
    status: row.status as AgentSessionStatus,
  };
}

// ============================================================
// SAVE — called after agent step completes
// ============================================================

export async function saveSessionState(
  sessionId: string,
  conversationHistory: ModelMessage[],
  status: AgentSessionStatus
): Promise<void> {
  const supabase = createServiceClient();
  // Map "done" status to "idle" for DB constraint compatibility
  const dbStatus = status === "done" ? "idle" : status;
  await supabase
    .from("agent_sessions")
    .update({
      conversation_history: JSON.parse(JSON.stringify(conversationHistory)),
      status: dbStatus as "idle" | "running" | "error" | "closed",
    })
    .eq("session_id", sessionId);
}

// ============================================================
// OWNERSHIP CHECK — lightweight, no sandbox reconnect
// ============================================================

export async function sessionBelongsTo(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_sessions")
    .select("user_id")
    .eq("session_id", sessionId)
    .single();
  return data?.user_id === userId;
}

// ============================================================
// GET SESSION METADATA — for stream route (no sandbox needed)
// ============================================================

export async function getSessionMeta(
  sessionId: string,
  userId: string
): Promise<{ projectId: string; sandboxId: string; mode: AgentMode; status: AgentSessionStatus } | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_sessions")
    .select("project_id, sandbox_id, mode, status")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .single();

  if (!data || data.status === "closed") return null;

  return {
    projectId: data.project_id as string,
    sandboxId: data.sandbox_id as string,
    mode: data.mode as AgentMode,
    status: data.status as AgentSessionStatus,
  };
}

// ============================================================
// CLOSE — kill sandbox + mark as closed
// ============================================================

export async function closeSession(sessionId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("agent_sessions")
    .select("sandbox_id")
    .eq("session_id", sessionId)
    .single();

  if (data?.sandbox_id) {
    try {
      const sandbox = await Sandbox.connect(data.sandbox_id as string);
      await sandbox.kill();
    } catch {
      // Sandbox may already be dead
    }
  }

  await supabase
    .from("agent_sessions")
    .update({ status: "closed" })
    .eq("session_id", sessionId);
}

// ============================================================
// Event helpers — INSERT into agent_events table (polling-based)
// The SSE stream route polls this table every 500ms.
// No WebSockets, no Realtime — works on Vercel serverless.
// ============================================================

export async function emitEvent(session: ReconnectedSession, event: AgentEvent): Promise<void> {
  // Local emitter (same Lambda / dev)
  session.emitter.emit("agent_event", event);
  // Persist to agent_events table (cross-Lambda, production)
  await writeEvent(session.sessionId, event);
}

export async function emitDone(session: ReconnectedSession): Promise<void> {
  session.emitter.emit("agent_done");
  await writeEvent(session.sessionId, {
    type: "done" as AgentEvent["type"],
    payload: null,
    timestamp: new Date().toISOString(),
  });
}

export async function emitError(session: ReconnectedSession, message: string): Promise<void> {
  const event: AgentEvent = {
    type: "error",
    payload: { message },
    timestamp: new Date().toISOString(),
  };
  session.emitter.emit("agent_event", event);
  session.emitter.emit("agent_error");
  await writeEvent(session.sessionId, event);
}

async function writeEvent(sessionId: string, event: AgentEvent): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("agent_events").insert({
      session_id: sessionId,
      event: JSON.parse(JSON.stringify(event)),
    });
  } catch (err) {
    console.warn("[session-manager] Failed to write event:", err instanceof Error ? err.message : err);
  }
}

/** Delete all events for a session (cleanup after completion) */
export async function cleanupSessionEvents(sessionId: string): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("agent_events").delete().eq("session_id", sessionId);
  } catch {
    // Non-fatal
  }
}
