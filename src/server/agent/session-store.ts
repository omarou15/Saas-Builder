// FYREN — In-memory agent session store
// Each active build session is stored here as long as the process runs.
// WARNING: single-process only (Vercel single-instance).
// TODO V2: migrate to Redis pub/sub for multi-instance Vercel deployments.

import { EventEmitter } from "events";
import type { Sandbox } from "e2b";
import type { ModelMessage } from "ai";
import type { AgentMode, AgentSessionStatus, AgentEvent } from "@/types";

// ============================================================
// Types
// ============================================================

export interface AgentSession {
  sessionId: string;
  projectId: string;
  userId: string;
  sandbox: Sandbox;
  sandboxId: string;
  mode: AgentMode;
  /** SSE event bus — frontend subscribes, agent runner emits */
  emitter: EventEmitter;
  /** Full conversation history (user + assistant turns + tool results) */
  conversationHistory: ModelMessage[];
  status: AgentSessionStatus;
  /** NodeJS interval handle for the E2B heartbeat */
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  createdAt: Date;
}

// ============================================================
// Global store (module-level singleton)
// ============================================================

const sessions = new Map<string, AgentSession>();

// ============================================================
// CRUD
// ============================================================

export function createSession(
  sessionId: string,
  projectId: string,
  userId: string,
  sandbox: Sandbox,
  sandboxId: string,
  mode: AgentMode
): AgentSession {
  const emitter = new EventEmitter();
  // Increase listener limit to handle multiple SSE connections per session
  emitter.setMaxListeners(20);

  const session: AgentSession = {
    sessionId,
    projectId,
    userId,
    sandbox,
    sandboxId,
    mode,
    emitter,
    conversationHistory: [],
    status: "idle",
    heartbeatInterval: null,
    createdAt: new Date(),
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): AgentSession | undefined {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    if (session.heartbeatInterval) {
      clearInterval(session.heartbeatInterval);
    }
    session.emitter.removeAllListeners();
    sessions.delete(sessionId);
  }
}

/** Returns true if the sessionId exists AND belongs to the given userId */
export function sessionBelongsTo(sessionId: string, userId: string): boolean {
  const session = sessions.get(sessionId);
  return session?.userId === userId;
}

// ============================================================
// Event helpers
// ============================================================

/** Emit a typed AgentEvent on the session's EventEmitter */
export function emitEvent(session: AgentSession, event: AgentEvent): void {
  session.emitter.emit("agent_event", event);
}

/** Emit the terminal "session complete" signal */
export function emitDone(session: AgentSession): void {
  session.emitter.emit("agent_done");
}

/** Emit an error event */
export function emitError(session: AgentSession, message: string): void {
  const event: AgentEvent = {
    type: "error",
    payload: { message },
    timestamp: new Date().toISOString(),
  };
  session.emitter.emit("agent_event", event);
  session.emitter.emit("agent_error");
}

// ============================================================
// Heartbeat
// ============================================================

/** Start a heartbeat interval that keeps the E2B sandbox alive */
export function startHeartbeat(
  session: AgentSession,
  keepAliveFn: (sandbox: Sandbox) => Promise<void>,
  intervalMs = 5 * 60 * 1000 // every 5 minutes
): void {
  if (session.heartbeatInterval) {
    clearInterval(session.heartbeatInterval);
  }

  session.heartbeatInterval = setInterval(() => {
    keepAliveFn(session.sandbox).catch((err) => {
      console.warn(
        `[session-store] Heartbeat failed for session ${session.sessionId}:`,
        err instanceof Error ? err.message : "unknown"
      );
    });
  }, intervalMs);
}

/** Stop the heartbeat interval */
export function stopHeartbeat(session: AgentSession): void {
  if (session.heartbeatInterval) {
    clearInterval(session.heartbeatInterval);
    session.heartbeatInterval = null;
  }
}
