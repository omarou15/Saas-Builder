"use client";

// ChatPanel — left side of the workspace.
//
// Responsibilities:
//   1. Display conversation history (loaded from DB on mount)
//   2. Send user messages → POST /api/build/[sessionId]/message
//   3. Listen to SSE stream → display agent responses in real-time
//   4. Show tool_use events as activity indicators
//   5. Show stage_change events as progress steps
//   6. Show "agent is thinking…" indicator during streaming

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Wrench,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  AgentEvent,
  AgentEventType,
  BuildStage,
  Message,
} from "@/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ChatPanelProps {
  projectId: string;
  sessionId: string | null;
  className?: string;
  onStageChange?: (stage: BuildStage, progress: number) => void;
  onAgentDone?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface ToolActivity {
  id: string;
  name: string;
  description: string;
  timestamp: string;
}

// Build pipeline stages for the progress display
const STAGE_LABELS: Record<string, string> = {
  intake: "Intake",
  connect: "Connect",
  scaffold: "Scaffold",
  build_db: "Database",
  build_backend: "Backend",
  build_frontend: "Frontend",
  review: "Review",
  deploy: "Deploy",
  done: "Done",
};

// ─────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-orange-500/20 text-orange-400"
            : "bg-white/5 text-muted-foreground"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-orange-500/10 text-foreground"
            : "bg-white/[0.03] text-foreground"
        )}
      >
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tool activity indicator
// ─────────────────────────────────────────────

