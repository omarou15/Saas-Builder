// POST /api/webhooks/clerk
// Sync Clerk events → table users Supabase
// Règle métier critique : TOUJOURS vérifier la signature svix AVANT de traiter le payload

import { headers } from "next/headers";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase";

// Types Clerk webhook (sous-ensemble des events qui nous intéressent)
interface ClerkUserData {
  id: string;
  email_addresses: Array<{
    id: string;
    email_address: string;
  }>;
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
}

interface ClerkWebhookEvent {
  type: "user.created" | "user.updated" | "user.deleted";
  data: ClerkUserData | { id: string };
}

// Crédits de bienvenue offerts à la première inscription
const WELCOME_CREDITS = 2.0;

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[clerk-webhook] Missing CLERK_WEBHOOK_SECRET");
    return new Response("Server misconfiguration", { status: 500 });
  }

  // ── 1. Vérification de la signature svix ──────────────────────────────────
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    // Ne pas logger le payload — peut contenir des données sensibles
    console.error("[clerk-webhook] Signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  // ── 2. Traitement des events ───────────────────────────────────────────────
  const supabase = createServiceClient();

  switch (event.type) {
    case "user.created": {
      const userData = event.data as ClerkUserData;
      const primaryEmail = userData.email_addresses.find(
        (e) => e.id === userData.primary_email_address_id,
      );

      if (!primaryEmail) {
        console.error("[clerk-webhook] user.created: no primary email for clerk_id", userData.id);
        return new Response("No primary email", { status: 422 });
      }

      const name = [userData.first_name, userData.last_name].filter(Boolean).join(" ") || null;

      // Insérer l'utilisateur avec les crédits de bienvenue
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          clerk_id: userData.id,
          email: primaryEmail.email_address,
          name,
          credits: WELCOME_CREDITS,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[clerk-webhook] user.created insert error:", insertError.code);
        return new Response("Database error", { status: 500 });
      }

      // Enregistrer la transaction de bienvenue
      const { error: txError } = await supabase.from("credit_transactions").insert({
        user_id: newUser.id,
        type: "welcome",
        amount: WELCOME_CREDITS,
        description: "Crédits de bienvenue FYREN",
      });

      if (txError) {
        // Non-bloquant : l'utilisateur est créé, le log est cosmétique
        console.error("[clerk-webhook] welcome transaction error:", txError.code);
      }

      break;
    }

    case "user.updated": {
      const userData = event.data as ClerkUserData;
      const primaryEmail = userData.email_addresses.find(
        (e) => e.id === userData.primary_email_address_id,
      );
      const name = [userData.first_name, userData.last_name].filter(Boolean).join(" ") || null;

      const updatePayload: Record<string, unknown> = { name };
      if (primaryEmail) {
        updatePayload.email = primaryEmail.email_address;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("clerk_id", userData.id);

      if (updateError) {
        console.error("[clerk-webhook] user.updated error:", updateError.code);
        return new Response("Database error", { status: 500 });
      }

      break;
    }

    case "user.deleted": {
      const { id: clerkId } = event.data as { id: string };

      // La suppression cascade sur projects, service_connections, conversations,
      // messages, credit_transactions (ON DELETE CASCADE dans la migration)
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("clerk_id", clerkId);

      if (deleteError) {
        console.error("[clerk-webhook] user.deleted error:", deleteError.code);
        return new Response("Database error", { status: 500 });
      }

      break;
    }

    default:
      // Event non géré — OK, on renvoie 200 pour ne pas déclencher de retry Clerk
      break;
  }

  return new Response(null, { status: 200 });
}
