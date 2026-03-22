// FYREN — Agent Runner
// Core agent execution loop using Vercel AI SDK v6 + OpenRouter.
//
// Architecture:
//   Frontend → POST /api/build/[id]/message
//     → runAgentStep()
//       → generateText (multi-step via stopWhen, tools, onStepFinish)
//         → session.emitter.emit("agent_event", ...)
//   Frontend ← GET /api/build/[id]/stream (SSE)
//     subscribes to session.emitter
//
// ai v6 API notes:
//   - maxSteps → stopWhen: stepCountIs(n)
//   - CoreMessage → ModelMessage
//   - toolCall.args → toolCall.input
//   - toolResult.result → toolResult.output

import { generateText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { ModelMessage } from "ai";
import { createAgentTools, INTAKE_TOOLS, BUILD_TOOLS, ITERATE_TOOLS } from "./tools";
import { emitEvent, emitError, saveSessionState, cleanupSessionEvents } from "./session-manager";
import type { ReconnectedSession } from "./session-manager";
import { INTAKE_PROMPT, BUILD_PROMPT, ITERATE_PROMPT } from "./prompts";
import { deductCredits, toCreditCost, estimateCost } from "@/lib/credits";
import { createServiceClient } from "@/lib/supabase";
import type { AgentEvent, AgentMode, FileChangePayload, MessageAttachment } from "@/types";
import { sanitizeForLog } from "@/lib/utils";

// ============================================================
// OpenRouter client (same pattern as /api/chat)
// ============================================================

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://fyren.app",
    "X-Title": "FYREN Platform",
  },
});

// ============================================================
// Mode configuration
// ============================================================

const MODE_MODEL: Record<AgentMode, string> = {
  intake: "anthropic/claude-sonnet-4-6",
  build: "anthropic/claude-sonnet-4-6",
  iterate: "anthropic/claude-sonnet-4-6",
};

const MODE_SYSTEM_PROMPT: Record<AgentMode, string> = {
  intake: INTAKE_PROMPT,
  build: BUILD_PROMPT,
  iterate: ITERATE_PROMPT,
};

const MODE_MAX_TURNS: Record<AgentMode, number> = {
  intake: 50,
  build: 40,
  iterate: 30,
};

// ============================================================
// Main entry point
// ============================================================

/**
 * Run one agent step: takes a user message, executes the agent loop,
 * and emits all events to session.emitter.
 */
export async function runAgentStep(
  session: ReconnectedSession,
  userMessage: string,
  attachments?: MessageAttachment[]
): Promise<void> {
  if (session.status === "running") {
    emitError(session, "Agent is already running. Wait for the current step to finish.");
    return;
  }

  session.status = "running";

  // Emit user message back to frontend (for display in chat)
  const userEvent: AgentEvent = {
    type: "assistant_message",
    payload: { role: "user", content: userMessage },
    timestamp: new Date().toISOString(),
  };
  await emitEvent(session, userEvent);

  // Build user message — multimodal if attachments include images
  const userMsg = buildUserMessage(userMessage, attachments);
  session.conversationHistory.push(userMsg);

  // File changes accumulated during this step
  const fileChanges: FileChangePayload[] = [];

  // Build tools restricted to mode
  const allTools = createAgentTools(session.sandbox, (payload: FileChangePayload) => {
    fileChanges.push(payload);
    void emitEvent(session, {
      type: "file_change",
      payload,
      timestamp: new Date().toISOString(),
    });
  });

  const allowedNames = getModeTools(session.mode);
  const tools = Object.fromEntries(
    Object.entries(allTools).filter(([name]) => allowedNames.includes(name as keyof typeof allTools))
  ) as typeof allTools;

  const model = MODE_MODEL[session.mode];
  const systemPrompt = MODE_SYSTEM_PROMPT[session.mode];
  const maxTurns = MODE_MAX_TURNS[session.mode];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const result = await generateText({
      model: openrouter.chat(model),
      system: systemPrompt,
      messages: session.conversationHistory,
      tools,
      // ai v6: use stopWhen instead of maxSteps
      stopWhen: stepCountIs(maxTurns),
      onStepFinish: async (step) => {
        // Accumulate token usage
        if (step.usage) {
          totalInputTokens += step.usage.inputTokens ?? 0;
          totalOutputTokens += step.usage.outputTokens ?? 0;
        }

        // Emit assistant text
        if (step.text?.trim()) {
          await emitEvent(session, {
            type: "assistant_message",
            payload: { role: "assistant", content: step.text },
            timestamp: new Date().toISOString(),
          });
        }

        // Emit tool_use events (ai v6: toolCall.input instead of args)
        for (const toolCall of step.toolCalls ?? []) {
          const sanitizedInput = sanitizeToolInput(toolCall.toolName, toolCall.input);
          await emitEvent(session, {
            type: "tool_use",
            payload: {
              tool: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              input: sanitizedInput,
            },
            timestamp: new Date().toISOString(),
          });
        }

        // Emit tool_result events (ai v6: toolResult.output instead of result)
        for (const toolResult of step.toolResults ?? []) {
          await emitEvent(session, {
            type: "tool_result",
            payload: {
              toolCallId: toolResult.toolCallId,
              toolName: toolResult.toolName,
              output: truncate(String(toolResult.output), 2000),
            },
            timestamp: new Date().toISOString(),
          });
        }
      },
    });

    // Update conversation history with all messages from this run
    if (result.response?.messages) {
      for (const msg of result.response.messages) {
        session.conversationHistory.push(msg as ModelMessage);
      }
    }

    // ——————————————————————————————————————————
    // Token accounting → credits deduction (rule: coût × 3)
    // ——————————————————————————————————————————
    const costUsd = estimateCost(model, totalInputTokens, totalOutputTokens);
    const creditCost = toCreditCost(costUsd);

    if (creditCost > 0) {
      try {
        await deductCredits(
          session.userId,
          creditCost,
          `Agent ${session.mode} — ${totalInputTokens + totalOutputTokens} tokens`,
          session.projectId
        );
      } catch (err) {
        // Non-fatal — don't crash the session for a billing error
        console.error(
          `[agent-runner] Credit deduction failed for session ${sanitizeForLog(session.sessionId)}:`,
          err instanceof Error ? err.message : "unknown"
        );
      }
    }

    // Persist final assistant message to DB
    if (result.text) {
      await saveAssistantMessage(
        session.projectId,
        session.mode,
        result.text,
        totalInputTokens + totalOutputTokens,
        costUsd
      );
    }

    // Emit step_done so frontend knows agent is idle again
    await emitEvent(session, {
      type: "step_done",
      payload: {
        tokensUsed: totalInputTokens + totalOutputTokens,
        creditsDeducted: creditCost,
        fileChanges: fileChanges.length,
      },
      timestamp: new Date().toISOString(),
    });

    session.status = "idle";
  } catch (err) {
    session.status = "error";
    const message = err instanceof Error ? err.message : "Unknown error during agent execution";
    console.error(
      `[agent-runner] Error in session ${sanitizeForLog(session.sessionId)}:`,
      message
    );
    emitError(session, message);
  } finally {
    // Persist state to Supabase (even on error)
    await saveSessionState(session.sessionId, session.conversationHistory, session.status).catch((err) => {
      console.error("[agent-runner] Failed to save session state:", err instanceof Error ? err.message : err);
    });
    // Clean up events from agent_events table (they've been consumed by the SSE stream)
    // Delay cleanup slightly to give the polling stream time to read the final events
    setTimeout(() => {
      void cleanupSessionEvents(session.sessionId);
    }, 5000);
  }
}

