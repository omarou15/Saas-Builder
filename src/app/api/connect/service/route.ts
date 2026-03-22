// POST /api/connect/service
// Sauvegarde une API key manuelle (Supabase, Clerk, Stripe, Resend, Vercel).
// La key est chiffrée AES-256-GCM AVANT l'INSERT — jamais en clair en BDD.
// Un ping test vérifie la validité avant de marquer la connexion "connected".

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encrypt } from "@/lib/crypto";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

// Services supportés (hors github qui a son propre OAuth flow)
const SUPPORTED_SERVICES = ["supabase", "clerk", "stripe", "resend", "vercel"] as const;
type SupportedService = typeof SUPPORTED_SERVICES[number];

const BodySchema = z.object({
  projectId: z.string().uuid("projectId invalide"),
  service: z.enum(SUPPORTED_SERVICES, { message: "Service non supporté" }),
  // Chaque service peut avoir des champs différents — on accepte un objet libre
  // mais on valide la présence des champs obligatoires par service ci-dessous
  credentials: z.record(z.string(), z.string()),
});

// Champs obligatoires par service
const REQUIRED_FIELDS: Record<SupportedService, string[]> = {
  supabase: ["url", "service_role_key"],
  clerk: ["secret_key"],
  stripe: ["secret_key"],
  resend: ["api_key"],
  vercel: ["token"],
};

export async function POST(req: Request): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit : 10 req/min
  const rl = rateLimit(`${clerkId}:connect:service`, 10, 60_000);
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

  const { projectId, service, credentials } = parsed.data;

  // Vérifier champs obligatoires par service
  const required = REQUIRED_FIELDS[service];
  const missing = required.filter((f) => !credentials[f]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Champs manquants pour ${service} : ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  // Vérifier que le projet appartient à l'utilisateur
  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Projet introuvable ou accès refusé" }, { status: 404 });
  }

  // Ping test — vérifier la validité des credentials AVANT de sauvegarder
  const pingResult = await pingService(service, credentials);
  if (!pingResult.valid) {
    return NextResponse.json(
      { error: `Credentials invalides pour ${service} : ${pingResult.reason}` },
      { status: 422 }
    );
  }

  // Chiffrement de chaque valeur de credential — JAMAIS en clair en BDD
  const encryptedCredentials: Record<string, string> = {};
  for (const [key, value] of Object.entries(credentials)) {
    encryptedCredentials[`encrypted_${key}`] = await encrypt(value);
  }

  // Upsert dans service_connections
  const { error: dbError } = await supabase
    .from("service_connections")
    .upsert(
      {
        project_id: projectId,
        service,
        config: encryptedCredentials,
        status: "connected",
      },
      { onConflict: "project_id,service" }
    );

  if (dbError) {
    console.error("[POST /api/connect/service] db error:", dbError.message);
    return NextResponse.json({ error: "Erreur sauvegarde connexion" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    service,
    status: "connected",
    ping: pingResult.info,
  });
}

// ============================================================
// Ping tests par service
// ============================================================

interface PingResult {
  valid: boolean;
  reason?: string;
  info?: string;
}

async function pingService(
  service: SupportedService,
  creds: Record<string, string>
): Promise<PingResult> {
  try {
    switch (service) {
      case "supabase":
        return await pingSupabase(creds);
      case "clerk":
        return await pingClerk(creds);
      case "stripe":
        return await pingStripe(creds);
      case "resend":
        return await pingResend(creds);
      case "vercel":
        return await pingVercel(creds);
    }
  } catch (err) {
    return { valid: false, reason: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}

async function pingSupabase(creds: Record<string, string>): Promise<PingResult> {
  const { url, service_role_key } = creds;
  const res = await fetch(`${url}/rest/v1/`, {
    headers: new Headers({
      apikey: service_role_key ?? "",
      Authorization: `Bearer ${service_role_key ?? ""}`,
    }),
  });
  if (res.ok || res.status === 200) {
    return { valid: true, info: "Supabase project reachable" };
  }
  return { valid: false, reason: `HTTP ${res.status}` };
}

async function pingClerk(creds: Record<string, string>): Promise<PingResult> {
  const res = await fetch("https://api.clerk.com/v1/users?limit=1", {
    headers: { Authorization: `Bearer ${creds.secret_key}` },
  });
  if (res.ok) return { valid: true, info: "Clerk API reachable" };
  const body = await res.json().catch(() => ({})) as { errors?: { message: string }[] };
  const msg = body.errors?.[0]?.message ?? `HTTP ${res.status}`;
  return { valid: false, reason: msg };
}

async function pingStripe(creds: Record<string, string>): Promise<PingResult> {
  const res = await fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${creds.secret_key}` },
  });
  if (res.ok) return { valid: true, info: "Stripe API reachable" };
  const body = await res.json().catch(() => ({})) as { error?: { message: string } };
  return { valid: false, reason: body.error?.message ?? `HTTP ${res.status}` };
}

async function pingResend(creds: Record<string, string>): Promise<PingResult> {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${creds.api_key}` },
  });
  if (res.ok) return { valid: true, info: "Resend API reachable" };
  const body = await res.json().catch(() => ({})) as { message?: string };
  return { valid: false, reason: body.message ?? `HTTP ${res.status}` };
}

async function pingVercel(creds: Record<string, string>): Promise<PingResult> {
  const res = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${creds.token}` },
  });
  if (res.ok) {
    const body = await res.json() as { user?: { username?: string } };
    return { valid: true, info: `Vercel user: ${body.user?.username ?? "connected"}` };
  }
  return { valid: false, reason: `HTTP ${res.status}` };
}
