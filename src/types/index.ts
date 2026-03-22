// Shared TypeScript types for FYREN
// Types métier — séparés des types BDD (src/types/database.ts)

// Re-export DB shorthand types pour éviter les imports multiples
export type {
  DbUser,
  DbProject,
  DbServiceConnection,
  DbConversation,
  DbMessage,
  DbCreditTransaction,
} from "./database";

// ============================================================
// DOMAINE : Build Pipeline
// ============================================================

export type BuildStage =
  | "intake"
  | "connect"
  | "scaffold"
  | "build_db"
  | "build_backend"
  | "build_frontend"
  | "review"
  | "deploy"
  | "done";

// ============================================================
// DOMAINE : Project
// ============================================================

export type ProjectStatus = "draft" | "intake" | "building" | "deployed" | "archived";

export type ServiceType = "github" | "vercel" | "supabase" | "clerk" | "stripe" | "resend";

// Vue complète projet avec connexions et conversations
export interface Project {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  cdc_json: Record<string, unknown> | null;
  stack_config: Record<string, unknown> | null;
  sandbox_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceConnection {
  id: string;
  project_id: string;
  service: ServiceType;
  config: Record<string, unknown>; // config chiffrée AES-256-GCM
  status: "pending" | "connected" | "error";
  created_at: string;
}

// ============================================================
// DOMAINE : Chat / Conversations
// ============================================================

export type ConversationType = "intake" | "build" | "iterate";

export type MessageRole = "user" | "assistant" | "system";

export interface Conversation {
  id: string;
  project_id: string;
  type: ConversationType;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  tokens_used: number;
  cost_usd: number;
  created_at: string;
}

// ============================================================
// DOMAINE : Users & Auth
// ============================================================

export interface User {
  id: string;
  clerk_id: string;
  email: string;
  name: string | null;
  credits: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// DOMAINE : Billing & Crédits
// ============================================================

export type CreditTransactionType = "purchase" | "usage" | "refund" | "welcome";

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: CreditTransactionType;
  amount: number; // DECIMAL(10,2) — positif = crédit, négatif = débit
  description: string | null;
  stripe_id: string | null;
  project_id: string | null;
  created_at: string;
}

// ============================================================
// DOMAINE : Agent WebSocket Events
// ============================================================

// ============================================================
// DOMAINE : Agent Modes & Sessions
// ============================================================

export type AgentMode = "intake" | "build" | "iterate";

export type AgentSessionStatus = "idle" | "running" | "done" | "error";

export interface AgentSessionInfo {
  sessionId: string;
  projectId: string;
  sandboxId: string;
  mode: AgentMode;
  status: AgentSessionStatus;
  createdAt: string;
}

// ============================================================
// DOMAINE : Agent WebSocket/SSE Events
// ============================================================

export type AgentEventType =
  | "assistant_message"
  | "tool_use"
  | "tool_result"
  | "file_change"
  | "build_status"
  | "stage_change"
  | "step_done"
  | "error";

export interface AgentEvent {
  type: AgentEventType;
  payload: unknown;
  timestamp: string;
}

// Payload typés pour les events courants
export interface FileChangePayload {
  path: string;
  content: string;
  operation: "create" | "update" | "delete";
}

export interface BuildStatusPayload {
  stage: BuildStage;
  message: string;
  progress: number; // 0-100
}
