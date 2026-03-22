// POST /api/connect/github
// Reçoit le code OAuth GitHub, l'échange contre un access token,
// chiffre le token AES-256-GCM, sauvegarde dans service_connections.
//
// Prérequis :
//   GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET dans les env vars
//   (créer une OAuth App sur github.com/settings/developers)

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encrypt } from "@/lib/crypto";
import { createServiceClient } from "@/lib/supabase";
import { getUserByClerkId } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

const BodySchema = z.object({
  code: z.string().min(1, "Code OAuth requis"),
  projectId: z.string().uuid("projectId invalide"),
});

export async function POST(req: Request): Promise<NextResponse> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Rate limit : 5 req/min
  const rl = rateLimit(`${clerkId}:connect:github`, 5, 60_000);
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

  const { code, projectId } = parsed.data;

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

  // Vérifier config OAuth GitHub
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Configuration GitHub OAuth manquante" }, { status: 503 });
  }

  // Échange du code OAuth contre un access token GitHub
  let accessToken: string;
  let githubLogin: string;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });

    if (!tokenRes.ok) {
      return NextResponse.json({ error: "Erreur échange code GitHub" }, { status: 502 });
    }

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.json(
        { error: `GitHub OAuth : ${tokenData.error ?? "token manquant"}` },
        { status: 400 }
      );
    }
    accessToken = tokenData.access_token;

    // Récupérer l'identité GitHub (pour affichage uniquement, pas loguée)
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "FYREN-Platform" },
    });
    const userData = await userRes.json() as { login?: string };
    githubLogin = userData.login ?? "unknown";
  } catch (err) {
    console.error("[POST /api/connect/github] fetch error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Erreur connexion GitHub" }, { status: 502 });
  }

  // Chiffrement du token — JAMAIS en clair en BDD
  const encryptedToken = await encrypt(accessToken);

  // Upsert dans service_connections (un seul GitHub par projet)
  const { error: dbError } = await supabase
    .from("service_connections")
    .upsert(
      {
        project_id: projectId,
        service: "github",
        config: { encrypted_token: encryptedToken, login: githubLogin },
        status: "connected",
      },
      { onConflict: "project_id,service" }
    );

  if (dbError) {
    console.error("[POST /api/connect/github] db error:", dbError.message);
    return NextResponse.json({ error: "Erreur sauvegarde connexion" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    service: "github",
    login: githubLogin,
    status: "connected",
  });
}