// ============================================================
// Stage-based entry point (for build pipeline orchestration)
// ============================================================

/**
 * Used by the build pipeline state machine.
 * Translates BuildStage → AgentMode and injects stage-specific context.
 */
export async function runBuildStage(
  session: ReconnectedSession,
  stage: string,
  stageContext: string
): Promise<void> {
  const buildStageMap: Record<string, AgentMode> = {
    intake: "intake",
    scaffold: "build",
    build_db: "build",
    build_backend: "build",
    build_frontend: "build",
    review: "build",
    iterate: "iterate",
  };

  const mode = buildStageMap[stage] ?? "build";
  session.mode = mode;

  // Emit stage change event to frontend
  await emitEvent(session, {
    type: "stage_change",
    payload: { stage, message: `Starting stage: ${stage}` },
    timestamp: new Date().toISOString(),
  });

  await runAgentStep(session, stageContext);
}

// ============================================================
// Helpers
// ============================================================

function getModeTools(mode: AgentMode): string[] {
  if (mode === "intake") return INTAKE_TOOLS as string[];
  if (mode === "build") return BUILD_TOOLS as string[];
  return ITERATE_TOOLS as string[];
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + " [truncated]" : str;
}

/** Redact potential secrets from Bash tool inputs before logging/emitting */
function sanitizeToolInput(toolName: string, input: unknown): unknown {
  if (toolName === "Bash" && typeof input === "object" && input !== null) {
    const { command } = input as { command: string };
    const sanitized = command.replace(
      /([a-z_]*(?:key|token|secret|password)[a-z_]*\s*=\s*)[^\s&;'"]+/gi,
      "$1[REDACTED]"
    );
    return { command: sanitized };
  }
  return input;
}

/**
 * Build a user message, potentially multimodal (text + images).
 * Text attachments are appended to the message content.
 * Image attachments are sent as image parts for vision.
 */
function buildUserMessage(
  text: string,
  attachments?: MessageAttachment[]
): ModelMessage {
  if (!attachments || attachments.length === 0) {
    return { role: "user", content: text };
  }

  // Separate text and image attachments
  const textParts: string[] = [text];
  const imageParts: Array<{ type: "image"; image: URL | string; mimeType?: string }> = [];

  for (const attachment of attachments) {
    if (attachment.type === "text") {
      textParts.push(`\n\n--- Fichier : ${attachment.filename} ---\n${attachment.content}`);
    } else if (attachment.type === "image") {
      // Extract base64 data from data URL
      const base64Match = attachment.content.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        imageParts.push({
          type: "image",
          image: attachment.content,
          mimeType: base64Match[1],
        });
      }
    }
  }

  // If no images, return a simple text message with appended file contents
  if (imageParts.length === 0) {
    return { role: "user", content: textParts.join("") };
  }

  // Multimodal message: text + images
  // Vercel AI SDK v6 supports content arrays with text and image parts
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: URL | string; mimeType?: string }
  > = [
    { type: "text", text: textParts.join("") },
    ...imageParts,
  ];

  return { role: "user", content } as ModelMessage;
}

/** Persist assistant message to conversations/messages tables */
async function saveAssistantMessage(
  projectId: string,
  mode: AgentMode,
  content: string,
  tokensUsed: number,
  costUsd: number
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const convType = mode === "intake" ? "intake" : mode === "iterate" ? "iterate" : "build";

    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("project_id", projectId)
      .eq("type", convType)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conv) return;

    await supabase.from("messages").insert({
      conversation_id: conv.id,
      role: "assistant",
      content,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
    });
  } catch {
    // Non-fatal — persistence failure should not crash the agent
  }
}
