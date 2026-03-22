import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createServiceClient } from "@/lib/supabase";
import {
  getUserByClerkId,
  deductCredits,
  toCreditCost,
  estimateCost,
  InsufficientCreditsError,
} from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

// ============================================================
// OpenRouter — provider OpenAI-compatible
// On n'appelle JAMAIS OpenRouter côté client (règle critique FYREN)
// ============================================================

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  // Headers recommandés par OpenRouter pour les stats/rankings
  headers: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://fyren.app",
    "X-Title": "FYREN Platform",
  },
});

// ============================================================
// Schéma Zod
// ============================================================

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1, "Au moins un message requis"),
  projectId: z.string().uuid("projectId doit être un UUID valide"),
  conversationId: z.string().uuid().optional(),
  model: z
    .string()
    .default("anthropic/claude-sonnet-4-5")
    .refine(
      (m) => ALLOWED_MODELS.has(m),
      (m) => ({ message: `Modèle non autorisé : ${m}` })
    ),
  systemPrompt: z.string().max(8000).optional(),
});

// Modèles autorisés via OpenRouter
const ALLOWED_MODELS = new Set([
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.0-flash",
]);

// Seuil minimum de crédits pour démarrer un appel (estimation conservative)
const MIN_CREDITS_THRESHOLD = 0.01; // $0.01 minimum

// ============================================================
// POST /api/chat — stream message LLM via OpenRouter
// Rate limit : 30 req/min
// ============================================================

export async function POST(req: Request): Promise<Response> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit
  const rl = rateLimit(`${clerkId}:chat`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans une minute." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  // Parse + validation
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { messages, projectId, conversationId, model, systemPrompt } = parsed.data;

  // Lookup user FYREN
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // ——————————————————————————————————————————————————————
  // Vérification crédits AVANT l'appel LLM (règle métier critique)
  // ——————————————————————————————————————————————————————
  if (user.credits < MIN_CREDITS_THRESHOLD) {
    return NextResponse.json(
      {
        error: "Crédits insuffisants",
        credits: user.credits,
        message: "Rechargez vos crédits pour continuer.",
      },
      { status: 402 }
    );
  }

  const supabase = createServiceClient();

  // Vérification ownership du projet
  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }

  // Récupération ou création de la conversation
  let activeConversationId = conversationId;

  if (!activeConversationId) {
    // Créer une conversation intake par défaut
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({ project_id: projectId, type: "intake" })
      .select("id")
      .single();

    if (convError || !newConv) {
      console.error("[POST /api/chat] Création conversation:", convError?.message);
      return NextResponse.json({ error: "Erreur création conversation" }, { status: 500 });
    }
    activeConversationId = newConv.id;
  } else {
    // Vérifier que la conversation appartient au projet
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", activeConversationId)
      .eq("project_id", projectId)
      .single();

    if (!conv) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }
  }

  // Sauvegarder le dernier message user en BDD
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    await supabase.from("messages").insert({
      conversation_id: activeConversationId,
      role: "user",
      content: lastUserMessage.content,
    });
  }

  // ——————————————————————————————————————————————————————
  // Streaming LLM via OpenRouter (Vercel AI SDK)
  // ——————————————————————————————————————————————————————

  // Messages pour le LLM (on passe TOUS les messages incluant l'historique)
  const llmMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  try {
    const result = streamText({
      model: openrouter(model),
      messages: llmMessages,
      system: systemPrompt,
      onFinish: async ({ usage, text }) => {
        // Calcul du coût réel
        const inputTokens = usage?.inputTokens ?? 0;
        const outputTokens = usage?.outputTokens ?? 0;
        const totalTokens = inputTokens + outputTokens;
        const costUsd = estimateCost(model, inputTokens, outputTokens);
        const creditCost = toCreditCost(costUsd);

        // Sauvegarder le message assistant
        await supabase.from("messages").insert({
          conversation_id: activeConversationId!,
          role: "assistant",
          content: text,
          tokens_used: totalTokens,
          cost_usd: costUsd,
        });

        // Débiter les crédits (atomique via RPC)
        try {
          await deductCredits(
            user.id,
            creditCost,
            `Chat ${model} — ${totalTokens} tokens`,
            projectId
          );
        } catch (err) {
          if (err instanceof InsufficientCreditsError) {
            // Le stream est déjà envoyé — logguer uniquement
            // Le prochain appel sera bloqué en amont
            console.warn(
              `[POST /api/chat] Crédits insuffisants pour user ${user.id} après stream`
            );
          } else {
            console.error("[POST /api/chat] Erreur débit crédits:", err);
          }
        }
      },
    });

    // Retourner le stream SSE (pas de WebSocket — request/response standard)
    // Le header x-conversation-id permet au client de récupérer l'ID de la conversation créée
    const response = result.toTextStreamResponse();
    const headers = new Headers(response.headers);
    headers.set("x-conversation-id", activeConversationId);

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (err) {
    console.error("[POST /api/chat] Erreur LLM:", err);
    return NextResponse.json(
      { error: "Erreur appel LLM. Réessayez." },
      { status: 502 }
    );
  }
}
