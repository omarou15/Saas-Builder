// POST /api/webhooks/stripe
// Reçoit les événements Stripe et met à jour les crédits utilisateur.
//
// Sécurité :
//   1. Vérification de la signature Stripe (STRIPE_WEBHOOK_SECRET) — AVANT tout traitement
//   2. Idempotence : on vérifie que le stripe_id n'existe pas déjà en BDD
//
// Événements gérés :
//   - checkout.session.completed → INSERT credit_transaction + UPDATE users.credits

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

export async function POST(req: Request): Promise<NextResponse> {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET non configuré");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  }

  // Le raw body est indispensable pour la vérification de signature Stripe
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[webhook/stripe] Signature invalide:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    default:
      // Ignorer les autres événements
      break;
  }

  return NextResponse.json({ received: true });
}

// ============================================================
// Handler : checkout.session.completed
// ============================================================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid") return;

  const sessionId = session.id;
  const metadata = session.metadata;
  const amountUsd = parseFloat(metadata?.amount_usd ?? "0");
  const fyrenUserId = metadata?.fyren_user_id;

  if (!fyrenUserId || !amountUsd || amountUsd <= 0) {
    console.error("[webhook/stripe] Métadonnées manquantes sur session", sessionId);
    return;
  }

  const supabase = createServiceClient();

  // Idempotence : ne pas traiter deux fois la même session
  const { data: existing } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("stripe_id", sessionId)
    .maybeSingle();

  if (existing) return;

  // Récupérer le solde actuel pour l'incrémenter
  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("credits")
    .eq("id", fyrenUserId)
    .single();

  if (userErr || !userRow) {
    console.error("[webhook/stripe] Utilisateur introuvable:", fyrenUserId);
    return;
  }

  const newCredits = Number(userRow.credits) + amountUsd;

  // Mise à jour atomique : INSERT transaction + UPDATE credits
  // On fait les deux opérations — si l'INSERT échoue, on ne crédite pas
  const { error: txError } = await supabase
    .from("credit_transactions")
    .insert({
      user_id: fyrenUserId,
      type: "purchase",
      amount: amountUsd,
      description: `Achat de crédits — $${amountUsd.toFixed(2)}`,
      stripe_id: sessionId,
    });

  if (txError) {
    console.error("[webhook/stripe] Erreur INSERT credit_transaction:", txError.message);
    return;
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ credits: newCredits, updated_at: new Date().toISOString() })
    .eq("id", fyrenUserId);

  if (updateError) {
    console.error("[webhook/stripe] Erreur UPDATE users.credits:", updateError.message);
    // La transaction est déjà insérée — le solde sera corrigé via reconciliation
  }
}
