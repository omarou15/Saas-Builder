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
//   7. Upload files (images, PDF, code) → POST /api/upload → inject in message
//   8. Drag & drop files onto the chat area
//   9. Show WebSearch activity with a specific indicator

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
  Paperclip,
  X,
  FileText,
  Globe,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import type {
  AgentEvent,
  AgentEventType,
  BuildStage,
  Message,
  MessageAttachment,
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
  /** Preview error to display as a banner with "Try to Fix" button */
  pendingError?: {
    type: "runtime" | "build";
    message: string;
    file?: string;
    stack?: string;
  } | null;
  /** Called when user clicks "Try to Fix" */
  onTryToFix?: () => void;
  /** Called to dismiss the error banner */
  onDismissError?: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  attachments?: UploadedFile[];
}

interface ToolActivity {
  id: string;
  name: string;
  description: string;
  timestamp: string;
}

interface UploadedFile {
  type: "text" | "image";
  content: string;
  filename: string;
  mimeType?: string;
  uploading?: boolean;
  error?: string;
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

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/png", "image/jpeg", "image/webp", "image/gif",
  "text/plain", "text/html", "text/css", "text/markdown",
  "application/json", "application/javascript", "application/typescript",
].join(",");

const MAX_FILE_SIZE_MB = 10;

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
        {/* Attached files preview */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {msg.attachments.map((f, i) => (
              <AttachmentPreview key={`${f.filename}-${i}`} file={f} compact />
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tool activity indicator
// ─────────────────────────────────────────────

function ToolActivityItem({ activity }: { activity: ToolActivity }) {
  const isWebSearch = activity.name === "WebSearch";

  return (
    <div className="flex items-center gap-2 py-1 pl-10 text-xs text-muted-foreground">
      {isWebSearch ? (
        <Globe className="h-3 w-3 shrink-0 text-blue-400/60" />
      ) : (
        <Wrench className="h-3 w-3 shrink-0 text-orange-400/60" />
      )}
      <span className="truncate">
        <span className={cn(
          "font-medium",
          isWebSearch ? "text-blue-400/80" : "text-muted-foreground/80"
        )}>
          {isWebSearch ? "Recherche web" : activity.name}
        </span>
        {activity.description && (
          <span className="ml-1 text-muted-foreground/50">{activity.description}</span>
        )}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Attachment preview (in input area and in messages)
// ─────────────────────────────────────────────

function AttachmentPreview({
  file,
  compact,
  onRemove,
}: {
  file: UploadedFile;
  compact?: boolean;
  onRemove?: () => void;
}) {
  const isImage = file.type === "image";

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02]",
        compact ? "px-2 py-1" : "px-2.5 py-1.5"
      )}
    >
      {file.uploading && (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-orange-400" />
      )}
      {file.error && (
        <AlertCircle className="h-3 w-3 shrink-0 text-red-400" />
      )}
      {!file.uploading && !file.error && (
        isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.content}
            alt={file.filename}
            className="h-8 w-8 rounded object-cover"
          />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )
      )}
      <span className={cn(
        "truncate text-xs",
        file.error ? "text-red-400" : "text-muted-foreground"
      )}>
        {file.error ?? file.filename}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground/50 transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
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
  pendingError,
  onTryToFix,
  onDismissError,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activities, setActivities] = useState<ToolActivity[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const streamingContentRef = useRef("");
  const streamingMsgIdRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        allMessages.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setMessages(allMessages);
        scrollToBottom();
      } catch {
        // Non-fatal
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
            tool?: string;
            name?: string;
            input?: Record<string, unknown>;
            description?: string;
          };
          const toolName = payload.tool ?? payload.name ?? "tool";
          let description = payload.description ?? "";

          // Special handling for WebSearch — show the query
          if (toolName === "WebSearch" && payload.input) {
            const query = (payload.input as { query?: string }).query;
            if (query) {
              description = `"${query}"`;
            }
          }

          setActivities((prev) => [
            ...prev,
            {
              id: `tool-${Date.now()}-${Math.random()}`,
              name: toolName,
              description,
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

  // ── Upload file ────────────────────────────
  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setPendingFiles((prev) => [
        ...prev,
        {
          type: "text",
          content: "",
          filename: file.name,
          error: `Trop volumineux (${(file.size / 1024 / 1024).toFixed(1)}MB > ${MAX_FILE_SIZE_MB}MB)`,
        },
      ]);
      return;
    }

    // Add placeholder
    const placeholder: UploadedFile = {
      type: file.type.startsWith("image/") ? "image" : "text",
      content: "",
      filename: file.name,
      uploading: true,
    };

    setPendingFiles((prev) => [...prev, placeholder]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as {
        type?: "text" | "image";
        content?: string;
        filename?: string;
        mimeType?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f === placeholder
              ? { ...f, uploading: false, error: data.error ?? "Upload failed" }
              : f
          )
        );
        return;
      }

      setPendingFiles((prev) =>
        prev.map((f) =>
          f === placeholder
            ? {
                type: data.type ?? "text",
                content: data.content ?? "",
                filename: data.filename ?? file.name,
                mimeType: data.mimeType,
                uploading: false,
              }
            : f
        )
      );
    } catch (err) {
      setPendingFiles((prev) =>
        prev.map((f) =>
          f === placeholder
            ? {
                ...f,
                uploading: false,
                error: err instanceof Error ? err.message : "Upload failed",
              }
            : f
        )
      );
    }
  }, []);

  // ── Handle file input change ───────────────
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (const file of Array.from(files)) {
        void uploadFile(file);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [uploadFile]
  );

  // ── Drag & drop ────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      for (const file of Array.from(files)) {
        void uploadFile(file);
      }
    },
    [uploadFile]
  );

  // ── Remove pending file ────────────────────
  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Send message ───────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    const validFiles = pendingFiles.filter((f) => !f.uploading && !f.error);
    if ((!text && validFiles.length === 0) || !sessionId || sending || streaming) return;

    setSending(true);
    setError(null);

    // Build attachments for the API
    const attachments: MessageAttachment[] = validFiles.map((f) => ({
      type: f.type,
      content: f.content,
      filename: f.filename,
      mimeType: f.mimeType,
    }));

    // Optimistic: add user message immediately
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text || (validFiles.length > 0 ? `[${validFiles.map((f) => f.filename).join(", ")}]` : ""),
      timestamp: new Date().toISOString(),
      attachments: validFiles,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingFiles([]);
    scrollToBottom();

    try {
      const res = await fetch(`/api/build/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text || `Voici ${validFiles.length} fichier(s) : ${validFiles.map((f) => f.filename).join(", ")}`,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
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
  }, [input, pendingFiles, sessionId, sending, streaming, scrollToBottom]);

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

  // ── Derived state ──────────────────────────
  const hasUploadingFiles = pendingFiles.some((f) => f.uploading);
  const hasValidFiles = pendingFiles.some((f) => !f.uploading && !f.error);
  const canSend = sessionId && !sending && !streaming && !hasUploadingFiles && (input.trim() || hasValidFiles);

  // ── Render ─────────────────────────────────

  return (
    <div
      className={cn("flex h-full min-w-0 flex-col bg-background", className)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Stage progress */}
      <StageProgress currentStage={currentStage} progress={progress} />

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-orange-500/50 bg-orange-500/5 px-8 py-6">
            <Paperclip className="h-8 w-8 text-orange-400" />
            <p className="text-sm font-medium text-orange-400">
              Dépose tes fichiers ici
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, images, code — max {MAX_FILE_SIZE_MB}MB
            </p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 ring-1 ring-orange-500/20">
                <Bot className="h-7 w-7 text-orange-400" />
              </div>
              <p className="text-base font-semibold">FYREN Agent</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Décris ton projet et l&apos;agent va construire ton app étape par étape.
              </p>

              {/* Suggestion chips */}
              <div className="mt-6 flex flex-col gap-2 w-full max-w-sm">
                {[
                  "Je veux migrer mon app Lovable",
                  "Je veux créer un SaaS from scratch",
                  "J'ai un projet existant à améliorer",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm text-muted-foreground transition-all hover:border-orange-500/30 hover:bg-orange-500/[0.04] hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
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

      {/* Preview error banner — "Try to Fix" */}
      {pendingError && (
        <div className="border-t border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-orange-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-orange-400">
                {pendingError.type === "build" ? "Build error" : "Runtime error"} detected
              </p>
              <pre className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap break-all max-h-20 overflow-y-auto font-mono">
                {pendingError.message}
                {pendingError.file && `\nFile: ${pendingError.file}`}
              </pre>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={onTryToFix}
                  disabled={!sessionId || sending || streaming}
                  className="flex items-center gap-1.5 rounded-md bg-orange-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-400 disabled:opacity-40"
                >
                  <Zap className="h-3 w-3" />
                  Try to Fix
                </button>
                <button
                  onClick={onDismissError}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-white/5 px-3 py-2">
          {pendingFiles.map((file, idx) => (
            <AttachmentPreview
              key={`${file.filename}-${idx}`}
              file={file}
              onRemove={() => removePendingFile(idx)}
            />
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-white/5 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 transition-colors focus-within:border-orange-500/30">
          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!sessionId || sending}
            title="Joindre un fichier"
            className="shrink-0 self-end pb-0.5 text-muted-foreground/50 transition-colors hover:text-orange-400 disabled:opacity-30"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_FILE_TYPES}
            multiple
            onChange={handleFileSelect}
          />

          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              sessionId
                ? "Décris ton projet..."
                : "Démarre une session pour envoyer un message"
            }
            disabled={!sessionId || sending}
            rows={1}
            className="min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent p-0 text-sm shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="shrink-0 self-end rounded-lg bg-orange-500 p-1.5 text-white transition-colors hover:bg-orange-400 disabled:bg-white/5 disabled:text-muted-foreground/30"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground/40">
          Entrée pour envoyer · Shift+Entrée pour un retour à la ligne
        </p>
      </div>
    </div>
  );
}
