// Database types — FYREN Platform
// Générés manuellement depuis le schéma Supabase (supabase/migrations/20260321000000_initial_schema.sql)
// À regénérer avec `supabase gen types typescript` une fois le projet Supabase créé

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  // Required by @supabase/supabase-js v2.49+
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_id: string;
          email: string;
          name: string | null;
          credits: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_id: string;
          email: string;
          name?: string | null;
          credits?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_id?: string;
          email?: string;
          name?: string | null;
          credits?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          slug: string;
          status: "draft" | "intake" | "building" | "deployed" | "archived";
          cdc_json: Json | null;
          stack_config: Json | null;
          sandbox_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          slug: string;
          status?: "draft" | "intake" | "building" | "deployed" | "archived";
          cdc_json?: Json | null;
          stack_config?: Json | null;
          sandbox_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          slug?: string;
          status?: "draft" | "intake" | "building" | "deployed" | "archived";
          cdc_json?: Json | null;
          stack_config?: Json | null;
          sandbox_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      service_connections: {
        Row: {
          id: string;
          project_id: string;
          service: "github" | "vercel" | "supabase" | "clerk" | "stripe" | "resend";
          config: Json;
          status: "pending" | "connected" | "error";
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          service: "github" | "vercel" | "supabase" | "clerk" | "stripe" | "resend";
          config: Json;
          status?: "pending" | "connected" | "error";
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          service?: "github" | "vercel" | "supabase" | "clerk" | "stripe" | "resend";
          config?: Json;
          status?: "pending" | "connected" | "error";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_connections_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          project_id: string;
          type: "intake" | "build" | "iterate";
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          type: "intake" | "build" | "iterate";
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          type?: "intake" | "build" | "iterate";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          tokens_used: number;
          cost_usd: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          tokens_used?: number;
          cost_usd?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant" | "system";
          content?: string;
          tokens_used?: number;
          cost_usd?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: "purchase" | "usage" | "refund" | "welcome";
          amount: number;
          description: string | null;
          stripe_id: string | null;
          project_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "purchase" | "usage" | "refund" | "welcome";
          amount: number;
          description?: string | null;
          stripe_id?: string | null;
          project_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "purchase" | "usage" | "refund" | "welcome";
          amount?: number;
          description?: string | null;
          stripe_id?: string | null;
          project_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_transactions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_sessions: {
        Row: {
          id: string;
          session_id: string;
          project_id: string;
          user_id: string;
          sandbox_id: string;
          mode: "intake" | "build" | "iterate";
          status: "idle" | "running" | "error" | "closed";
          conversation_history: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          project_id: string;
          user_id: string;
          sandbox_id: string;
          mode: "intake" | "build" | "iterate";
          status?: "idle" | "running" | "error" | "closed";
          conversation_history?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          project_id?: string;
          user_id?: string;
          sandbox_id?: string;
          mode?: "intake" | "build" | "iterate";
          status?: "idle" | "running" | "error" | "closed";
          conversation_history?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_sessions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_events: {
        Row: {
          id: number;
          session_id: string;
          event: Json;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: string;
          event: Json;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: string;
          event?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      user_credit_balance: {
        Row: {
          user_id: string;
          clerk_id: string;
          email: string;
          balance: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      deduct_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_description: string;
          p_project_id?: string | null;
        };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
}

// Shorthand helpers
export type DbUser = Database["public"]["Tables"]["users"]["Row"];
export type DbProject = Database["public"]["Tables"]["projects"]["Row"];
export type DbServiceConnection = Database["public"]["Tables"]["service_connections"]["Row"];
export type DbConversation = Database["public"]["Tables"]["conversations"]["Row"];
export type DbMessage = Database["public"]["Tables"]["messages"]["Row"];
export type DbCreditTransaction = Database["public"]["Tables"]["credit_transactions"]["Row"];
