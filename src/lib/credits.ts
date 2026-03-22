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
 * Crédits de bienvenue offerts à la première inscription (même valeur que le webhook Clerk).
 */
const WELCOME_CREDITS = 2.0;

/**
 * Retourne le user FYREN ou le crée automatiquement si le webhook Clerk
 * n'a pas encore été traité (race condition ou webhook non configuré).
 */
export async function getOrCreateUserByClerkId(
  clerkId: string
): Promise<{ id: string; credits: number }> {
  const existing = await getUserByClerkId(clerkId);
  if (existing) return existing;

  // Auto-création — le webhook Clerk n'a pas encore sync cet utilisateur
  const supabase = createServiceClient();

  // Récupérer l'email depuis Clerk pour rester cohérent avec le webhook
  let email = `${clerkId}@pending.fyren.app`;
  let name: string | null = null;
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkId);
    email = clerkUser.emailAddresses[0]?.emailAddress ?? email;
    name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
  } catch {
    // Clerk SDK non dispo ou erreur — on continue avec le fallback
    console.warn("[getOrCreateUser] Could not fetch Clerk user, using fallback email");
  }

  const { data: newUser, error: insertError } = await supabase
    .from("users")
    .insert({
      clerk_id: clerkId,
      email,
      name,
      credits: WELCOME_CREDITS,
    })
    .select("id, credits")
    .single();

  if (insertError) {
    // Conflit possible si le webhook a créé le user entre-temps (race condition)
    if (insertError.code === "23505") {
      const retry = await getUserByClerkId(clerkId);
      if (retry) return retry;
    }
    throw new Error(`Erreur création utilisateur : ${insertError.message}`);
  }

  // Enregistrer la transaction de bienvenue
  await supabase.from("credit_transactions").insert({
    user_id: newUser.id,
    type: "welcome",
    amount: WELCOME_CREDITS,
    description: "Crédits de bienvenue FYREN",
  });

  return { id: newUser.id, credits: Number(newUser.credits) };
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