function ToolActivityItem({ activity }: { activity: ToolActivity }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-10 text-xs text-muted-foreground">
      <Wrench className="h-3 w-3 shrink-0 text-orange-400/60" />
      <span className="truncate">
        <span className="font-medium text-muted-foreground/80">{activity.name}</span>
        {activity.description && (
          <span className="ml-1 text-muted-foreground/50">{activity.description}</span>
        )}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stage progress bar
// ─────────────────────────────────────────────

function StageProgress({
  currentStage,
  progress,
}: {
  currentStage: string | null;
  progress: number;
}) {
  if (!currentStage) return null;

  return (
    <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
      <ChevronRight className="h-3 w-3 text-orange-400" />
      <span className="text-xs font-medium text-orange-400">
        {STAGE_LABELS[currentStage] ?? currentStage}
      </span>
      <div className="flex-1">
        <div className="h-1 rounded-full bg-white/5">
          <div
            className="h-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {Math.round(progress)}%
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// ChatPanel — main component
// ─────────────────────────────────────────────

export function ChatPanel({
  projectId,
  sessionId,
  className,
  onStageChange,
  onAgentDone,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activities, setActivities] = useState<ToolActivity[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const streamingContentRef = useRef("");
  const streamingMsgIdRef = useRef<string | null>(null);

  // ── Auto-scroll to bottom ──────────────────
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  // ── Load conversation history ──────────────
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/projects/${projectId}/conversations`);
        if (!res.ok) return;
        const convos = (await res.json()) as Array<{
          id: string;
          messages: Message[];
        }>;
        // Flatten all messages from all conversations
        const allMessages: ChatMessage[] = [];
        for (const conv of convos) {
          for (const msg of conv.messages ?? []) {
            allMessages.push({
              id: msg.id,
              role: msg.role as ChatMessage["role"],
              content: msg.content,
              timestamp: msg.created_at,
            });
          }
        }
        // Sort by timestamp
        allMessages.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setMessages(allMessages);
        scrollToBottom();
      } catch {
        // Non-fatal — empty chat is fine
      }
    }
    void loadHistory();
  }, [projectId, scrollToBottom]);

  // ── SSE stream listener ────────────────────
  useEffect(() => {
    if (!sessionId) return;

    sseRef.current?.close();

    const sse = new EventSource(`/api/build/${sessionId}/stream`);
    sseRef.current = sse;

    sse.onmessage = (event: MessageEvent<string>) => {
      if (!event.data || event.data.trim() === "") return;

      let parsed: AgentEvent;
      try {
        parsed = JSON.parse(event.data) as AgentEvent;
      } catch {
        return;
      }

      handleAgentEvent(parsed);
    };

    sse.onerror = () => {
      // SSE auto-reconnects
    };

    return () => {
      sse.close();
      sseRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── Handle agent events ────────────────────
  const handleAgentEvent = useCallback(
    (event: AgentEvent) => {
      const type = event.type as AgentEventType | "done";

      switch (type) {
        case "assistant_message": {
          const text = (event.payload as { content?: string })?.content ?? "";
          setStreaming(true);

          if (!streamingMsgIdRef.current) {
            // Start new streaming message
            const id = `stream-${Date.now()}`;
            streamingMsgIdRef.current = id;
            streamingContentRef.current = text;
            setMessages((prev) => [
              ...prev,
              {
                id,
                role: "assistant",
                content: text,
                timestamp: event.timestamp,
              },
            ]);
          } else {
            // Append to existing streaming message
            streamingContentRef.current += text;
            const currentContent = streamingContentRef.current;
            const currentId = streamingMsgIdRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentId ? { ...m, content: currentContent } : m
              )
            );
          }
          scrollToBottom();
          break;
        }

        case "tool_use": {
          const payload = event.payload as {
            name?: string;
            description?: string;
          };
          setActivities((prev) => [
            ...prev,
            {
              id: `tool-${Date.now()}-${Math.random()}`,
              name: payload.name ?? "tool",
              description: payload.description ?? "",
              timestamp: event.timestamp,
            },
          ]);
          scrollToBottom();
          break;
        }

        case "stage_change": {
          const payload = event.payload as {
            stage?: string;
            progress?: number;
          };
          if (payload.stage) {
            setCurrentStage(payload.stage);
            setProgress(payload.progress ?? 0);
            onStageChange?.(
              payload.stage as BuildStage,
              payload.progress ?? 0
            );
          }
          break;
        }

        case "build_status": {
          const payload = event.payload as {
            stage?: string;
            progress?: number;
            message?: string;
          };
          if (payload.progress !== undefined) {
            setProgress(payload.progress);
          }
          if (payload.stage) {
            setCurrentStage(payload.stage);
          }
          break;
        }

        case "step_done": {
          // Finalize the streaming message
          streamingMsgIdRef.current = null;
          streamingContentRef.current = "";
          setStreaming(false);
          break;
        }

        case "error": {
          const payload = event.payload as { message?: string };
          setError(payload.message ?? "An error occurred");
          setStreaming(false);
          streamingMsgIdRef.current = null;
          streamingContentRef.current = "";
          break;
        }

        case "done": {
          setStreaming(false);
          streamingMsgIdRef.current = null;
          streamingContentRef.current = "";
          onAgentDone?.();
          break;
        }
      }
    },
    [scrollToBottom, onStageChange, onAgentDone]
  );

  // ── Send message ───────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !sessionId || sending || streaming) return;

    setSending(true);
    setError(null);

    // Optimistic: add user message immediately
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    scrollToBottom();

    try {
      const res = await fetch(`/api/build/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? `Error ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
    }
  }, [input, sessionId, sending, streaming, scrollToBottom]);

  // ── Handle Enter key ──────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  // ── Render ─────────────────────────────────

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Stage progress */}
      <StageProgress currentStage={currentStage} progress={progress} />

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
                <Bot className="h-6 w-6 text-orange-400" />
              </div>
              <p className="text-sm font-medium">FYREN Agent</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Décris ton projet et l&apos;agent va construire ton app étape
                par étape.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={msg.id}>
              <MessageBubble msg={msg} />
              {/* Show tool activities after assistant messages */}
              {msg.role === "assistant" &&
                activities
                  .filter((a) => {
                    const msgTime = new Date(msg.timestamp).getTime();
                    const nextMsg = messages[idx + 1];
                    const nextTime = nextMsg
                      ? new Date(nextMsg.timestamp).getTime()
                      : Infinity;
                    const actTime = new Date(a.timestamp).getTime();
                    return actTime >= msgTime && actTime < nextTime;
                  })
                  .map((a) => <ToolActivityItem key={a.id} activity={a} />)}
            </div>
          ))}

          {/* Streaming indicator */}
          {streaming && !streamingMsgIdRef.current && (
            <div className="flex items-center gap-2 pl-10 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
              <span>L&apos;agent réfléchit…</span>
            </div>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 border-t border-red-500/20 bg-red-500/5 px-4 py-2 text-xs text-red-400">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="truncate">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto shrink-0 text-red-400/60 hover:text-red-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-white/5 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              sessionId
                ? "Décris ce que tu veux construire…"
                : "Démarre une session pour envoyer un message"
            }
            disabled={!sessionId || sending}
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none border-white/5 bg-white/[0.02] text-sm placeholder:text-muted-foreground/40 focus-visible:ring-orange-500/30"
          />
          <Button
            size="icon"
            onClick={() => void handleSend()}
            disabled={!sessionId || !input.trim() || sending || streaming}
            className="h-10 w-10 shrink-0 bg-orange-500 text-white hover:bg-orange-400 disabled:opacity-30"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
