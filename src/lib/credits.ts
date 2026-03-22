// Helpers crédits FYREN
// Toutes les opérations sur les crédits utilisent le service role
// (pas de RLS bypass intentionnel — c'est le seul endroit autorisé à écrire).

import { createServiceClient } from "@/lib/supabase";

/**
 * Retourne le solde crédits d'un user (par son FYREN UUID).
 */
export async function getUserCredits(userId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("credits")
    .eq("id", userId)
    .single();

  if (error || !data) return 0;
  return Number(data.credits);
}

/**
 * Retourne le FYREN UUID + crédits à partir du clerk_id.
 * Utilisé dans les API routes (on a le clerk_id via auth(), pas l'UUID).
 */
export async function getUserByClerkId(
  clerkId: string
): Promise<{ id: string; credits: number } | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, credits")
    .eq("clerk_id", clerkId)
    .single();

  if (error || !data) return null;
  return { id: data.id, credits: Number(data.credits) };
}

/**
 * Débite les crédits de manière atomique via RPC Postgres.
 * Lance une exception si le solde est insuffisant.
 *
 * @param userId     FYREN UUID (pas le clerk_id)
 * @param amount     Montant à débiter (positif)
 * @param description Label pour la transaction (visible en billing)
 * @param projectId  FK optionnelle vers le projet
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  projectId?: string
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_project_id: projectId ?? null,
  });

  if (error) {
    // Le message Postgres commence par "insufficient_credits:" si c'est un solde insuffisant
    if (error.message.includes("insufficient_credits")) {
      throw new InsufficientCreditsError(amount);
    }
    throw new Error(`Erreur débit crédits : ${error.message}`);
  }
}

export class InsufficientCreditsError extends Error {
  readonly required: number;

  constructor(required: number) {
    super(`Crédits insuffisants. Requis : $${required.toFixed(4)}`);
    this.name = "InsufficientCreditsError";
    this.required = required;
  }
}

/**
 * Calcule le coût en crédits FYREN à partir du coût OpenRouter.
 * Règle : coût × 3 (marge × 3)
 */
export function toCreditCost(openrouterCostUsd: number): number {
  return openrouterCostUsd * 3;
}

// Prix approximatifs OpenRouter (USD / 1M tokens) — mis à jour manuellement
// Source : https://openrouter.ai/models
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-4-5": { input: 3.0, output: 15.0 },
  "anthropic/claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "openai/gpt-4o": { input: 2.5, output: 10.0 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
};

const DEFAULT_PRICING = { input: 3.0, output: 15.0 }; // fallback conservative

/**
 * Estime le coût OpenRouter pour un usage donné.
 * À utiliser pour l'estimation AVANT l'appel (vérification crédits).
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
