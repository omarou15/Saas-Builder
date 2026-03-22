// POST /api/billing/purchase
// Crée une Stripe Checkout Session (mode payment, one-time).
// Montants prédefinis : $5 / $20 / $50 ou montant custom (min $5).
// Retourne l'URL de checkout — le frontend redirige l'utilisateur.

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

const PRESET_AMOUNTS_USD = [5, 20, 50] as const;
const MIN_AMOUNT_USD = 5;

const BodySchema = z.object({
  // Montant en USD. Doit être l'un des présets ou un montant custom >= $5.
  amount: z
    .number()
    .min(MIN_AMOUNT_USD, `Montant minimum : $${MIN_AMOUNT_USD}`)
    .refine(
      (v) => Number.isFinite(v) && v * 100 === Math.floor(v * 100),
      "Le montant ne peut avoir que 2 décimales max"
    ),
});

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key, { apiVersion: "2026-02-25.clover" });
}

export async function POST(req: Request): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit : 5 req/min
  const rl = rateLimit(`${clerkId}:billing:purchase`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans une minute." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Parse + validation
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { amount } = parsed.data;

  // Récupérer l'utilisateur FYREN
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Récupérer l'email pour pre-fill Stripe
  const supabase = createServiceClient();
  const { data: dbUser } = await supabase
    .from("users")
    .select("email, name")
    .eq("id", user.id)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const amountCents = Math.round(amount * 100);

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return NextResponse.json({ error: "Configuration Stripe manquante" }, { status: 503 });
  }

  // Créer la Checkout Session Stripe
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "Crédits FYREN",
              description: `$${amount.toFixed(2)} de crédits — utilisables pour tous vos projets FYREN`,
            },
          },
          quantity: 1,
        },
      ],
      // Métadonnées — récupérées dans le webhook pour créditer le compte
      metadata: {
        fyren_user_id: user.id,
        fyren_clerk_id: clerkId,
        amount_usd: amount.toFixed(2),
      },
      customer_email: dbUser?.email,
      success_url: `${appUrl}/app/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/app/billing?canceled=1`,
    });
  } catch (err) {
    console.error("[POST /api/billing/purchase] stripe error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Erreur création session Stripe" }, { status: 502 });
  }

  return NextResponse.json({
    checkoutUrl: session.url,
    sessionId: session.id,
    amount,
  });
}
